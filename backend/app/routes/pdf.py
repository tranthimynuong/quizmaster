from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Any
import logging
import re
from ..database import get_db
from ..models import Quiz, Question, Subject, User
from ..services.pdf_parser import parse_pdf_to_questions
from ..routes.quizzes import generate_share_code, filename_to_chapter
from ..auth import get_current_user_optional
from ..schemas import QuizDetailOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pdf", tags=["PDF Processing"])

def sanitize_sql_str(val: Optional[str], default: str = "") -> str:
    """Removes null bytes (0x00) and problematic control characters from strings prior to SQL insertion."""
    if val is None:
        return default
    if not isinstance(val, str):
        val = str(val)
    val = val.replace('\x00', '').replace('\u0000', '')
    val = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', val)
    return val.strip()


@router.post("/parse")
async def parse_pdf_quiz(
    files: List[UploadFile] = File(...),
    title: Optional[str] = Form(None),
    subject_id: Optional[str] = Form(None),
    auto_save: Optional[Any] = Form(True),
    is_public: Optional[Any] = Form(True),
    current_user: Optional[User] = Depends(get_current_user_optional),
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
    quiz_title = sanitize_sql_str(title)
    if not quiz_title:
        if len(file_names) == 1:
            raw_name = file_names[0].rsplit('.', 1)[0]
            quiz_title = sanitize_sql_str(f"Đề thi: {raw_name}")
        else:
            quiz_title = f"Bộ đề tổng hợp ({len(file_names)} phần)"

    # Parse subject_id safely
    parsed_subject_id = None
    if subject_id and str(subject_id).strip().isdigit():
        parsed_subject_id = int(subject_id.strip())

    # Parse boolean flags safely
    is_pub_bool = True
    if is_public is not None:
        if isinstance(is_public, bool):
            is_pub_bool = is_public
        elif str(is_public).strip().lower() in ["false", "0", "no"]:
            is_pub_bool = False

    auto_save_bool = True
    if auto_save is not None:
        if isinstance(auto_save, bool):
            auto_save_bool = auto_save
        elif str(auto_save).strip().lower() in ["false", "0", "no"]:
            auto_save_bool = False

    if auto_save_bool:
        try:
            share_code = generate_share_code(quiz_title, db)
            desc_files = ", ".join(file_names[:3]) + (f" và {len(file_names)-3} file khác" if len(file_names) > 3 else "")
            desc_str = sanitize_sql_str(f"Bộ đề được trích xuất tự động từ {len(file_names)} file PDF ({desc_files}) gồm {len(all_parsed_questions)} câu hỏi.")
            
            quiz = Quiz(
                title=quiz_title,
                description=desc_str,
                subject_id=parsed_subject_id,
                created_by_id=current_user.id if current_user else None,
                is_public=bool(is_pub_bool),
                share_code=share_code
            )
            db.add(quiz)
            db.flush()

            question_objects = []
            for q in all_parsed_questions:
                c_ans = sanitize_sql_str(q.get("correct_answer", "A"), "A").upper()
                if c_ans not in ["A", "B", "C", "D"]:
                    c_ans = "A"

                question_objects.append(
                    Question(
                        quiz_id=quiz.id,
                        chapter=sanitize_sql_str(q.get("chapter"), "Bài 1"),
                        content=sanitize_sql_str(q.get("content")),
                        option_a=sanitize_sql_str(q.get("option_a")),
                        option_b=sanitize_sql_str(q.get("option_b")),
                        option_c=sanitize_sql_str(q.get("option_c")),
                        option_d=sanitize_sql_str(q.get("option_d")),
                        correct_answer=c_ans,
                        explanation_a=sanitize_sql_str(q.get("explanation_a")),
                        explanation_b=sanitize_sql_str(q.get("explanation_b")),
                        explanation_c=sanitize_sql_str(q.get("explanation_c")),
                        explanation_d=sanitize_sql_str(q.get("explanation_d"))
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

