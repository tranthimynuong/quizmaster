# QuizMaster - Nền Tảng Trắc Nghiệm Thông Minh (Quizlet & Azota Style)

Hệ thống ứng dụng web trắc nghiệm hoàn chỉnh, hiện đại với kiến trúc tách biệt Frontend & Backend, kết nối cơ sở dữ liệu đám mây **Neon PostgreSQL**.

---

## 🚀 Các Tính Năng Nổi Bật

1. **Khám Phá & Bộ Lọc Chủ Đề**:
   - Hiển thị danh sách môn học và các bộ đề thi trắc nghiệm công khai.
   - Tìm kiếm nhanh theo từ khóa, lọc theo môn học, thống kê số câu hỏi và lượt làm bài.

2. **Chế Độ Luyện Tập (Practice Mode - Tính năng quan trọng nhất)**:
   - Giao diện trực quan phong cách Quizlet/Azota.
   - Nhận diện phản hồi tức thì khi chọn đáp án (Xanh lá nếu Đúng, Đỏ nếu Sai).
   - **Khung giải thích chi tiết cho TỪNG phương án (A, B, C, D)** từ cơ sở dữ liệu `explanation_a/b/c/d`.
   - Hỗ trợ phím tắt (`1-4` hoặc `A-D`, phím mũi tên chuyển câu), chế độ Thẻ ghi nhớ Flashcard flip 3D.

3. **Chế Độ Thi Thử (Exam Mode - Azota Style)**:
   - Đồng hồ đếm ngược với cảnh báo thời gian.
   - Xáo trộn câu hỏi tự động.
   - Bảng câu hỏi (Question Map Palette) đánh dấu câu đã làm, chưa làm và đặt cờ xem lại.
   - Tự động chấm điểm theo thang **10.0**, lưu lịch sử làm bài vào bảng `quiz_attempts` trên Neon DB và hiển thị bảng phân tích toàn bộ câu hỏi.

4. **Tạo Bộ Đề & Chia Sẻ Link**:
   - **Tạo thủ công**: Thêm câu hỏi, đáp án A/B/C/D, chọn đáp án đúng và nhập lời giải thích chi tiết cho từng phương án.
   - **Tải file PDF thông minh**: Tải file đề thi PDF lên, hệ thống tự động phân tích và sinh bộ đề kèm giải thích chi tiết.
   - **Chia sẻ link**: Tự động sinh `share_code` độc nhất, cho phép gửi link trực tiếp (`/quiz/<share_code>`).

---

## 🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Neon PostgreSQL)

1. **`subjects`**: `id`, `name`, `code`
2. **`quizzes`**: `id`, `subject_id`, `title`, `description`, `is_public`, `share_code`, `created_at`
3. **`questions`**: `id`, `quiz_id`, `content`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `explanation_a`, `explanation_b`, `explanation_c`, `explanation_d`
4. **`quiz_attempts`**: `id`, `quiz_id`, `taker_name`, `score`, `submitted_at`

---

## 🛠️ Cấu Trúc Dự Án

```
d:/quizzproj/
├── backend/
│   ├── app/
│   │   ├── config.py             # Cấu hình biến môi trường
│   │   ├── database.py           # Kết nối SQLAlchemy engine & session
│   │   ├── models.py             # Định nghĩa 4 bảng chuẩn Neon DB
│   │   ├── schemas.py            # Pydantic schemas xác thực dữ liệu
│   │   ├── routes/
│   │   │   ├── subjects.py       # API môn học
│   │   │   ├── quizzes.py        # API bộ đề, chi tiết, nộp bài
│   │   │   └── pdf.py            # API upload & phân tích PDF
│   │   ├── services/
│   │   │   ├── pdf_parser.py     # Trích xuất PDF & AI Generator
│   │   │   └── seed_data.py      # Dữ liệu mẫu chuẩn kèm giải thích
│   │   └── main.py               # FastAPI App & startup seeding
│   ├── requirements.txt
│   ├── .env                      # Connection string Neon DB
│   └── run.py                    # Khởi chạy Uvicorn server
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── QuizCard.jsx
│   │   │   ├── ShareModal.jsx
│   │   │   └── OptionExplanationCard.jsx # Hiển thị giải thích 4 phương án
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── QuizDetailPage.jsx
│   │   │   ├── PracticeModePage.jsx      # Phòng luyện tập tức thì
│   │   │   ├── ExamModePage.jsx          # Phòng thi thử tính giờ
│   │   │   └── CreateQuizPage.jsx        # Tạo đề thủ công & tải PDF
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── start.bat                     # Script 1-click khởi động toàn bộ
└── README.md
```

---

## ⚡ Hướng Dẫn Khởi Chạy

### Cách 1: Chạy nhanh bằng script `start.bat`
Click đúp vào file `start.bat` tại thư mục gốc `d:\quizzproj\start.bat`.

### Cách 2: Khởi chạy từng phần qua Terminal

1. **Khởi động Backend (FastAPI)**:
   ```bash
   cd backend
   .\venv\Scripts\python run.py
   ```
   - Server chạy tại: `http://localhost:8000`
   - Tài liệu API tương tác Swagger UI: `http://localhost:8000/docs`

2. **Khởi động Frontend (React Vite)**:
   ```bash
   cd frontend
   npm run dev
   ```
   - Ứng dụng web mở tại: `http://localhost:5173`
