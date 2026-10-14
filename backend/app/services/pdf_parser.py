import io
import re
import json
import logging
import unicodedata
from typing import List, Dict, Any
from pypdf import PdfReader
import os
import uuid
from ..config import settings
from .ai_service import _heuristic_reasoning_engine, parse_exam_with_gemini, parse_exam_with_gemini_vision
from .docx_parser import extract_rich_text_from_docx

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "questions")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def sanitize_str(s: Any) -> str:
    """Removes NUL bytes (0x00) and unprintable C0 control characters to prevent PostgreSQL insertion errors."""
    if not s:
        return ""
    if not isinstance(s, str):
        s = str(s)
    s = s.replace('\x00', '').replace('\u0000', '')
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
    return s


def clean_math_glyphs(s: str) -> str:
    """
    Cleans font encoding glitches commonly found in MathType / Symbol font PDF exports:
    - '≡≡ S t ≡≡' -> '$S(t)$'
    - '≡≡ 60 S t t ⯐' -> '$S = 60t$'
    - '3 V x ≡' -> '$V = x^3$'
    - Replaces box characters with empty strings or spaces.
    """
    if not s:
        return ""
    # Strip PUA box characters (MathType empty slots / bullet glitches)
    s = re.sub(r'[\u2bef\u25b0\u25a0\u25a1\uf000-\uf8ff\u25fb-\u25fe⯐]', '', s)

    # Scrambled MathType formula patterns (e.g. 60 S t t -> S = 60t)
    s = re.sub(r'≡≡\s*(\d+)\s*([A-Za-z])\s+([A-Za-z])(?:\s+[A-Za-z])?\s*≡*', r'$\2 = \1\3$', s)
    s = re.sub(r'≡≡\s*([A-Za-z])\s+([A-Za-z])\s*≡≡', r'$\1(\2)$', s)
    s = re.sub(r'≡≡\s*([^≡\n]+?)\s*≡≡', r'$\1$', s)
    s = s.replace('≡≡', '')

    # Scrambled power formula (e.g. '3 V x ≡' -> 'V = x^3')
    s = re.sub(r'\b(\d+)\s+([A-Z])\s+([a-z])\s*≡', r'$\2 = \3^\1$', s)
    s = re.sub(r'Công thức\s+(\d+)\s+([A-Z])\s+([a-z])\s*≡', r'Công thức $\2 = \3^\1$', s)

    # Isolated ≡ in math expressions -> =
    s = re.sub(r'(?<=[a-zA-Z0-9\$\)])\s*≡\s*(?=[a-zA-Z0-9\$\-])', ' = ', s)
    s = re.sub(r'\s*≡\s*', ' = ', s)
    return s


def clean_inline_text(s: str) -> str:
    """Cleans inline text (such as chapter title, options, answers) into a clean single-line string."""
    if not s:
        return ""
    s = sanitize_str(s)
    s = clean_math_glyphs(s)
    s = re.sub(r'\[(?:COLOR_MARK|BOLD_MARK|ITALIC_MARK)\]', '', s)
    s = re.sub(r'\[IMAGE_URL:\s*[^\]]+\]', '', s)
    return re.sub(r'[\r\n\t]+', ' ', s).strip()


def clean_content_text(s: str) -> str:
    """
    Cleans question content while preserving indentation and line breaks for code blocks.
    Removes markup markers and excessive consecutive empty lines.
    """
    if not s:
        return ""
    s = sanitize_str(s)
    s = clean_math_glyphs(s)
    s = re.sub(r'\[(?:COLOR_MARK|BOLD_MARK|ITALIC_MARK)\]', '', s)
    s = re.sub(r'\[IMAGE_URL:\s*[^\]]+\]', '', s)
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


