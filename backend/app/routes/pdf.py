from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
import logging
from ..database import get_db
from ..models import Quiz, Question, Subject
from ..services.pdf_parser import parse_pdf_to_questions
from ..routes.quizzes import generate_share_code, filename_to_chapter
from ..schemas import QuizDetailOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pdf", tags=["PDF Processing"])

@router.post("/parse")
async def parse_pdf_quiz(
    files: List[UploadFile] = File(...),
    title: Optional[str] = Form(None),
    subject_id: Optional[str] = Form(None),
    auto_save: Optional[bool] = Form(True),
    is_public: Optional[bool] = Form(True),
    db: Session = Depends(get_db)
):
    """
    Parse uploaded PDF file(s), extract questions with 4 options and per-option explanations.
    If auto_save is True, automatically creates the quiz in Neon DB and returns share_code.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 1 file PDF.")

    all_parsed_questions = []
    file_names = []

    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            continue

        try:
            content = await file.read()
            if len(content) == 0:
                continue

            parsed = parse_pdf_to_questions(content)
            if not parsed:
                continue

            file_default_chapter = filename_to_chapter(file.filename)
            for q in parsed:
                detected_ch = q.get("chapter")
                if not detected_ch or detected_ch == "Bài 1":
                    q["chapter"] = file_default_chapter
                all_parsed_questions.append(q)

            file_names.append(file.filename)
        except Exception as e:
            logger.error(f"Error parsing PDF file {file.filename}: {e}", exc_info=True)
            continue

    if not all_parsed_questions or len(all_parsed_questions) == 0:
        raise HTTPException(
            status_code=422,
            detail="Không tìm thấy câu hỏi trắc nghiệm hợp lệ trong các file PDF đã chọn. Hãy đảm bảo đề thi có câu hỏi và các phương án A, B, C, D."
        )

    # Determine quiz title from parameter or filename
    quiz_title = title
    if not quiz_title or not quiz_title.strip():
        if len(file_names) == 1:
            raw_name = file_names[0].rsplit('.', 1)[0]
            quiz_title = f"Đề thi: {raw_name}"
        else:
            quiz_title = f"Bộ đề tổng hợp ({len(file_names)} phần)"

    # Parse subject_id safely
    parsed_subject_id = None
    if subject_id and str(subject_id).strip().isdigit():
        parsed_subject_id = int(subject_id.strip())

    if auto_save:
        try:
            share_code = generate_share_code(quiz_title, db)
            desc_files = ", ".join(file_names[:3]) + (f" và {len(file_names)-3} file khác" if len(file_names) > 3 else "")
            quiz = Quiz(
                title=quiz_title.strip(),
                description=f"Bộ đề được trích xuất tự động từ {len(file_names)} file PDF ({desc_files}) gồm {len(all_parsed_questions)} câu hỏi.",
                subject_id=parsed_subject_id,
                is_public=bool(is_public),
                share_code=share_code
            )
            db.add(quiz)
            db.flush()

            question_objects = []
            for q in all_parsed_questions:
                question_objects.append(
                    Question(
                        quiz_id=quiz.id,
                        chapter=q.get("chapter", "Bài 1").strip(),
                        content=q.get("content", "").strip(),
                        option_a=q.get("option_a", "").strip(),
                        option_b=q.get("option_b", "").strip(),
                        option_c=q.get("option_c", "").strip(),
                        option_d=q.get("option_d", "").strip(),
                        correct_answer=q.get("correct_answer", "A").strip().upper(),
                        explanation_a=q.get("explanation_a", ""),
                        explanation_b=q.get("explanation_b", ""),
                        explanation_c=q.get("explanation_c", ""),
                        explanation_d=q.get("explanation_d", "")
                    )
                )

            # Fast bulk insert
            db.bulk_save_objects(question_objects)
            db.commit()
            db.refresh(quiz)

            return {
                "success": True,
                "message": f"Đã trích xuất và tạo bộ đề thành công với {len(all_parsed_questions)} câu hỏi từ {len(file_names)} file PDF!",
                "quiz_id": quiz.id,
                "share_code": quiz.share_code,
                "title": quiz.title,
                "questions_count": len(all_parsed_questions),
                "quiz": {
                    "id": quiz.id,
                    "title": quiz.title,
                    "share_code": quiz.share_code,
                    "subject_id": quiz.subject_id,
                    "questions": all_parsed_questions
                }
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving parsed quiz to database: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Lỗi khi lưu bộ đề vào cơ sở dữ liệu: {str(e)}")

    return {
        "success": True,
        "title": quiz_title,
        "questions_count": len(all_parsed_questions),
        "questions": all_parsed_questions
    }

