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

                        # Detect highlight colors (Yellow, Lime Green, Cyan, Orange, Pink)
                        is_yellow = (fr > 160 and fg > 160 and fb < 160)
                        is_green = (fg > 150 and fr < 160 and fb < 170)
                        is_cyan = (fb > 160 and fg > 150 and fr < 160)
                        is_orange = (fr > 190 and fg > 90 and fb < 110)
                        is_pink = (fr > 190 and fb > 140 and fg < 180)
                        is_highlight_color = is_yellow or is_green or is_cyan or is_orange or is_pink

                        d_rect = draw.get("rect")
                        if is_highlight_color and d_rect and d_rect.width > 4 and d_rect.height > 4:
                            # Exclude full-page backgrounds
                            if d_rect.width < page_w * 0.9 or d_rect.height < page_h * 0.9:
                                highlight_rects.append(pymupdf.Rect(d_rect))
            except Exception:
                pass

            # 3. Render Pixmap for pixel-level visual highlight verification
            pix = None
            scale_x = 1.0
            scale_y = 1.0
            try:
                pix = page.get_pixmap(dpi=120)
                scale_x = pix.width / max(1.0, page_w)
                scale_y = pix.height / max(1.0, page_h)
            except Exception:
                pix = None

            page_dict = page.get_text("dict")
            blocks = [b for b in page_dict.get("blocks", []) if "lines" in b]

            # 4. Multi-column Layout Detection (e.g. 2-column slides / exam papers)
            mid_x = page_w * 0.48
            col1_blocks = [b for b in blocks if b["bbox"][0] < mid_x and b["bbox"][2] <= page_w * 0.65]
            col2_blocks = [b for b in blocks if b["bbox"][0] >= mid_x * 0.75]
            header_blocks = [b for b in blocks if b not in col1_blocks and b not in col2_blocks]

            if len(col1_blocks) >= 2 and len(col2_blocks) >= 2:
                # 2-column page: Header first, then Left column (top-to-bottom), then Right column (top-to-bottom)
                sorted_blocks = (
                    sorted(header_blocks, key=lambda b: b["bbox"][1]) +
                    sorted(col1_blocks, key=lambda b: (b["bbox"][1], b["bbox"][0])) +
                    sorted(col2_blocks, key=lambda b: (b["bbox"][1], b["bbox"][0]))
                )
            else:
                sorted_blocks = sorted(blocks, key=lambda b: (b["bbox"][1], b["bbox"][0]))

            page_lines = []
            for block in sorted_blocks:
                for line in block["lines"]:
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

                        # Distinct Red, Green, Blue text
                        is_red = (r > 130 and g < 110 and b < 110)
                        is_green = (g > 130 and r < 110 and b < 120)
                        is_blue = (b > 150 and r < 110 and g < 140)
                        is_colored = is_red or is_green or is_blue or (max(r, g, b) - min(r, g, b) > 60 and max(r, g, b) > 90)

                        # Check if span is covered by any Vector/Annotation Highlight rectangle
                        is_under_highlight = False
                        span_rect = pymupdf.Rect(span.get("bbox", [0, 0, 0, 0]))
                        if not span_rect.is_empty and highlight_rects:
                            span_area = span_rect.get_area()
                            for hr in highlight_rects:
                                intersect = span_rect & hr
                                if not intersect.is_empty and (span_area <= 0 or (intersect.get_area() / max(1.0, span_area) > 0.15)):
                                    is_under_highlight = True
                                    break

                        # Check pixel sampling if not yet detected as highlighted
                        if not is_under_highlight and pix and not span_rect.is_empty:
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


def sanitize_str(s: Any) -> str:
    """Removes NUL bytes (0x00) and unprintable C0 control characters to prevent PostgreSQL insertion errors."""
    if not s:
        return ""
    if not isinstance(s, str):
        s = str(s)
    s = s.replace('\x00', '').replace('\u0000', '')
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
    return s


def clean_text(s: str) -> str:
    if not s:
        return ""
    s = sanitize_str(s)
    s = re.sub(r'\[(?:COLOR_MARK|BOLD_MARK|ITALIC_MARK)\]', '', s)
    return re.sub(r'[\r\n\t]+', ' ', s).strip()


