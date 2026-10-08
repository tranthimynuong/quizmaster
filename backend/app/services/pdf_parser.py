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


def extract_text_from_pdf(pdf_bytes: bytes, max_pages: int = 500) -> str:
    """Extract all text from uploaded PDF bytes up to max_pages."""
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
        return unicodedata.normalize('NFC', raw)
    except Exception as e:
        logger.error(f"Error reading PDF: {e}")
        return ""


def clean_text(s: str) -> str:
    return re.sub(r'[\r\n\t]+', ' ', s).strip()


def parse_pdf_to_questions(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Ultra-resilient Parser tailored for Python exams, Word/PDF tables, checkmarked answers, and Vietnamese layouts."""
    text = extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        return []

    normalized = re.sub(r'\r\n', '\n', text)
    normalized = re.sub(r'\t', ' ', normalized)

    # Detect global answer keys ONLY in explicit answer sections (to avoid false positives in code/math)
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
    split_pattern = r'\n(?=(?:(?:Câu|CÂU|Question)\s*\d+|\b\d{1,4}[\.\)]\s+[A-Z\u00C0-\u1EF9\(]|(?:BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*[0-9IVXLCDMivxlcdm]+))'
    blocks = re.split(split_pattern, '\n' + normalized, flags=re.IGNORECASE)

    current_chapter = "Bài 1"
    questions = []
    q_counter = 0

    for raw_block in blocks:
        block = raw_block.strip()
        if not block or len(block) < 10:
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

        # Verify block has 4 options A, B, C, D
        has_a = re.search(r'(?:^|\n|\s)[A][\.\)\:\-\/]\s*|(?:\n|\s)\(A\)\s*', block)
        has_b = re.search(r'(?:^|\n|\s)[B][\.\)\:\-\/]\s*|(?:\n|\s)\(B\)\s*', block)
        has_c = re.search(r'(?:^|\n|\s)[C][\.\)\:\-\/]\s*|(?:\n|\s)\(C\)\s*', block)
        has_d = re.search(r'(?:^|\n|\s)[D][\.\)\:\-\/]\s*|(?:\n|\s)\(D\)\s*', block)

        if not (has_a and has_b and has_c and has_d):
            has_a = re.search(r'(?:^|\n|\s)[a][\.\)\:\-\/]\s*', block)
            has_b = re.search(r'(?:^|\n|\s)[b][\.\)\:\-\/]\s*', block)
            has_c = re.search(r'(?:^|\n|\s)[c][\.\)\:\-\/]\s*', block)
            has_d = re.search(r'(?:^|\n|\s)[d][\.\)\:\-\/]\s*', block)

        if not (has_a and has_b and has_c and has_d):
            continue

        q_start = re.match(r'^(?:(?:Câu|CÂU|Question|Bài)\s*)?(\d{1,4})[\s\:\.\-\)]*', block, flags=re.IGNORECASE)
        q_counter += 1
        q_num = int(q_start.group(1)) if (q_start and q_start.group(1)) else q_counter

        # Extract Question Content
        content_raw = block[:has_a.start()].strip()
        content_lines = [
            l for l in content_raw.split('\n')
            if not re.match(r'^\s*(?:BÀI|Bài|CHƯƠNG|Chương|PHẦN|Phần|CHỦ ĐỀ|Chủ đề|TIẾT|Tiết|HỌC PHẦN|Học phần|MODULE|Module)\s*[0-9IVXLCDMivxlcdm]+', l.strip(), re.IGNORECASE)
        ]
        content = '\n'.join(content_lines).strip()
        content = re.sub(r'^(?:(?:Câu|CÂU|Question|Bài)\s*)?\d{1,4}[\s\:\.\-\)]*', '', content, flags=re.IGNORECASE).strip()
        if not content:
            content = content_raw

        # Detect explicit answers and explanation labels
        ans_match = re.search(r'(?:Đáp án đúng|Đáp án|ĐÁP ÁN|Key|Answer|Đ/a|ĐA)[:\s]+(?:[✓✔\s]*)([A-D])\b', block, flags=re.IGNORECASE)
        exp_match = re.search(r'(?:\[\]\s*)?(?:Giải thích|GIẢI THÍCH|Lý do|Explanation|HDG)[:\s]+(.*)', block, flags=re.IGNORECASE | re.DOTALL)
        general_exp = clean_text(exp_match.group(1)) if exp_match else ""

        # Option boundaries
        end_d = ans_match.start() if ans_match else (exp_match.start() if exp_match else len(block))

        opt_a_raw = block[has_a.end():has_b.start()]
        opt_b_raw = block[has_b.end():has_c.start()]
        opt_c_raw = block[has_c.end():has_d.start()]
        opt_d_raw = block[has_d.end():end_d]

        # Check for Checkmarks / True indicators inside options (e.g. "D. 5j ✓", "A. 5 *", "[x] C. True")
        detected_from_checkmark = None
        for key, raw_val in [('A', opt_a_raw), ('B', opt_b_raw), ('C', opt_c_raw), ('D', opt_d_raw)]:
            if re.search(r'[✓✔☑]|(?:\s*[\(\[]?(?:đúng|dung|chính xác|correct|true)[\)\]]?\s*$)', raw_val, re.IGNORECASE):
                detected_from_checkmark = key
                break

        def clean_opt(s: str) -> str:
            cleaned = clean_text(s)
            cleaned = re.sub(r'[✓✔☑]', '', cleaned).strip()
            cleaned = re.sub(r'\s*[\(\[]?(?:đúng|dung|chính xác|correct|true)[\)\]]?\s*$', '', cleaned, flags=re.IGNORECASE).strip()
            return cleaned

        opt_a = clean_opt(opt_a_raw)
        opt_b = clean_opt(opt_b_raw)
        opt_c = clean_opt(opt_c_raw)
        opt_d = clean_opt(opt_d_raw)

        # Detect target answer mentioned inside explanation text if available (e.g. "(Đáp án đề thi chính thức chọn A: 5)")
        exp_target_match = None
        if general_exp:
            exp_ans_search = re.search(r'(?:đáp án|chọn|kết quả|phương án)[\s\:\(a-zA-Zđềthichínhthức]*([A-D])\b', general_exp, re.IGNORECASE)
            if exp_ans_search:
                exp_target_match = exp_ans_search.group(1).upper()

        # Resolve correct answer priority
        if detected_from_checkmark:
            correct_answer = detected_from_checkmark
        elif ans_match:
            correct_answer = ans_match.group(1).upper()
        elif exp_target_match:
            correct_answer = exp_target_match
        elif q_num in global_answers:
            correct_answer = global_answers[q_num]
        else:
            correct_answer = "A"

        if opt_a and opt_b and opt_c and opt_d:
            # Generate articulate, meaningful explanations
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
                "chapter": current_chapter,
                "content": content,
                "option_a": opt_a,
                "option_b": opt_b,
                "option_c": opt_c,
                "option_d": opt_d,
                "correct_answer": correct_answer,
                "explanation_a": exp_a,
                "explanation_b": exp_b,
                "explanation_c": exp_c,
                "explanation_d": exp_d,
            })

    return questions
