import re

sample_text = """
TỔNG HỢP CÂU HỎI TRẮC NGHIỆM FULL
CHƯƠNG 1: KHÁI NIỆM CƠ BẢN & KIỂU DỮ LIỆU ĐƠN GIẢN
Bao gồm toàn bộ 55 câu hỏi trắc nghiệm, các lựa chọn A/B/C/D, đáp án đúng và giải thích chi tiết

Tổng số câu: 55 câu   Phạm vi: Khái niệm, Biến, Toán tử, I/O, Lỗi   Chuẩn kiến thức: Python 3.x

Câu 1  Giá trị nào sau đây mang kiểu dữ liệu số phức (complex) trong Python?
  A. -1991                 B. 1.2e3
  C. 3.5 + j               D. 5j
✓ Đáp án đúng: D. 5j
[] Giải thích: Trong Python, số phức có dạng a + bj hoặc bj. Cần có số đi liền trước chữ 'j' (như 5j). Cặp 3.5 + j bị lỗi vì 'j' chưa có hệ số đi kèm (phải là 3.5 + 1j).

Câu 2  Giá trị nào sau đây là số thực (float)?
  A. -1991                 B. 1.2e3
  C. 3.5 + j               D. 5j
✓ Đáp án đúng: B. 1.2e3
[] Giải thích: 1.2e3 = 1.2 x 10^3 = 1200.0 mang kiểu float (ký hiệu e đại diện cho số mũ thập phân trong kiểu float).

Câu 3  Cho biết giá trị và kiểu dữ liệu của biến x trong phép toán: x = 2 - 3e2
  A. -7 (int)              B. -30 (int)
  C. -298.0 (float)        D. Tất cả đều sai
✓ Đáp án đúng: C. -298.0 (float)
[] Giải thích: 3e2 = 300.0 (float). Phép tính 2 - 300.0 = -298.0 (kết quả mang kiểu float).
"""

def clean(s):
    return re.sub(r'[\r\n\t]+', ' ', s).strip()

def parse_sample(text):
    # Detect chapters
    ch_match = re.search(r'(?:CHƯƠNG|Chương|BÀI|Bài|PHẦN|Phần)\s*\d+[\s\:\.\-]+[^\n]+', text)
    current_chapter = clean(ch_match.group(0)) if ch_match else "Chương 1"

    # Split by Question marker: Câu 1, Câu 2... (with or without colon/dot)
    blocks = re.split(r'\n(?=\s*(?:Câu|CÂU|Question|Bài)\s*\d+)', text, flags=re.IGNORECASE)
    questions = []

    for block in blocks:
        block = block.strip()
        if not re.match(r'^(?:Câu|CÂU|Question|Bài)\s*\d+', block, flags=re.IGNORECASE):
            continue

        # Find option markers A, B, C, D
        has_a = re.search(r'(?:^|\n|\s)[A][\.\)\:\-\/]\s*', block)
        has_b = re.search(r'(?:^|\n|\s)[B][\.\)\:\-\/]\s*', block)
        has_c = re.search(r'(?:^|\n|\s)[C][\.\)\:\-\/]\s*', block)
        has_d = re.search(r'(?:^|\n|\s)[D][\.\)\:\-\/]\s*', block)

        if not (has_a and has_b and has_c and has_d):
            continue

        # Extract question content
        content_raw = block[:has_a.start()].strip()
        content = re.sub(r'^(?:Câu|CÂU|Question|Bài)\s*\d+[\s\:\.\-]*', '', content_raw, flags=re.IGNORECASE).strip()

        # Extract answer & explanation
        ans_match = re.search(r'(?:Đáp án đúng|Đáp án|ĐÁP ÁN|Key|Answer)[:\s]+[✓✔\s]*([A-D])', block, flags=re.IGNORECASE)
        correct_answer = ans_match.group(1).upper() if ans_match else "A"

        exp_match = re.search(r'(?:Giải thích|GIẢI THÍCH|Lý do|Explanation)[:\s]+(.*)', block, flags=re.IGNORECASE | re.DOTALL)
        general_exp = clean(exp_match.group(1)) if exp_match else ""

        # Options boundaries
        end_d = ans_match.start() if ans_match else (exp_match.start() if exp_match else len(block))

        opt_a = clean(block[has_a.end():has_b.start()])
        opt_b = clean(block[has_b.end():has_c.start()])
        opt_c = clean(block[has_c.end():has_d.start()])
        opt_d = clean(block[has_d.end():end_d])

        def make_exp(letter, val, is_corr):
            if is_corr:
                if general_exp:
                    return f"Chính xác! {general_exp}"
                return f"Chính xác! Lựa chọn ({letter}) '{val}' là đáp án đúng."
            return f"Chưa chính xác. Lựa chọn ({letter}) '{val}' không phải là kết quả đúng."

        questions.append({
            "chapter": current_chapter,
            "content": content,
            "option_a": opt_a,
            "option_b": opt_b,
            "option_c": opt_c,
            "option_d": opt_d,
            "correct_answer": correct_answer,
            "explanation_a": make_exp("A", opt_a, correct_answer == "A"),
            "explanation_b": make_exp("B", opt_b, correct_answer == "B"),
            "explanation_c": make_exp("C", opt_c, correct_answer == "C"),
            "explanation_d": make_exp("D", opt_d, correct_answer == "D"),
        })

    return questions

results = parse_sample(sample_text)
print("Parsed questions count:", len(results))
for q in results:
    print(f"[{q['chapter']}] {q['content']}")
    print(f"  A: {q['option_a']} | B: {q['option_b']} | C: {q['option_c']} | D: {q['option_d']}")
    print(f"  Ans: {q['correct_answer']}")
    print(f"  Exp (Correct): {q['explanation_' + q['correct_answer'].lower()]}\n")
