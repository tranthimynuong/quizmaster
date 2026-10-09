# QuizMaster - Nền Tảng Trắc Nghiệm Thông Minh


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