PUA_MATH_MAP = {
    '\uf03d': '=',
    '\uf02d': '-',
    '\uf02b': '+',
    '\uf028': '(',
    '\uf029': ')',
    '\uf0b5': '^',
    '\uf044': r'\Delta ',
    '\uf0b9': r'\neq ',
    '\uf061': r'\alpha ',
    '\uf0e6': '(',
    '\uf0f6': ')',
    '\uf0e7': '(',
    '\uf0f7': ')',
    '\uf0e8': '(',
    '\uf0f8': ')',
    '\uf0e9': '[',
    '\uf0f9': ']',
    '\uf0ea': '{',
    '\uf0fa': '}',
    '\uf0eb': '{',
    '\uf0fb': '}',
    '\uf0ce': r'\in ',
    '\uf0d7': r'\times ',
    '\uf03c': '<',
    '\uf03e': '>',
    '\uf0a3': r'\le ',
    '\uf0bb': r'\approx ',
    '\uf05e': '^',
    '\uf07b': '{',
    '\uf07d': '}',
    '\uf0b3': r'\ge ',
    '\uf0a2': r'\le ',
    '\uf0b1': r'\pm ',
    '\uf0b0': r'^{\circ}',
    '\uf02a': '*',
    '\uf02f': '/',
    '\uf0b4': r'\times ',
    '\uf0b8': r'\div ',
    '\uf0c6': r'\varnothing ',
    '\uf0cc': r'\subset ',
    '\uf0cd': r'\supset ',
    '\uf0c8': r'\cup ',
    '\uf0c7': r'\cap ',
    '\uf022': '"',
    '\uf027': "'",
}


def clean_span_text(text: str) -> str:
    """Translates private-use-area (PUA) symbol/MathType glyphs into standard LaTeX/Unicode."""
    for pua, repl in PUA_MATH_MAP.items():
        if pua in text:
            text = text.replace(pua, repl)
    return text


def clean_math_spacing(s: str) -> str:
    """Cleans up spaces around math exponents, variables, fractions, and operators."""
    s = re.sub(r'([a-zA-Z0-9])\s+([\^_]\{)', r'\1\2', s)
    s = re.sub(r'(\^\{[^\}]+\})\s*([a-zA-Z])', r'\1\2', s)
    s = re.sub(r'(_\{[^\}]+\})\s*([a-zA-Z])', r'\1\2', s)
    s = re.sub(r'(\b\d+)\s+([a-zA-Z])', r'\1\2', s)
    s = re.sub(r'([+\-])\s+(\d)', r'\1\2', s)
    s = re.sub(r'^\s*[\.\,\;\:\-]+\s*', '', s)
    s = re.sub(r'\s*[\.\,\;\:\-]+$', '', s)
    s = re.sub(r'\s{2,}', ' ', s)
    return s.strip()


