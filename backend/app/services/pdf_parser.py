import io
import re
import json
import logging
import unicodedata
from typing import List, Dict, Any
from pypdf import PdfReader
from ..config import settings
from .ai_service import _heuristic_reasoning_engine

logger = logging.getLogger(__name__)


def sanitize_str(s: Any) -> str:
    """Removes NUL bytes (0x00) and unprintable C0 control characters to prevent PostgreSQL insertion errors."""
    if not s:
        return ""
    if not isinstance(s, str):
        s = str(s)
    s = s.replace('\x00', '').replace('\u0000', '')
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
    return s


def clean_inline_text(s: str) -> str:
    """Cleans inline text (such as chapter title, options, answers) into a clean single-line string."""
    if not s:
        return ""
    s = sanitize_str(s)
    s = re.sub(r'\[(?:COLOR_MARK|BOLD_MARK|ITALIC_MARK)\]', '', s)
    return re.sub(r'[\r\n\t]+', ' ', s).strip()


def clean_content_text(s: str) -> str:
    """
    Cleans question content while preserving indentation and line breaks for code blocks.
    Removes markup markers and excessive consecutive empty lines.
    """
    if not s:
        return ""
    s = sanitize_str(s)
    s = re.sub(r'\[(?:COLOR_MARK|BOLD_MARK|ITALIC_MARK)\]', '', s)
    lines = s.split('\n')
    cleaned_lines = [l.rstrip() for l in lines]
    res = '\n'.join(cleaned_lines)
    res = re.sub(r'\n{3,}', '\n\n', res)
    return res.strip()


