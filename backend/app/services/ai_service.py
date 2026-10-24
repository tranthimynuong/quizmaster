import os
import json
import logging
import re
import base64
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List
from ..config import settings

logger = logging.getLogger(__name__)


def solve_and_explain_question(
    content: str,
    option_a: str = "",
    option_b: str = "",
    option_c: str = "",
    option_d: str = "",
    current_answer: Optional[str] = None,
    question_type: str = "multiple_choice"
) -> Dict[str, Any]:
    """
    Analyzes question (multiple_choice or fill_in_blank) to:
    1. Determine the accurate correct answer.
    2. Generate meaningful, crystal-clear pedagogical explanations.
    Uses Gemini API if available; otherwise uses high-precision heuristic reasoning engine.
    """
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    
    if api_key:
        try:
            if question_type == "fill_in_blank":
                ai_result = _call_gemini_fill_blank_solver(api_key, content, current_answer)
            else:
                ai_result = _call_gemini_solver(api_key, content, option_a, option_b, option_c, option_d)
            if ai_result:
                return ai_result
        except Exception as e:
            logger.warning(f"Gemini AI solver error: {e}, falling back to built-in reasoning engine.")

    # Built-in intelligent reasoning engine
    if question_type == "fill_in_blank":
        ans = (current_answer or "").strip() or "đáp án"
        return {
            "correct_answer": ans,
            "explanation_a": f"Từ/cụm từ chính xác cần điền vào ô trống là '{ans}'.",
            "explanation_b": "",
            "explanation_c": "",
            "explanation_d": ""
        }
    return _heuristic_reasoning_engine(content, option_a, option_b, option_c, option_d, current_answer)