def extract_rich_text_from_pdf(pdf_bytes: bytes, max_pages: int = 500) -> str:
    """
    High-fidelity geometric line-reconstruction parser for PDFs:
    1. Reconstructs inline MathType / Word Equation layers by horizontal X-coordinate sorting within Y-lines.
    2. Maps MathType / Symbol Font PUA characters into proper math symbols (+, -, =, \\Delta, etc.).
    3. Detects vector horizontal fraction bars and radicals, synthesizing \\frac{num}{den} and \\sqrt{...}.
    4. Detects superscripts and subscripts based on relative font size and vertical offset.
    5. Extracts diagram images and positions them precisely between the question and options.
    6. Employs true two-column detection (requiring question headers in both columns to prevent false splits).
    7. Retains [COLOR_MARK] for colored answers and [BOLD_MARK] / [ITALIC_MARK] styling.
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
            mid_x = page_w * 0.5

            # 1. Collect all Highlight Annotations
            highlight_rects = []
            try:
                for annot in page.annots():
                    if annot.rect:
                        highlight_rects.append(pymupdf.Rect(annot.rect))
            except Exception:
                pass

            # 2. Collect all Vector Drawing Fills (e.g. Yellow text highlights)
            drawings = []
            try:
                drawings = page.get_drawings()
                for draw in drawings:
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

            # 3. Collect Raw Spans
            text_dict = page.get_text("dict", flags=pymupdf.TEXTFLAGS_SEARCH)
            raw_spans = []
            for b in text_dict.get("blocks", []):
                if "lines" not in b:
                    continue
                for l in b["lines"]:
                    for s in l["spans"]:
                        txt = s.get("text", "")
                        if not txt:
                            continue
                        txt = clean_span_text(txt)
                        if not txt.strip():
                            continue
                        raw_spans.append({
                            "bbox": s["bbox"],
                            "text": txt,
                            "font": s.get("font", ""),
                            "size": s.get("size", 12.0),
                            "color": s.get("color", 0),
                            "flags": s.get("flags", 0),
                            "y_mid": (s["bbox"][1] + s["bbox"][3]) / 2.0,
                            "x0": s["bbox"][0],
                            "x1": s["bbox"][2]
                        })

            # 4. Check for True Two-Column Question Layout
            left_q = sum(1 for s in raw_spans if s["x0"] < mid_x - 20 and re.match(r'^(?:Câu|Bài|Question)\s*\d+[\.\:\-]', s["text"].strip(), re.I))
            right_q = sum(1 for s in raw_spans if s["x0"] >= mid_x - 20 and re.match(r'^(?:Câu|Bài|Question)\s*\d+[\.\:\-]', s["text"].strip(), re.I))
            is_two_col = (left_q >= 2 and right_q >= 2)

            # 5. Extract Drawings: Fraction Bars and Radicals
            frac_lines = []
            radicals = []
            for dr in drawings:
                r = dr.get("rect")
                if not r:
                    continue
                if (r.x1 - r.x0) >= 4 and (r.y1 - r.y0) <= 2.5:
                    frac_lines.append(r)
                elif (r.x1 - r.x0) >= 4 and (r.y1 - r.y0) >= 4:
                    radicals.append(r)

            # Fold numerator & denominator spans around fraction bars
            consumed_spans = set()
            fraction_spans = []
            for fl in frac_lines:
                def is_inside(s):
                    mid_pt = (s["x0"] + s["x1"]) / 2.0
                    return (fl.x0 - 2.5 <= mid_pt <= fl.x1 + 2.5)

                num_cand = [i for i, s in enumerate(raw_spans) if i not in consumed_spans and fl.y0 - 16 <= s["y_mid"] < fl.y0 and is_inside(s)]
                den_cand = [i for i, s in enumerate(raw_spans) if i not in consumed_spans and fl.y0 < s["y_mid"] <= fl.y0 + 16 and is_inside(s)]

                if num_cand and den_cand:
                    num_spans = [raw_spans[i] for i in sorted(num_cand, key=lambda idx: raw_spans[idx]["x0"])]
                    den_spans = [raw_spans[i] for i in sorted(den_cand, key=lambda idx: raw_spans[idx]["x0"])]

                    num_txt = "".join(s["text"] for s in num_spans).strip()
                    den_txt = "".join(s["text"] for s in den_spans).strip()
                    num_txt = re.sub(r'^\.+|\.+$', '', num_txt).strip()
                    den_txt = re.sub(r'^\.+|\.+$', '', den_txt).strip()

                    # Check if covered by radical
                    is_sqrt = False
                    for rad in radicals:
                        if not (rad.x1 < fl.x0 - 2 or rad.x0 > fl.x1 + 2) and (rad.y0 <= fl.y0):
                            is_sqrt = True
                            break
                    if is_sqrt and not num_txt.startswith(r'\sqrt'):
                        num_txt = f"\\sqrt{{{num_txt}}}"

                    for idx in num_cand + den_cand:
                        consumed_spans.add(idx)

                    fraction_spans.append({
                        "bbox": [fl.x0, fl.y0 - 2, fl.x1, fl.y0 + 2],
                        "text": f"\\frac{{{num_txt}}}{{{den_txt}}}",
                        "font": "Math",
                        "size": 12.0,
                        "color": 0,
                        "flags": 0,
                        "y_mid": fl.y0,
                        "x0": fl.x0,
                        "x1": fl.x1
                    })

            # 6. Extract Images and Place Geometrically
            image_spans = []
            try:
                for img_info in page.get_images():
                    xref = img_info[0]
                    rects = page.get_image_rects(xref)
                    if not rects:
                        continue
                    img_rect = rects[0]
                    base_img = doc.extract_image(xref)
                    img_w = base_img.get("width", 0)
                    img_h = base_img.get("height", 0)
                    if img_w >= 50 and img_h >= 50:
                        img_bytes = base_img.get("image")
                        img_ext = base_img.get("ext", "png")
                        if img_bytes:
                            unique_name = f"pdf_{uuid.uuid4().hex[:12]}.{img_ext}"
                            file_path = os.path.join(UPLOAD_DIR, unique_name)
                            with open(file_path, "wb") as f_out:
                                f_out.write(img_bytes)
                            img_url = f"/uploads/questions/{unique_name}"
                            image_spans.append({
                                "bbox": [img_rect.x0, img_rect.y0, img_rect.x1, img_rect.y1],
                                "text": f"\n[IMAGE_URL: {img_url}]\n",
                                "font": "Image",
                                "size": 12.0,
                                "color": 0,
                                "flags": 0,
                                "y_mid": (img_rect.y0 + img_rect.y1) / 2.0,
                                "x0": img_rect.x0,
                                "x1": img_rect.x1
                            })
            except Exception as img_err:
                logger.warning(f"Error extracting image on page {page_idx}: {img_err}")

            active_spans = [s for i, s in enumerate(raw_spans) if i not in consumed_spans] + fraction_spans + image_spans

            # 7. Divide into Columns
            columns = []
            if is_two_col:
                columns.append([s for s in active_spans if s["x0"] < mid_x])
                columns.append([s for s in active_spans if s["x0"] >= mid_x])
            else:
                columns.append(active_spans)

            page_lines = []
            for col_spans in columns:
                if not col_spans:
                    continue
                col_spans.sort(key=lambda s: s["y_mid"])

                # Cluster into horizontal lines
                lines = []
                curr_line = []
                curr_y = None
                for span in col_spans:
                    if curr_y is None or abs(span["y_mid"] - curr_y) <= 4.0:
                        curr_line.append(span)
                        curr_y = sum(s["y_mid"] for s in curr_line) / len(curr_line)
                    else:
                        lines.append(curr_line)
                        curr_line = [span]
                        curr_y = span["y_mid"]
                if curr_line:
                    lines.append(curr_line)

                for line in lines:
                    line.sort(key=lambda s: s["x0"])
                    y_pos = sum(s["y_mid"] for s in line) / len(line)
                    sizes = [s["size"] for s in line if s["font"] not in ("Math", "Image")]
                    base_size = max(sizes) if sizes else 12.0

                    out_parts = []
                    for s in line:
                        txt = s["text"]
                        if s["font"] == "Image":
                            out_parts.append(txt)
                            continue

                        color = s["color"]
                        r = (color >> 16) & 255
                        g = (color >> 8) & 255
                        b = color & 255
                        is_red = (r > 130 and g < 110 and b < 110)
                        is_green = (g > 130 and r < 110 and b < 120)
                        is_blue = (b > 150 and r < 110 and g < 140)
                        is_colored = is_red or is_green or is_blue or (max(r, g, b) - min(r, g, b) > 60 and max(r, g, b) > 90)

                        is_under_highlight = False
                        span_rect = pymupdf.Rect(s["bbox"])
                        if not span_rect.is_empty and highlight_rects:
                            span_area = span_rect.get_area()
                            for hr in highlight_rects:
                                intersect = span_rect & hr
                                if not intersect.is_empty and (span_area <= 0 or (intersect.get_area() / max(1.0, span_area) > 0.15)):
                                    is_under_highlight = True
                                    break

                        font_lower = s["font"].lower()
                        flags = s["flags"]
                        is_bold = ("bold" in font_lower or "black" in font_lower or "heavy" in font_lower or (flags & 2 != 0) or (flags & 16 != 0))
                        is_italic = ("italic" in font_lower or "oblique" in font_lower or (flags & 1 != 0))

                        # Detect superscript / subscript
                        if s["size"] < base_size * 0.82 and s["font"] != "Math":
                            clean_t = txt.strip()
                            if s["y_mid"] < y_pos - 1.0:
                                txt = f"^{{{clean_t}}}"
                            elif s["y_mid"] > y_pos + 1.0:
                                txt = f"_{{{clean_t}}}"

                        if is_under_highlight or is_colored:
                            txt = f"{txt} [COLOR_MARK]"
                        elif is_bold:
                            txt = f"{txt} [BOLD_MARK]"
                        elif is_italic:
                            txt = f"{txt} [ITALIC_MARK]"

                        out_parts.append(txt)

                    line_text = ""
                    for p in out_parts:
                        if line_text and not line_text.endswith(" ") and not p.startswith(" ") and not p.startswith("^") and not p.startswith("_"):
                            line_text += " "
                        line_text += p
                    if line_text.strip():
                        page_lines.append(line_text)

            full_text.append("\n".join(page_lines))

        raw = "\n\n".join(full_text)
        return unicodedata.normalize('NFC', sanitize_str(raw))
    except Exception as e:
        logger.warning(f"PyMuPDF rich extraction failed ({e}), falling back to pypdf.")
        return extract_text_from_pdf_pypdf(pdf_bytes, max_pages)


def find_option_markers(block: str):
    """
    Finds ordered positions of options A, B, C, D (or lowercase a, b, c, d).
    Supports decorated marks: A [COLOR_MARK] ., A. [COLOR_MARK], [COLOR_MARK] A., (A), [A], A.
    """
    def search_letter(letter: str, start_pos: int = 0):
        low = letter.lower()
        up = letter.upper()
        pat = rf'(?:^|\s|\n)(?:\[(?:COLOR|BOLD|ITALIC)_MARK\]\s*)?(?:\(?\[?{up}\]?(?:\s*\[(?:COLOR|BOLD|ITALIC)_MARK\])?\s*[\.\)\:\-]|(?:\({up}\)|\[{up}\]))\s*(?:\[(?:COLOR|BOLD|ITALIC)_MARK\]\s*)?'
        m = re.search(pat, block[start_pos:])
        if m:
            abs_start = start_pos + m.start()
            abs_end = start_pos + m.end()
            match_str = m.group(0)
            is_colored = '[COLOR_MARK]' in match_str
            is_bold = '[BOLD_MARK]' in match_str
            is_italic = '[ITALIC_MARK]' in match_str
            return {
                "start": abs_start,
                "end": abs_end,
                "letter": up,
                "is_colored": is_colored,
                "is_bold": is_bold,
                "is_italic": is_italic,
            }
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

    colored_opts = [key for key, m in [('A', mA), ('B', mB), ('C', mC), ('D', mD)] if m and m.get('is_colored')]
    for key, raw in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)]:
        if '[COLOR_MARK]' in raw and key not in colored_opts:
            colored_opts.append(key)

    bold_opts = [key for key, m in [('A', mA), ('B', mB), ('C', mC), ('D', mD)] if m and m.get('is_bold')]
    for key, raw in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)]:
        if '[BOLD_MARK]' in raw and key not in bold_opts:
            bold_opts.append(key)

    italic_opts = [key for key, m in [('A', mA), ('B', mB), ('C', mC), ('D', mD)] if m and m.get('is_italic')]
    for key, raw in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)]:
        if '[ITALIC_MARK]' in raw and key not in italic_opts:
            italic_opts.append(key)

    checkmark_opts = [
        key for key, r in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)]
        if re.search(r'[✓✔☑\*]|\s+[\(\[](?:đúng|dung|chính xác|correct|true)[\)\]]\s*$', clean_inline_text(r), re.IGNORECASE)
    ]

    def clean_opt(s: str) -> str:
        cleaned = clean_inline_text(s)
        cleaned = clean_math_spacing(cleaned)
        cleaned = re.sub(r'^[✓✔☑\*\s]+', '', cleaned).strip()
        cleaned = re.sub(r'[✓✔☑\*]+$', '', cleaned).strip()
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

        img_match = re.search(r'\[IMAGE_URL:\s*([^\]]+)\]', block)
        detected_img_url = img_match.group(1).strip() if img_match else None


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
            "image_url": detected_img_url,
        }]
    return []


def parse_pdf_to_questions(pdf_bytes: bytes, ai_deep_scan: bool = False, default_chapter: str = "Bài 1") -> List[Dict[str, Any]]:
    """Backward-compatible wrapper for PDF parsing."""
    return parse_document_to_questions(pdf_bytes, filename="document.pdf", ai_deep_scan=ai_deep_scan, default_chapter=default_chapter)


def parse_document_to_questions(
    file_bytes: bytes,
    filename: str,
    ai_deep_scan: bool = False,
    default_chapter: str = "Bài 1"
) -> List[Dict[str, Any]]:
    """
    Universal Multi-Format Exam Parser (PDF, DOCX, TXT, MD) with AI Deep Scan fallback.
    - Tier 1: High-Speed Regex & Rich Color/Format Extractor
    - Tier 2: Intelligent Gemini 1.5 Flash Vision & Document Extraction
    """
    low_name = filename.lower()
    text = ""

    # 1. Extract raw/rich text based on format
    if low_name.endswith(".docx"):
        text = extract_rich_text_from_docx(file_bytes)
    elif low_name.endswith(".pdf"):
        try:
            text = extract_rich_text_from_pdf(file_bytes)
            if not text or not text.strip():
                text = extract_text_from_pdf_pypdf(file_bytes)
        except Exception:
            text = extract_text_from_pdf_pypdf(file_bytes)
    else:
        # Plain text / Markdown
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            text = str(file_bytes)

    if not text or not text.strip():
        return []

    # 2. If AI Deep Scan explicitly requested, run Gemini Vision for PDF (high-fidelity math & visual)
    if ai_deep_scan:
        logger.info(f"Running AI Deep Scan for {filename}...")
        if low_name.endswith(".pdf"):
            vision_questions = parse_exam_with_gemini_vision(file_bytes, default_chapter=default_chapter)
            if vision_questions and len(vision_questions) > 0:
                logger.info(f"Gemini Vision successfully parsed {len(vision_questions)} questions from {filename}")
                return vision_questions
        ai_questions = parse_exam_with_gemini(text, default_chapter=default_chapter)
        if ai_questions and len(ai_questions) > 0:
            return ai_questions

    # 3. Standard Rule & Regex Parsing
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

    # Split document into segments or questions (requires punctuation after number to avoid matching math values)
    split_pattern = r'(?:\n|^)\s*(?=(?:(?:Câu|CÂU|câu|Question|QUESTION|Bài|BÀI|Task|Ex|Q\.?|CÂU\s*HỎI|Câu\s*hỏi|Bài\s*tập|BT)\s*\d+[\.\:\-\)\/]|(?:BÀI|CHƯƠNG|PHẦN|CHỦ ĐỀ|TIẾT|HỌC\s*PHẦN|MODULE)\s*[0-9IVXLCDMivxlcdm]+|\b\d{1,4}\s*[\.\)\:\-\/]\s+(?=[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ])))'
    blocks = re.split(split_pattern, normalized, flags=re.IGNORECASE)

    current_chapter = default_chapter
    questions = []

    chapter_header_rx = re.compile(
        r'(?:^|\n)\s*(BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*([0-9IVXLCDMivxlcdm]+)(?:[\s\:\.\-\–\—]*([^\n]*))',
        re.IGNORECASE
    )

    for raw_block in blocks:
        block = raw_block.strip()
        if not block or len(block) < 8:
            continue

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

    # 4. Intelligent Fallback: If Regex produced 0 questions (e.g. unconventional layout or scanned), fall back to Gemini
    if len(questions) == 0 and len(text) > 50:
        logger.info(f"Regex parser found 0 questions for {filename}. Invoking Gemini AI parser fallback...")
        ai_questions = parse_exam_with_gemini(text, default_chapter=default_chapter)
        if ai_questions:
            return ai_questions

    return questions