def extract_text_from_pdf_pypdf(pdf_bytes: bytes, max_pages: int = 500) -> str:
    """Fallback plain text extraction using pypdf."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        full_text = []
        total_pages = len(reader.pages)
        pages_to_read = min(total_pages, max_pages)

        for page_idx in range(pages_to_read):
            try:
                page = reader.pages[page_idx]
                text = page.extract_text()
                if text:
                    full_text.append(text)
            except Exception as e:
                logger.warning(f"Error reading page {page_idx}: {e}")
                continue

        raw = "\n\n".join(full_text)
        return unicodedata.normalize('NFC', sanitize_str(raw))
    except Exception as e:
        logger.error(f"Error reading PDF with pypdf: {e}")
        return ""


def extract_rich_text_from_pdf(pdf_bytes: bytes, max_pages: int = 500) -> str:
    """
    Extracts text while detecting:
    1. Red / Blue / Green / Colored font text.
    2. Yellow / Green / Cyan / Orange background highlight rectangles (vector drawings & PDF annotations).
    3. Pixel-level rendered background highlights (from PowerPoint, Keynote, Canva, or Word exports).
    4. Bold / Italic styles.
    5. Multi-column layout reading order (Left column -> Right column).
    Injects [COLOR_MARK], [BOLD_MARK], [ITALIC_MARK] into the text stream.
    """
    try:
        import pymupdf
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        full_text = []
        pages_to_read = min(len(doc), max_pages)

        for page_idx in range(pages_to_read):
            page = doc[page_idx]
            page_w = page.rect.width
            page_h = page.rect.height

            # 1. Collect all Highlight Annotations
            highlight_rects = []
            try:
                for annot in page.annots():
                    if annot.rect:
                        highlight_rects.append(pymupdf.Rect(annot.rect))
            except Exception:
                pass

            # 2. Collect all Vector Drawing Fills (e.g. Yellow text highlights, background rectangles)
            try:
                for draw in page.get_drawings():
                    fill = draw.get("fill")
                    if fill and isinstance(fill, (list, tuple)) and len(fill) >= 3:
                        fr, fg, fb = fill[0], fill[1], fill[2]
                        if fr <= 1.0 and fg <= 1.0 and fb <= 1.0:
                            fr, fg, fb = fr * 255.0, fg * 255.0, fb * 255.0

                        is_yellow = (fr > 160 and fg > 160 and fb < 160)
                        is_green = (fg > 150 and fr < 160 and fb < 170)
                        is_cyan = (fb > 160 and fg > 150 and fr < 160)
                        is_orange = (fr > 190 and fg > 90 and fb < 110)
                        is_pink = (fr > 190 and fb > 140 and fg < 180)
                        is_highlight_color = is_yellow or is_green or is_cyan or is_orange or is_pink

                        d_rect = draw.get("rect")
                        if is_highlight_color and d_rect and d_rect.width > 4 and d_rect.height > 4:
                            if d_rect.width < page_w * 0.9 or d_rect.height < page_h * 0.9:
                                highlight_rects.append(pymupdf.Rect(d_rect))
            except Exception:
                pass

            # 3. Lazy Pixmap for pixel-level visual highlight verification (only if needed)
            pix_container = {"pix": None, "scale_x": 1.0, "scale_y": 1.0, "attempted": False}

            def get_page_pix():
                if not pix_container["attempted"]:
                    pix_container["attempted"] = True
                    try:
                        p = page.get_pixmap(dpi=72)
                        pix_container["pix"] = p
                        pix_container["scale_x"] = p.width / max(1.0, page_w)
                        pix_container["scale_y"] = p.height / max(1.0, page_h)
                    except Exception:
                        pix_container["pix"] = None
                return pix_container["pix"], pix_container["scale_x"], pix_container["scale_y"]

            text_dict = page.get_text("dict", flags=pymupdf.TEXTFLAGS_SEARCH)
            raw_blocks = text_dict.get("blocks", [])

            # Handle 2-column or 1-column reading order
            mid_x = page_w * 0.5
            text_blocks = [b for b in raw_blocks if "lines" in b]
            has_two_columns = False

            if len(text_blocks) >= 4:
                left_count = sum(1 for b in text_blocks if b.get("bbox", [0, 0, 0, 0])[2] <= mid_x + 20)
                right_count = sum(1 for b in text_blocks if b.get("bbox", [0, 0, 0, 0])[0] >= mid_x - 20)
                if left_count >= 2 and right_count >= 2 and (left_count + right_count) >= len(text_blocks) * 0.7:
                    has_two_columns = True

            if has_two_columns:
                left_blocks = sorted([b for b in text_blocks if b.get("bbox", [0, 0, 0, 0])[0] < mid_x], key=lambda b: b.get("bbox", [0, 0, 0, 0])[1])
                right_blocks = sorted([b for b in text_blocks if b.get("bbox", [0, 0, 0, 0])[0] >= mid_x], key=lambda b: b.get("bbox", [0, 0, 0, 0])[1])
                ordered_blocks = left_blocks + right_blocks
            else:
                ordered_blocks = sorted(text_blocks, key=lambda b: b.get("bbox", [0, 0, 0, 0])[1])

            page_lines = []
            for block in ordered_blocks:
                for line in block.get("lines", []):
                    line_parts = []
                    for span in line.get("spans", []):
                        text = span.get("text", "")
                        if not text:
                            continue
                        text = sanitize_str(text)
                        if not text:
                            continue

                        color = span.get("color", 0)
                        r = (color >> 16) & 255
                        g = (color >> 8) & 255
                        b = color & 255

                        is_red = (r > 130 and g < 110 and b < 110)
                        is_green = (g > 130 and r < 110 and b < 120)
                        is_blue = (b > 150 and r < 110 and g < 140)
                        is_colored = is_red or is_green or is_blue or (max(r, g, b) - min(r, g, b) > 60 and max(r, g, b) > 90)

                        is_under_highlight = False
                        span_rect = pymupdf.Rect(span.get("bbox", [0, 0, 0, 0]))
                        if not span_rect.is_empty and highlight_rects:
                            span_area = span_rect.get_area()
                            for hr in highlight_rects:
                                intersect = span_rect & hr
                                if not intersect.is_empty and (span_area <= 0 or (intersect.get_area() / max(1.0, span_area) > 0.15)):
                                    is_under_highlight = True
                                    break

                        if not is_under_highlight and not is_colored and not span_rect.is_empty and (re.search(r'^[A-Da-d][\.\)\:\-]', text.strip()) or len(text.strip()) > 3):
                            pix, scale_x, scale_y = get_page_pix()
                            if pix:
                                px0 = max(0, min(pix.width - 1, int(span_rect.x0 * scale_x)))
                                py0 = max(0, min(pix.height - 1, int(span_rect.y0 * scale_y)))
                                px1 = max(0, min(pix.width, int(span_rect.x1 * scale_x)))
                                py1 = max(0, min(pix.height, int(span_rect.y1 * scale_y)))

                                if px1 > px0 and py1 > py0:
                                    step_x = max(1, (px1 - px0) // 8)
                                    step_y = max(1, (py1 - py0) // 3)
                                    sample_total = 0
                                    sample_highlight = 0

                                    for sy in range(py0, py1, step_y):
                                        for sx in range(px0, px1, step_x):
                                            pixel = pix.pixel(sx, sy)
                                            pr, pg, pb = pixel[0], pixel[1], pixel[2]
                                            sample_total += 1

                                            is_px_yellow = (pr > 165 and pg > 165 and pb < 145)
                                            is_px_green = (pg > 165 and pr < 170 and pb < 170 and (pg - pr > 25))
                                            is_px_cyan = (pb > 165 and pg > 165 and pr < 160)
                                            is_px_orange = (pr > 190 and pg > 90 and pg < 185 and pb < 110)
                                            is_px_pink = (pr > 190 and pb > 140 and pg < 170)

                                            if is_px_yellow or is_px_green or is_px_cyan or is_px_orange or is_px_pink:
                                                sample_highlight += 1

                                    if sample_total > 0 and (sample_highlight / sample_total) >= 0.15:
                                        is_under_highlight = True

                        font_lower = span.get("font", "").lower()
                        flags = span.get("flags", 0)
                        is_bold = ("bold" in font_lower or "black" in font_lower or "heavy" in font_lower or (flags & 2 != 0) or (flags & 16 != 0))
                        is_italic = ("italic" in font_lower or "oblique" in font_lower or (flags & 1 != 0))

                        if is_under_highlight or is_colored:
                            line_parts.append(f"{text} [COLOR_MARK]")
                        elif is_bold:
                            line_parts.append(f"{text} [BOLD_MARK]")
                        elif is_italic:
                            line_parts.append(f"{text} [ITALIC_MARK]")
                        else:
                            line_parts.append(text)

                    if line_parts:
                        page_lines.append(" ".join(line_parts))

            full_text.append("\n".join(page_lines))

        raw = "\n\n".join(full_text)
        return unicodedata.normalize('NFC', sanitize_str(raw))
    except Exception as e:
        logger.warning(f"PyMuPDF rich extraction failed ({e}), falling back to pypdf.")
        return extract_text_from_pdf_pypdf(pdf_bytes, max_pages)


def find_option_markers(block: str):
    """
    Finds ordered positions of options A, B, C, D (or lowercase a, b, c, d).
    Returns dict with match offsets or None for each letter.
    """
    def search_letter(letter: str, start_pos: int = 0):
        low = letter.lower()
        up = letter.upper()
        pats = [
            rf'(?:^|\n|\r|\t|\s{{2,}})(?:\(?\[?([{up}{low}])[\.\)\:\-\/\]]|\(([{up}{low}])\))\s*',
            rf'(?:^|\s)(?:[{up}{low}][\.\)\:\-\/]|(?:\([{up}{low}]\)|\[[{up}{low}]\]))\s+'
        ]
        for pat in pats:
            m = re.search(pat, block[start_pos:])
            if m:
                abs_start = start_pos + m.start()
                abs_end = start_pos + m.end()
                return {"start": abs_start, "end": abs_end, "letter": up}
        return None

    mA = search_letter('A', 0)
    if not mA:
        return None

    mB = search_letter('B', mA['end'])
    if not mB:
        return None

    mC = search_letter('C', mB['end'])
    mD = search_letter('D', mC['end']) if mC else None

    return {"A": mA, "B": mB, "C": mC, "D": mD}


def parse_single_block(block: str, default_chapter: str = "Bài 1", global_answers: dict = None) -> List[Dict[str, Any]]:
    """Parses a single isolated text block into a question dict."""
    if global_answers is None:
        global_answers = {}

    block = block.strip()
    if not block or len(block) < 8:
        return []

    ignore_meta_rx = re.compile(
        r'^\s*(?:Giáo trình|Giáo án|Khoa|Bộ môn|Trường|Học viện|Đại học|ĐỀ THI|ĐÁP ÁN|Trang\s*\d+|Page\s*\d+|Nhập môn|đã được đối chiếu|LIỆU ĐƠN GIẢN|TÀI LIỆU|HỌC PHẦN)\b',
        re.IGNORECASE
    )

    chapter_header_rx = re.compile(
        r'(?:^|\n)\s*(BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*([0-9IVXLCDMivxlcdm]+)(?:[\s\:\.\-\–\—]*([^\n]*))',
        re.IGNORECASE
    )
    current_chapter = default_chapter
    ch_match = chapter_header_rx.search(block)
    if ch_match:
        kw_name = ch_match.group(1).capitalize()
        kw_num = ch_match.group(2)
        rest_title = (ch_match.group(3) or "").strip(' :.-–—\t')
        if rest_title:
            current_chapter = f"{kw_name} {kw_num}: {rest_title}"
        else:
            current_chapter = f"{kw_name} {kw_num}"
        current_chapter = clean_inline_text(current_chapter)[:120]

    opts = find_option_markers(block)
    if not opts or not opts.get("A") or not opts.get("B"):
        return []

    mA = opts["A"]
    mB = opts["B"]
    mC = opts.get("C")
    mD = opts.get("D")

    content_raw = block[:mA["start"]].strip()
    content_lines = [
        l for l in content_raw.split('\n')
        if not re.match(r'^\s*(?:TRẮC\s*NGHIỆM|BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*[0-9IVXLCDMivxlcdm]*', l.strip(), re.IGNORECASE)
        and not ignore_meta_rx.search(l.strip())
    ]
    content = '\n'.join(content_lines).strip()

    q_num_match = re.search(r'^(?:(?:Câu|CÂU|Question|Bài|Task|Ex|Q\.?|BT)\s*)?(\d{1,4})[\s\:\.\-\)\/\]]*', content, flags=re.IGNORECASE)
    q_num = int(q_num_match.group(1)) if (q_num_match and q_num_match.group(1)) else None

    content_clean = re.sub(r'^(?:(?:Câu|CÂU|Question|Bài|Task|Ex|Q\.?|BT)\s*)?\d{1,4}[\s\:\.\-\)\/\]]*', '', content, flags=re.IGNORECASE).strip()
    content_clean = clean_content_text(content_clean)
    if not content_clean:
        content_clean = clean_content_text(content)

    ans_match = re.search(r'(?:[✓✔☑\s]*)?(?:Đáp án đúng|Đáp án|ĐÁP ÁN|Key|Answer|Đ/a|ĐA|Đ\.A|ĐA đúng|Chọn|Phương án đúng)[:\s]+(?:[✓✔☑\s]*)([A-D])\b', block, flags=re.IGNORECASE)
    ans_search_start = re.search(r'(?:[✓✔☑\s]*)?(?:Đáp án đúng|Đáp án|ĐÁP ÁN|Key|Answer|Đ/a|ĐA|Đ\.A|ĐA đúng|Chọn|Phương án đúng)[:\s]+(?:[✓✔☑\s]*)[A-D]\b', block, flags=re.IGNORECASE)
    exp_match = re.search(r'(?:\[\]\s*)?(?:Giải thích|GIẢI THÍCH|Lý do|Explanation|HDG|Hướng dẫn giải)[:\s]+(.*)', block, flags=re.IGNORECASE | re.DOTALL)
    general_exp = clean_inline_text(exp_match.group(1)) if exp_match else ""

    end_boundary = ans_search_start.start() if ans_search_start else (exp_match.start() if exp_match else len(block))

    if mA and mB and mC and mD:
        opt_a_raw = block[mA["end"]:mB["start"]]
        opt_b_raw = block[mB["end"]:mC["start"]]
        opt_c_raw = block[mC["end"]:mD["start"]]
        opt_d_raw = block[mD["end"]:end_boundary]
    elif mA and mB and mC and not mD:
        opt_a_raw = block[mA["end"]:mB["start"]]
        opt_b_raw = block[mB["end"]:mC["start"]]
        opt_c_raw = block[mC["end"]:end_boundary]
        opt_d_raw = "Tất cả các đáp án trên đều sai"
    else:
        opt_a_raw = block[mA["end"]:mB["start"]]
        opt_b_raw = block[mB["end"]:end_boundary]
        opt_c_raw = "Không có phương án phù hợp"
        opt_d_raw = "Tất cả các đáp án trên đều sai"

    colored_opts = [key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)] if '[COLOR_MARK]' in r]
    bold_opts = [key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)] if '[BOLD_MARK]' in r]
    italic_opts = [key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)] if '[ITALIC_MARK]' in r]

    checkmark_opts = [
        key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)]
        if re.search(r'[✓✔☑\*]|\s+[\(\[](?:đúng|dung|chính xác|correct|true)[\)\]]\s*$', clean_inline_text(r), re.IGNORECASE)
    ]

    def clean_opt(s: str) -> str:
        cleaned = clean_inline_text(s)
        cleaned = re.sub(r'^[✓✔☑\*\s]+', '', cleaned).strip()
        cleaned = re.sub(r'[✓✔☑\*]+$', '', cleaned).strip()
        # Only remove trailing (đúng) or [đúng] if enclosed in brackets/parentheses and string is not JUST "True"/"Đúng"
        cleaned = re.sub(r'\s+[\(\[](?:đúng|dung|chính xác|correct|true)[\)\]]\s*$', '', cleaned, flags=re.IGNORECASE).strip()
        return cleaned

    opt_a = clean_opt(opt_a_raw)
    opt_b = clean_opt(opt_b_raw)
    opt_c = clean_opt(opt_c_raw)
    opt_d = clean_opt(opt_d_raw)

    exp_target_match = None
    if general_exp:
        exp_ans_search = re.search(r'(?:đáp án|chọn|kết quả|phương án)[\s\:\(a-zA-Zđềthichínhthức]*([A-D])\b', general_exp, re.IGNORECASE)
        if exp_ans_search:
            exp_target_match = exp_ans_search.group(1).upper()

    if ans_match:
        correct_answer = ans_match.group(1).upper()
    elif len(checkmark_opts) == 1:
        correct_answer = checkmark_opts[0]
    elif len(colored_opts) == 1:
        correct_answer = colored_opts[0]
    elif len(bold_opts) == 1:
        correct_answer = bold_opts[0]
    elif len(italic_opts) == 1:
        correct_answer = italic_opts[0]
    elif exp_target_match:
        correct_answer = exp_target_match
    elif q_num and q_num in global_answers:
        correct_answer = global_answers[q_num]
    else:
        correct_answer = "A"

    if opt_a and opt_b:
        if not opt_c:
            opt_c = "Không có phương án phù hợp"
        if not opt_d:
            opt_d = "Tất cả các đáp án trên đều sai"

        if general_exp:
            def make_exp_from_general(letter, val, is_corr):
                if is_corr:
                    return f"Chính xác! {general_exp}"
                return f"Chưa chính xác. Lựa chọn ({letter}) '{val}' chưa đúng theo phân tích: {general_exp[:180]}..."
            exp_a = make_exp_from_general("A", opt_a, correct_answer == "A")
            exp_b = make_exp_from_general("B", opt_b, correct_answer == "B")
            exp_c = make_exp_from_general("C", opt_c, correct_answer == "C")
            exp_d = make_exp_from_general("D", opt_d, correct_answer == "D")
        else:
            reasoning = _heuristic_reasoning_engine(content_clean, opt_a, opt_b, opt_c, opt_d, correct_answer)
            exp_a = reasoning["explanation_a"]
            exp_b = reasoning["explanation_b"]
            exp_c = reasoning["explanation_c"]
            exp_d = reasoning["explanation_d"]

        return [{
            "chapter": sanitize_str(current_chapter),
            "content": sanitize_str(content_clean),
            "option_a": sanitize_str(opt_a),
            "option_b": sanitize_str(opt_b),
            "option_c": sanitize_str(opt_c),
            "option_d": sanitize_str(opt_d),
            "correct_answer": sanitize_str(correct_answer),
            "explanation_a": sanitize_str(exp_a),
            "explanation_b": sanitize_str(exp_b),
            "explanation_c": sanitize_str(exp_c),
            "explanation_d": sanitize_str(exp_d),
        }]
    return []


def parse_pdf_to_questions(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Ultra-resilient Parser with natural reading order, color, bold, and explicit answer detection."""
    try:
        text = extract_rich_text_from_pdf(pdf_bytes)
        if not text or not text.strip():
            text = extract_text_from_pdf_pypdf(pdf_bytes)
    except Exception:
        text = extract_text_from_pdf_pypdf(pdf_bytes)

    if not text or not text.strip():
        return []

    normalized = re.sub(r'\r\n', '\n', text)
    normalized = re.sub(r'\t', ' ', normalized)
    normalized = sanitize_str(normalized)

    # Detect global answer keys
    global_answers = {}
    ans_section = re.search(
        r'(?:BẢNG\s*ĐÁP\s*ÁN|BẢNG\s*TRẢ\s*LỜI|ĐÁP\s*ÁN\s*ĐỀ\s*THI|BẢNG\s*KEY|ANSWER\s*KEY|HƯỚNG\s*DẪN\s*CHẤM)[\s\:\-]+([\s\S]+?)(?=\n\s*(?:BÀI|CHƯƠNG|CÂU|Question|\Z))',
        normalized,
        re.IGNORECASE
    )
    if ans_section:
        ans_matches = re.findall(r'(?:^|\s|\n|[\|\,\;])(\d{1,4})\s*[\.\:\-\)\/]?\s*([A-Da-d])(?:\s|\n|[\|\,\;]|$)', ans_section.group(1))
        for num_str, opt_letter in ans_matches:
            try:
                num = int(num_str)
                if 1 <= num <= 2000:
                    global_answers[num] = opt_letter.upper()
            except:
                pass

    # Split document into segments or questions
    split_pattern = r'(?:\n|^)\s*(?=(?:(?:Câu|CÂU|câu|Question|QUESTION|Bài|BÀI|Task|Ex|Q\.?|CÂU\s*HỎI|Câu\s*hỏi|Bài\s*tập|BT)\s*\d+|\b\d{1,4}[\.\)\:\-\/]\s*|(?:BÀI|CHƯƠNG|PHẦN|CHỦ ĐỀ|TIẾT|HỌC\s*PHẦN|MODULE)\s*[0-9IVXLCDMivxlcdm]+))'
    blocks = re.split(split_pattern, normalized, flags=re.IGNORECASE)

    current_chapter = "Bài 1"
    questions = []

    chapter_header_rx = re.compile(
        r'(?:^|\n)\s*(BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*([0-9IVXLCDMivxlcdm]+)(?:[\s\:\.\-\–\—]*([^\n]*))',
        re.IGNORECASE
    )

    for raw_block in blocks:
        block = raw_block.strip()
        if not block or len(block) < 8:
            continue

        # Check if block updates chapter title
        ch_match = chapter_header_rx.search(block)
        if ch_match:
            kw_name = ch_match.group(1).capitalize()
            kw_num = ch_match.group(2)
            rest_title = (ch_match.group(3) or "").strip(' :.-–—\t')
            if rest_title:
                current_chapter = f"{kw_name} {kw_num}: {rest_title}"
            else:
                current_chapter = f"{kw_name} {kw_num}"
            current_chapter = clean_inline_text(current_chapter)[:120]

        parsed = parse_single_block(block, default_chapter=current_chapter, global_answers=global_answers)
        if parsed:
            questions.extend(parsed)

    return questions