def parse_pdf_to_questions(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Ultra-resilient Parser with color, bold, italic, and checkmark answer detection."""
    text = extract_rich_text_from_pdf(pdf_bytes)
    if not text or not text.strip():
        return []

    normalized = re.sub(r'\r\n', '\n', text)
    normalized = re.sub(r'\t', ' ', normalized)
    normalized = sanitize_str(normalized)

    # Detect global answer keys ONLY in explicit answer sections
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

    # Regex to match Chapter / Lesson headers (e.g. Bài 1, Bài 2, Chương I, Phần 1, Chủ đề 1, Tiết 1, Module 1...)
    chapter_header_rx = re.compile(
        r'(?:^|\n)\s*(BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*([0-9IVXLCDMivxlcdm]+)(?:[\s\:\.\-\–\—]*([^\n]*))',
        re.IGNORECASE
    )

    # Split document into segments or questions
    split_pattern = r'\n(?=(?:(?:Câu|CÂU|Question|Bài|BAI)\s*\d+|\b\d{1,4}[\.\)]\s+[A-Z\u00C0-\u1EF9\(a-z]|(?:BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*[0-9IVXLCDMivxlcdm]+))'
    blocks = re.split(split_pattern, '\n' + normalized, flags=re.IGNORECASE)

    current_chapter = "Bài 1"
    questions = []
    q_counter = 0

    for raw_block in blocks:
        block = raw_block.strip()
        if not block or len(block) < 8:
            continue

        # Check if block has Chapter / Lesson title
        ch_match = chapter_header_rx.search(block)
        if ch_match:
            kw_name = ch_match.group(1).capitalize()
            kw_num = ch_match.group(2)
            rest_title = (ch_match.group(3) or "").strip(' :.-–—\t')
            
            lines_in_block = block.split('\n')
            if not rest_title and len(lines_in_block) > 1:
                for line_cand in lines_in_block[1:3]:
                    line_cand_s = line_cand.strip()
                    if line_cand_s and not re.match(r'^(?:(?:Câu|CÂU|Question)\s*\d+|\b\d{1,4}[\.\)]|[A-D][\.\)])', line_cand_s, re.IGNORECASE):
                        rest_title = line_cand_s
                        break

            if rest_title:
                current_chapter = f"{kw_name} {kw_num}: {rest_title}"
            else:
                current_chapter = f"{kw_name} {kw_num}"
            current_chapter = clean_text(current_chapter)[:120]

        # Verify block has options A, B, C (and optionally D)
        has_a = re.search(r'(?:^|\n|\s)[A][\.\)\:\-\/]\s*|(?:\n|\s)\(A\)\s*', block)
        has_b = re.search(r'(?:^|\n|\s)[B][\.\)\:\-\/]\s*|(?:\n|\s)\(B\)\s*', block)
        has_c = re.search(r'(?:^|\n|\s)[C][\.\)\:\-\/]\s*|(?:\n|\s)\(C\)\s*', block)
        has_d = re.search(r'(?:^|\n|\s)[D][\.\)\:\-\/]\s*|(?:\n|\s)\(D\)\s*', block)

        if not has_a or not has_b:
            has_a = re.search(r'(?:^|\n|\s)[a][\.\)\:\-\/]\s*', block)
            has_b = re.search(r'(?:^|\n|\s)[b][\.\)\:\-\/]\s*', block)
            has_c = re.search(r'(?:^|\n|\s)[c][\.\)\:\-\/]\s*', block)
            has_d = re.search(r'(?:^|\n|\s)[d][\.\)\:\-\/]\s*', block)

        # Fallback for slides with repeated option labels or 3 options
        if not (has_a and has_b):
            continue

        q_start = re.match(r'^(?:(?:Câu|CÂU|Question|Bài)\s*)?(\d{1,4})[\s\:\.\-\)]*', block, flags=re.IGNORECASE)
        q_counter += 1
        q_num = int(q_start.group(1)) if (q_start and q_start.group(1)) else q_counter

        # Extract Question Content
        content_raw = block[:has_a.start()].strip()
        content_lines = [
            l for l in content_raw.split('\n')
            if not re.match(r'^\s*(?:TRẮC\s*NGHIỆM|BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*[0-9IVXLCDMivxlcdm]*', l.strip(), re.IGNORECASE)
        ]
        content = '\n'.join(content_lines).strip()
        content = re.sub(r'^(?:(?:Câu|CÂU|Question|Bài)\s*)?\d{1,4}[\s\:\.\-\)]*', '', content, flags=re.IGNORECASE).strip()
        content = clean_text(content)
        if not content:
            content = clean_text(content_raw)

        # Detect explicit answers and explanation labels
        ans_match = re.search(r'(?:Đáp án đúng|Đáp án|ĐÁP ÁN|Key|Answer|Đ/a|ĐA)[:\s]+(?:[✓✔\s]*)([A-D])\b', block, flags=re.IGNORECASE)
        exp_match = re.search(r'(?:\[\]\s*)?(?:Giải thích|GIẢI THÍCH|Lý do|Explanation|HDG)[:\s]+(.*)', block, flags=re.IGNORECASE | re.DOTALL)
        general_exp = clean_text(exp_match.group(1)) if exp_match else ""

        # Option boundaries
        end_boundary = ans_match.start() if ans_match else (exp_match.start() if exp_match else len(block))

        if has_a and has_b and has_c and has_d:
            opt_a_raw = block[has_a.end():has_b.start()]
            opt_b_raw = block[has_b.end():has_c.start()]
            opt_c_raw = block[has_c.end():has_d.start()]
            opt_d_raw = block[has_d.end():end_boundary]
        elif has_a and has_b and has_c and not has_d:
            # 3-option question
            opt_a_raw = block[has_a.end():has_b.start()]
            opt_b_raw = block[has_b.end():has_c.start()]
            opt_c_raw = block[has_c.end():end_boundary]
            opt_d_raw = "Tất cả các đáp án trên đều sai"
        else:
            opt_a_raw = block[has_a.end():has_b.start()]
            opt_b_raw = block[has_b.end():end_boundary]
            opt_c_raw = "Không có phương án phù hợp"
            opt_d_raw = "Tất cả các đáp án trên đều sai"

        # Check for Colored / Yellow Highlighted Text (via [COLOR_MARK])
        colored_opts = [key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)] if '[COLOR_MARK]' in r]
        
        # Check for Bold Text
        bold_opts = [key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)] if '[BOLD_MARK]' in r]

        # Check for Italic Text
        italic_opts = [key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)] if '[ITALIC_MARK]' in r]

        # Check for Checkmarks / True indicators
        checkmark_opts = [
            key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)]
            if re.search(r'[✓✔☑]|(?:\s*[\(\[]?(?:đúng|dung|chính xác|correct|true)[\)\]]?\s*$)', clean_text(r), re.IGNORECASE)
        ]

        def clean_opt(s: str) -> str:
            cleaned = clean_text(s)
            cleaned = re.sub(r'[✓✔☑]', '', cleaned).strip()
            cleaned = re.sub(r'\s*[\(\[]?(?:đúng|dung|chính xác|correct|true)[\)\]]?\s*$', '', cleaned, flags=re.IGNORECASE).strip()
            return cleaned

        opt_a = clean_opt(opt_a_raw)
        opt_b = clean_opt(opt_b_raw)
        opt_c = clean_opt(opt_c_raw)
        opt_d = clean_opt(opt_d_raw)

        # Detect target answer mentioned inside explanation text
        exp_target_match = None
        if general_exp:
            exp_ans_search = re.search(r'(?:đáp án|chọn|kết quả|phương án)[\s\:\(a-zA-Zđềthichínhthức]*([A-D])\b', general_exp, re.IGNORECASE)
            if exp_ans_search:
                exp_target_match = exp_ans_search.group(1).upper()

        # Resolve correct answer priority:
        # 1. Option highlighted in YELLOW / RED / DISTINCT COLOR
        # 2. Option with Checkmark ✓ / ✔ / [x]
        # 3. Explicit "Đáp án: A"
        # 4. Single Bolded Option
        # 5. Single Italicized Option
        # 6. Explanation text mentions target answer
        # 7. Global Answer table
        if len(colored_opts) == 1:
            correct_answer = colored_opts[0]
        elif len(colored_opts) > 1:
            correct_answer = colored_opts[0]
        elif len(checkmark_opts) == 1:
            correct_answer = checkmark_opts[0]
        elif ans_match:
            correct_answer = ans_match.group(1).upper()
        elif len(bold_opts) == 1:
            correct_answer = bold_opts[0]
        elif len(italic_opts) == 1:
            correct_answer = italic_opts[0]
        elif exp_target_match:
            correct_answer = exp_target_match
        elif q_num in global_answers:
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
                reasoning = _heuristic_reasoning_engine(content, opt_a, opt_b, opt_c, opt_d, correct_answer)
                exp_a = reasoning["explanation_a"]
                exp_b = reasoning["explanation_b"]
                exp_c = reasoning["explanation_c"]
                exp_d = reasoning["explanation_d"]

            questions.append({
                "chapter": sanitize_str(current_chapter),
                "content": sanitize_str(content),
                "option_a": sanitize_str(opt_a),
                "option_b": sanitize_str(opt_b),
                "option_c": sanitize_str(opt_c),
                "option_d": sanitize_str(opt_d),
                "correct_answer": sanitize_str(correct_answer),
                "explanation_a": sanitize_str(exp_a),
                "explanation_b": sanitize_str(exp_b),
                "explanation_c": sanitize_str(exp_c),
                "explanation_d": sanitize_str(exp_d),
            })

    return questions