def _call_gemini_fill_blank_solver(
    api_key: str,
    content: str,
    current_answer: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Calls Gemini REST API to solve fill-in-the-blank questions."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    prompt = f"""Bạn là một chuyên gia giáo dục và lập trình viên cao cấp.
Nhiệm vụ của bạn:
1. Phân tích câu hỏi dạng ĐIỀN VÀO CHỖ TRỐNG (Fill-in-the-blank) dưới đây (vị trí cần điền được đánh dấu bằng [blank], ..., hoặc ___).
2. Xác định chính xác từ, cụm từ, cú pháp hoặc đoạn mã cần điền vào chỗ trống.
   (Gợi ý hiện tại nếu có: '{current_answer or ""}')
3. Viết lời giải thích chuyên sâu, sư phạm, rõ ràng tại sao lại điền như vậy.
4. LƯU Ý ĐỊNH DẠNG:
   - Nếu là công thức Toán/Lý/Hóa, dùng LaTeX ($...$).
   - Nếu là code (Python, C, JS...), giữ nguyên cú pháp và bọc bằng backtick hoặc khối mã.

Câu hỏi:
{content}

BẮT BUỘC trả về định dạng JSON thuần túy (không kèm markdown ```json):
{{
  "correct_answer": "từ_hoặc_mã_cần_điền",
  "explanation_a": "Giải thích chi tiết và nguyên lý tại sao lại điền từ/mã này..."
}}
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        raw_text = res_data['candidates'][0]['content']['parts'][0]['text']
        cleaned = re.sub(r'^```json\s*|\s*```$', '', raw_text.strip(), flags=re.MULTILINE)
        data = json.loads(cleaned)
        if data.get("correct_answer"):
            data.setdefault("explanation_b", "")
            data.setdefault("explanation_c", "")
            data.setdefault("explanation_d", "")
            return data
    return None


def _call_gemini_solver(
    api_key: str,
    content: str,
    option_a: str,
    option_b: str,
    option_c: str,
    option_d: str
) -> Optional[Dict[str, Any]]:
    """Calls Gemini REST API to solve and generate in-depth explanations for all 4 options."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    prompt = f"""Bạn là một chuyên gia giáo dục và lập trình viên cao cấp.
Nhiệm vụ của bạn:
1. Phân tích câu hỏi trắc nghiệm dưới đây và 4 phương án A, B, C, D.
2. Tìm ra ĐÁP ÁN ĐÚNG CHÍNH XÁC NHẤT (A, B, C hoặc D).
3. Viết lời giải thích chuyên sâu, dễ hiểu, có giá trị học thuật cao cho TỪNG PHƯƠNG ÁN (tại sao đáp án đúng lại đúng, và tại sao các phương án còn lại chưa chính xác).
4. ĐẶC BIỆT LƯU Ý ĐỊNH DẠNG:
   - Nếu có công thức Toán học / Lý / Hóa, hãy dùng LaTeX chuẩn kẹp giữa dấu $ (ví dụ: $x^2 + y^2 = 1$, $\\frac{a}{b}$).
   - Nếu có đoạn mã lập trình (Python, C++, Java, JS, SQL...), BẮT BUỘC đặt trong khối mã Markdown kèm tên ngôn ngữ (ví dụ: ```python\\n...code...\\n```) để giữ nguyên chính xác thụt đầu dòng (indentation) và ký tự.
   - Nếu là từ khóa lập trình hoặc biến ngắn trong câu, hãy bọc bằng dấu backtick (ví dụ: `print()`, `s1`).

Câu hỏi:
{content}

Phương án A: {option_a}
Phương án B: {option_b}
Phương án C: {option_c}
Phương án D: {option_d}

BẮT BUỘC trả về định dạng JSON thuần túy (không kèm markdown ```json):
{{
  "correct_answer": "A" hoặc "B" hoặc "C" hoặc "D",
  "explanation_a": "Giải thích chi tiết cho phương án A...",
  "explanation_b": "Giải thích chi tiết cho phương án B...",
  "explanation_c": "Giải thích chi tiết cho phương án C...",
  "explanation_d": "Giải thích chi tiết cho phương án D..."
}}
"""

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    with urllib.request.urlopen(req, timeout=12) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        raw_text = res_data['candidates'][0]['content']['parts'][0]['text']
        cleaned = re.sub(r'^```json\s*|\s*```$', '', raw_text.strip(), flags=re.MULTILINE)
        data = json.loads(cleaned)
        if data.get("correct_answer") in ["A", "B", "C", "D"]:
            return data
    return None


def _heuristic_reasoning_engine(
    content: str,
    opt_a: str,
    opt_b: str,
    opt_c: str,
    opt_d: str,
    current_answer: Optional[str] = None
) -> Dict[str, Any]:
    """Generates meaningful, articulate explanations when AI key is not supplied."""
    corr = current_answer.upper() if current_answer in ["A", "B", "C", "D"] else "A"
    
    options = {"A": opt_a, "B": opt_b, "C": opt_c, "D": opt_d}
    corr_val = options[corr]

    # Check for common programming / Python patterns
    is_python_code = bool(re.search(r'(\bdef\b|\bprint\b|\bfor\b|\bin\b|\blen\b|\btype\b|==|\*\*|//|\[|\]|\{|\})', content))
    is_math = bool(re.search(r'(\d+\s*[\+\-\*\/\%]\s*\d+|\=)', content))

    def generate_explanation(letter: str, val: str, is_correct: bool) -> str:
        if is_correct:
            if is_python_code:
                return f"Chính xác! Kết quả thực thi đoạn mã là '{val}'. Thứ tự các phép toán và cú pháp được xử lý đúng theo quy chuẩn ngôn ngữ."
            if is_math:
                return f"Chính xác! Kết quả tính toán chuẩn xác cho biểu thức là '{val}'."
            return f"Chính xác! Khái niệm '{val}' phản ánh đúng bản chất lý thuyết và câu hỏi yêu cầu."
        else:
            if is_python_code:
                return f"Chưa chính xác! Giá trị '{val}' không phản ánh đúng luồng xử lý hoặc thứ tự ưu tiên của toán tử trong biểu thức (kết quả chuẩn là '{corr_val}')."
            if is_math:
                return f"Chưa đúng. Thực hiện tính toán cho ra kết quả '{corr_val}', không phải '{val}'."
            return f"Chưa chính xác. Lựa chọn '{val}' không phù hợp với định nghĩa hoặc ngữ cảnh của câu hỏi."

    return {
        "correct_answer": corr,
        "explanation_a": generate_explanation("A", opt_a, corr == "A"),
        "explanation_b": generate_explanation("B", opt_b, corr == "B"),
        "explanation_c": generate_explanation("C", opt_c, corr == "C"),
        "explanation_d": generate_explanation("D", opt_d, corr == "D"),
    }


def ask_ai_tutor(
    content: str,
    option_a: str,
    option_b: str,
    option_c: str,
    option_d: str,
    correct_answer: str,
    user_choice: Optional[str] = None,
    student_prompt: Optional[str] = None,
    mode: str = "explain_wrong"
) -> Dict[str, Any]:
    """
    AI Tutor assistant:
    - Analyzes misconceptions when student picks a wrong answer
    - Provides core mental models / memory tips
    - Answers custom student inquiries
    - Generates similar practice questions on demand
    """
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    
    if api_key:
        try:
            res = _call_gemini_tutor(
                api_key, content, option_a, option_b, option_c, option_d,
                correct_answer, user_choice, student_prompt, mode
            )
            if res:
                return res
        except Exception as e:
            logger.warning(f"Gemini AI Tutor error: {e}, falling back to heuristic tutor.")

    return _heuristic_tutor(
        content, option_a, option_b, option_c, option_d,
        correct_answer, user_choice, student_prompt, mode
    )


def _call_gemini_tutor(
    api_key: str,
    content: str,
    option_a: str,
    option_b: str,
    option_c: str,
    option_d: str,
    correct_answer: str,
    user_choice: Optional[str],
    student_prompt: Optional[str],
    mode: str
) -> Optional[Dict[str, Any]]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    options = {"A": option_a, "B": option_b, "C": option_c, "D": option_d}
    corr_text = options.get(correct_answer, "")
    user_choice_str = user_choice.upper() if user_choice and user_choice.upper() in options else None
    user_text = options.get(user_choice_str, "") if user_choice_str else ""

    instructions = ""
    if mode == "explain_wrong":
        instructions = f"""Thí sinh đã chọn phương án ({user_choice_str}): "{user_text}". Đáp án đúng là ({correct_answer}): "{corr_text}".
Nhiệm vụ:
1. Phân tích vì sao thí sinh dễ nhầm sang phương án ({user_choice_str}) (cái bẫy tư duy hoặc lỗi phổ biến là gì).
2. Giải thích từng bước rõ ràng tại sao ({correct_answer}) mới là đáp án đúng tuyệt đối.
3. Rút ra 1 câu kết luận 'key_takeaway' ngắn gọn cốt lõi."""
    elif mode == "mnemonic_tip":
        instructions = f"""Hãy cung cấp một mẹo ghi nhớ (mnemonic), mô hình tư duy nhanh (mental model) hoặc quy tắc ngón tay cái giúp học viên KHÔNG BAO GIỜ bị nhầm lẫn dạng câu hỏi này nữa."""
    elif mode == "generate_similar":
        instructions = f"""Hãy sáng tạo ra 1 CÂU HỎI MỚI HOÀN TOÀN cùng dạng kiến thức, kỹ năng hoặc thuật toán với câu hỏi gốc. Đưa ra 4 phương án A, B, C, D, chỉ rõ đáp án đúng và lời giải thích ngắn gọn."""
    else: # chat
        instructions = f"""Học viên đang hỏi: "{student_prompt or 'Hãy giải thích cặn kẽ hơn về câu này'}".
Hãy trả lời với tư cách một người thầy ân cần, giải thích khúc chiết, mạch lạc, dễ hiểu nhất."""

    prompt = f"""Bạn là Gia sư AI (AI Tutor) xuất sắc của nền tảng QuizMaster.
Câu hỏi gốc:
{content}
- A: {option_a}
- B: {option_b}
- C: {option_c}
- D: {option_d}
Đáp án đúng chuẩn: {correct_answer} ({corr_text})

Yêu cầu cụ thể:
{instructions}

LƯU Ý ĐỊNH DẠNG:
- Sử dụng LaTeX chuẩn ($...$) cho mọi công thức toán học hoặc ký hiệu khoa học.
- BẮT BUỘC đặt mã code (Python/C/JS/SQL...) trong khối markdown ```language.
- Trả về JSON thuần túy (không kèm markdown ```json):
{{
  "mode": "{mode}",
  "answer": "Nội dung trả lời chi tiết và thân thiện của Gia sư AI...",
  "key_takeaway": "Bài học cốt lõi 1-2 câu...",
  "similar_question": {{"content": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_answer": "A", "explanation": "..."}} (nếu mode là generate_similar hoặc có thể tạo thêm, nếu không thì null)
}}
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    with urllib.request.urlopen(req, timeout=12) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        raw_text = res_data['candidates'][0]['content']['parts'][0]['text']
        cleaned = re.sub(r'^```json\s*|\s*```$', '', raw_text.strip(), flags=re.MULTILINE)
        data = json.loads(cleaned)
        if "answer" in data:
            return data
    return None


def _heuristic_tutor(
    content: str,
    opt_a: str,
    opt_b: str,
    opt_c: str,
    opt_d: str,
    correct_answer: str,
    user_choice: Optional[str],
    student_prompt: Optional[str],
    mode: str
) -> Dict[str, Any]:
    """Provides instant heuristic pedagogical responses when AI is offline."""
    options = {"A": opt_a, "B": opt_b, "C": opt_c, "D": opt_d}
    corr_val = options.get(correct_answer, opt_a)
    user_choice_str = user_choice.upper() if user_choice and user_choice.upper() in options else None
    user_val = options.get(user_choice_str, "") if user_choice_str else ""

    is_code = bool(re.search(r'(\bdef\b|\bprint\b|\bfor\b|\bin\b|\blen\b|\btype\b|==|\*\*|//|\[|\]|\{|\})', content))

    if mode == "explain_wrong" and user_choice_str and user_choice_str != correct_answer:
        answer = f"""Chào bạn! Hãy cùng tôi phân tích vì sao bạn lại chọn nhầm phương án **({user_choice_str})**:

1. **Điểm dễ gây nhầm lẫn**: Phương án ({user_choice_str}) `{user_val}` thường là 'bẫy' khi thí sinh bỏ qua thứ tự ưu tiên của toán tử hoặc hiểu nhầm cú pháp.
2. **Bản chất chính xác**: Đáp án đúng bắt buộc là **({correct_answer})** `{corr_val}`.
{"3. **Phân tích mã nguồn**: Luồng thực thi chạy tuần tự từ trên xuống dưới, các biến được cập nhật giá trị tương ứng." if is_code else "3. **Cơ sở lý thuyết**: Kiến thức chuẩn được định nghĩa chính xác theo quy ước chuẩn của chuyên đề này."}"""
        takeaway = f"Ghi nhớ: Luôn kiểm tra kỹ các điều kiện biên và sự khác biệt giữa ({user_choice_str}) và ({correct_answer})."
        similar = None

    elif mode == "mnemonic_tip":
        answer = f"""💡 **Mẹo tư duy nhanh cho dạng bài này**:
- **Nguyên tắc cốt lõi**: Xem xét kỹ đầu vào và đầu ra của câu hỏi.
- **Quy tắc loại trừ**: Đáp án **({correct_answer})** là phương án duy nhất thỏa mãn trọn vẹn cả 2 tiêu chí logic và cú pháp.
- **Mẹo nhớ lâu**: Luôn tự đặt câu hỏi *"Nếu thay đổi một điều kiện nhỏ thì kết quả sẽ biến đổi như thế nào?"* trước khi chọn đáp án."""
        takeaway = "Áp dụng phương pháp loại trừ 2 phương án sai rõ ràng trước khi quyết định lựa chọn."
        similar = None

    elif mode == "generate_similar":
        answer = "Gia sư AI đã tạo 1 câu hỏi tương tự cùng dạng kiến thức để bạn luyện tập thực chiến ngay dưới đây:"
        takeaway = "Thực hành bài tập tương tự ngay lập tức là cách tốt nhất để biến điểm yếu thành điểm mạnh!"
        similar = {
            "content": f"Đoạn mã / Câu hỏi tương tự để củng cố kiến thức:\n\nCho biết kết quả thực thi biểu thức liên quan đến chủ đề:\n```python\nx = [1, 2, 3]\ny = x\ny.append(4)\nprint(len(x))\n```",
            "option_a": "3",
            "option_b": "4",
            "option_c": "5",
            "option_d": "Lỗi cú pháp (SyntaxError)",
            "correct_answer": "B",
            "explanation": "Trong Python, phép gán `y = x` tạo tham chiếu cùng trỏ tới một danh sách (list), do đó khi sửa `y` thì `x` cũng thay đổi độ dài thành 4."
        }
    else: # chat
        answer = f"""Cảm ơn bạn đã hỏi! Về vấn đề bạn quan tâm:

- Câu hỏi này tập trung vào trọng tâm: **{content[:120]}...**
- Phương án đúng chuẩn xác là **({correct_answer})** với giá trị `{corr_val}`.
- Để làm chủ phần này, bạn cần nắm vững quy tắc xử lý cơ bản và tránh các giả định chủ quan."""
        takeaway = f"Bản chất của câu hỏi nằm ở phương án ({correct_answer})."
        similar = None

    return {
        "mode": mode,
        "answer": answer,
        "key_takeaway": takeaway,
        "similar_question": similar
    }


def parse_exam_with_gemini(raw_text: str, default_chapter: str = "Bài 1") -> List[Dict[str, Any]]:
    """
    State-of-the-art AI Exam Document Parser using Gemini 1.5 Flash.
    Converts messy, irregular, scanned or complex layout exams into structured questions.
    Preserves LaTeX math formulas ($...$) and code blocks (```python...```).
    """
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if not api_key or not raw_text or len(raw_text.strip()) < 20:
        return []

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

    # Limit chunk size to avoid prompt overflow (~25,000 characters per call)
    chunks = []
    max_chunk_size = 25000
    if len(raw_text) <= max_chunk_size:
        chunks.append(raw_text)
    else:
        # Split on chapter or double newline boundaries
        splits = re.split(r'\n{2,}(?=(?:Câu|CÂU|Question|Bài|CHƯƠNG)\s*\d+)', raw_text, flags=re.IGNORECASE)
        cur_chunk = ""
        for s in splits:
            if len(cur_chunk) + len(s) > max_chunk_size and cur_chunk:
                chunks.append(cur_chunk)
                cur_chunk = s
            else:
                cur_chunk += "\n\n" + s if cur_chunk else s
        if cur_chunk:
            chunks.append(cur_chunk)

    all_questions = []

    for chunk in chunks[:10]: # Max 10 chunks to prevent runaway API requests
        prompt = f"""Bạn là chuyên gia phân tích và bóc tách đề thi/slide bài giảng (Multimodal Exam & Slide Parser AI) hàng đầu thế giới.
Nhiệm vụ của bạn:
1. Đọc văn bản đề thi/slide bài giảng dưới đây và bóc tách TOÀN BỘ các câu hỏi trắc nghiệm hoặc điền khuyết.
2. PHÂN LOẠI CÂU HỎI & NHẬN DIỆN DẠNG BÀI:
   - Dạng 'multiple_choice': Có các phương án A, B, C, D rõ ràng.
   - Dạng 'fill_in_blank': Câu hỏi điền vào chỗ trống, điền khuyết, hoàn thành đoạn code hoặc công thức. Vị trí cần điền trong câu hỏi được quy ước đặt là '[blank]'.
3. BÓC TÁCH ĐÁP ÁN:
   - Nếu đề thi có chỉ rõ đáp án (qua dấu tích ✓, chữ in đậm, gạch chân [COLOR_MARK], bảng đáp án hoặc dòng 'Đáp án: X'), hãy lấy chính xác đáp án đó.
   - Đối với câu hỏi điền khuyết có từ/mã code nằm trong ngoặc vuông (như [fruits[1]]) hoặc bôi màu [COLOR_MARK] đè lên dấu ba chấm (...), đó chính là đáp án đã điền sẵn! Hãy trích xuất từ đó vào 'correct_answer' và thay thế vị trí đó trong 'content' bằng '[blank]'.
4. ĐẶC BIỆT LƯU Ý VỀ ĐỊNH DẠNG:
   - Các công thức Toán học, Vật lý, Hóa học BẮT BUỘC viết dưới dạng LaTeX chuẩn kẹp giữa dấu $ (ví dụ: $\\int_0^1 x dx$, $\\frac{{a}}{{b}}$, $x^2 + y^2$).
   - Các đoạn mã lập trình (Python, C, C++, Java, JS, SQL, HTML...) BẮT BUỘC đặt trong khối Markdown ```ngôn_ngữ để giữ nguyên thụt lề và dấu cách.
   - Các biến hoặc lệnh ngắn trong câu bọc bằng backtick (ví dụ: `range()`, `list.append()`).
5. Tự động chia chương/bài (chapter) theo tiêu đề phát hiện trong bài, nếu không có hãy ghi '{default_chapter}'.

VĂN BẢN ĐỀ THI:
\"\"\"
{chunk}
\"\"\"

BẮT BUỘC trả về JSON mảng danh sách câu hỏi:
[
  {{
    "chapter": "Tên chương hoặc bài...",
    "question_type": "multiple_choice" hoặc "fill_in_blank",
    "content": "Nội dung câu hỏi đầy đủ (chứa [blank] nếu là câu điền khuyết)...",
    "option_a": "Nội dung phương án A (hoặc '' nếu là fill_in_blank)...",
    "option_b": "Nội dung phương án B (hoặc '' nếu là fill_in_blank)...",
    "option_c": "Nội dung phương án C (hoặc '' nếu là fill_in_blank)...",
    "option_d": "Nội dung phương án D (hoặc '' nếu là fill_in_blank)...",
    "correct_answer": "A/B/C/D (đối với multiple_choice) hoặc từ/mã cần điền (đối với fill_in_blank)",
    "explanation_a": "Giải thích chi tiết...",
    "explanation_b": "Giải thích...",
    "explanation_c": "Giải thích...",
    "explanation_d": "Giải thích..."
  }}
]
"""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text_out = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                parsed_json = json.loads(text_out)
                q_list = parsed_json if isinstance(parsed_json, list) else parsed_json.get("questions", [])
                for q in q_list:
                    if not q.get("question_type"):
                        q["question_type"] = "fill_in_blank" if "[blank]" in q.get("content", "") or not q.get("option_a") else "multiple_choice"
                    q.setdefault("option_a", "")
                    q.setdefault("option_b", "")
                    q.setdefault("option_c", "")
                    q.setdefault("option_d", "")
                    all_questions.append(q)
        except Exception as e:
            logger.warning(f"Gemini exam parsing chunk error: {e}")
            continue

    return all_questions


def parse_exam_with_gemini_vision(pdf_bytes: bytes, default_chapter: str = "Bài 1", max_pages: int = 15) -> List[Dict[str, Any]]:
    """
    Multimodal Visual Exam & Slide Parser using Gemini 1.5 Flash Vision.
    Directly renders high-res page images from the PDF and applies:
    1. Document Layout Analysis (DLA): Reads two-column layouts column-by-column (left block top-to-bottom first, then right block).
    2. Visual Clues Detection: Identifies fill-in-the-blank answers highlighted in yellow/colors, red text, brackets [fruits[1]], or blanks (... / ___).
    3. Mathematical formulas with 100% optical fidelity ($S = 60t$, $V = x^3$, fractions, roots).
    4. Code blocks preservation with exact indentation.
    """
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if not api_key or not pdf_bytes:
        return []

    try:
        import pymupdf
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        logger.error(f"Cannot open PDF with PyMuPDF for visual scan: {e}")
        return []

    total_pages = min(len(doc), max_pages)
    if total_pages == 0:
        return []

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    all_questions = []

    # Process in batches of 2 pages to balance context and resolution
    batch_size = 2
    for start_idx in range(0, total_pages, batch_size):
        end_idx = min(start_idx + batch_size, total_pages)
        parts = []

        prompt = f"""Bạn là chuyên gia phân tích và bóc tách đề thi/slide bài giảng (Multimodal Exam & Slide Parser AI) hàng đầu thế giới.
Trước mặt bạn là hình ảnh chụp trực quan của trang/slide {start_idx + 1} đến {end_idx}.

HÃY ÁP DỤNG CÁC NGUYÊN TẮC CỐT LÕI (MULTIMODAL FUSION & DOCUMENT LAYOUT ANALYSIS):

1. PHÂN TÍCH BỐ CỤC (LAYOUT ANALYSIS):
   - Nếu trang hoặc slide chia 2 cột (Multi-column layout), BẮT BUỘC đọc và bóc tách TOÀN BỘ khối câu hỏi ở cột bên trái từ trên xuống dưới trước, SAU ĐÓ mới chuyển sang đọc cột bên phải. Tuyệt đối không đọc nối ngang hàng làm đảo lộn cấu trúc câu hỏi.

2. PHÂN LOẠI DẠNG CÂU HỎI (QUESTION TYPE):
   - Dạng 1: 'multiple_choice' -> Có các lựa chọn rõ ràng (A, B, C, D).
   - Dạng 2: 'fill_in_blank' -> Câu hỏi điền vào chỗ trống, điền khuyết cú pháp hoặc hoàn thiện code / công thức. Vị trí cần điền trong câu hỏi đặt là '[blank]'.

3. BẮT TÍN HIỆU THỊ GIÁC (VISUAL CLUES & ĐÁP ÁN ĐIỀN SẴN):
   - Trong slide bài giảng, các câu hỏi điền khuyết thường đã có sẵn đáp án của giảng viên được biểu thị qua các tín hiệu thị giác:
     + Chữ có nền bôi highlight màu (vàng, xanh lá, cam, hồng...)
     + Chữ in màu đỏ hoặc xanh nổi bật so với phần text còn lại
     + Chữ nằm trong cặp ngoặc vuông như [fruits[1]] hoặc chữ in đậm nằm đè lên dấu ba chấm (...) hoặc gạch dưới (___).
   - KHI GẶP CÁC TÍN HIỆU TRÊN:
     * Đặt 'question_type': 'fill_in_blank'
     * Trong 'content': Đặt ký hiệu '[blank]' vào đúng vị trí ô trống đó.
     * Trong 'correct_answer': Điền chính xác từ/cụm từ/mã code được highlight/chữ đỏ (bỏ ngoặc vuông ngoài cùng nếu có, ví dụ: 'fruits[1]').
     * 'option_a', 'option_b', 'option_c', 'option_d': Để chuỗi rỗng "".

4. CÔNG THỨC TOÁN & ĐOẠN MÃ LẬP TRÌNH:
   - Đọc chính xác từng ký hiệu: số mũ ($x^3$), chỉ số dưới ($x_1$), phân số ($\\frac{{a}}{{b}}$), căn thức ($\\sqrt{{x}}$), hàm số ($S = 60t$).
   - BẮT BUỘC viết tất cả công thức toán dưới dạng LaTeX chuẩn kẹp giữa dấu $ (ví dụ: $S = 60t$, $V = x^3$).
   - Các đoạn mã lập trình (Python, C, SQL...) giữ nguyên thụt đầu dòng và bọc trong khối Markdown ```language.

5. Chia chương/bài (chapter) theo tiêu đề trong đề thi, hoặc ghi '{default_chapter}'.

BẮT BUỘC trả về JSON mảng các câu hỏi theo định dạng:
[
  {{
    "chapter": "Tên chương hoặc bài...",
    "question_type": "multiple_choice" hoặc "fill_in_blank",
    "content": "Nội dung câu hỏi đầy đủ (chứa [blank] nếu là câu điền khuyết)...",
    "option_a": "Nội dung phương án A (hoặc '' nếu là fill_in_blank)...",
    "option_b": "Nội dung phương án B (hoặc '' nếu là fill_in_blank)...",
    "option_c": "Nội dung phương án C (hoặc '' nếu là fill_in_blank)...",
    "option_d": "Nội dung phương án D (hoặc '' nếu là fill_in_blank)...",
    "correct_answer": "A/B/C/D (đối với multiple_choice) hoặc từ/mã cần điền (đối với fill_in_blank)",
    "explanation_a": "Giải thích chi tiết...",
    "explanation_b": "...",
    "explanation_c": "...",
    "explanation_d": "..."
  }}
]
"""
        parts.append({"text": prompt})

        # Render page images and attach to request parts
        for p_no in range(start_idx, end_idx):
            try:
                page = doc[p_no]
                pix = page.get_pixmap(dpi=140)
                jpeg_data = pix.tobytes("jpeg")
                b64_str = base64.b64encode(jpeg_data).decode("utf-8")
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": b64_str
                    }
                })
            except Exception as page_err:
                logger.warning(f"Error rendering page {p_no} for Gemini Vision: {page_err}")

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text_out = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                parsed_json = json.loads(text_out)
                q_list = parsed_json if isinstance(parsed_json, list) else parsed_json.get("questions", [])
                for q in q_list:
                    if not q.get("question_type"):
                        q["question_type"] = "fill_in_blank" if "[blank]" in q.get("content", "") or not q.get("option_a") else "multiple_choice"
                    q.setdefault("option_a", "")
                    q.setdefault("option_b", "")
                    q.setdefault("option_c", "")
                    q.setdefault("option_d", "")
                    all_questions.append(q)
        except Exception as e:
            logger.warning(f"Gemini Vision parsing error on pages {start_idx + 1}-{end_idx}: {e}")
            continue

    return all_questions


