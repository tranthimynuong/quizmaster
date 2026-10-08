from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import secrets
import re
import unicodedata
from ..database import get_db
from ..models import Quiz, Question, Subject, QuizAttempt, User
from ..services.pdf_parser import parse_pdf_to_questions
from ..services.pdf_generator import build_quiz_pdf
from ..schemas import (
    QuizSummaryOut,
    QuizDetailOut,
    QuizCreate,
    QuizUpdate,
    ChapterRenameRequest,
    QuestionUpdate,
    QuestionOut,
    AttemptSubmitRequest,
    AttemptSubmitResponse,
    QuizAttemptOut,
    ChapterSummaryOut,
    AiSolveRequest
)
from ..services.ai_service import solve_and_explain_question
from ..auth import get_current_user_optional, get_current_user

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])


def generate_share_code(title: str, db: Session) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')[:12]
    if not slug:
        slug = "quiz"
    
    for _ in range(10):
        code = f"{slug}-{secrets.token_hex(3)}"
        if not db.query(Quiz).filter(Quiz.share_code == code).first():
            return code
    return f"q-{secrets.token_hex(4)}"


@router.post("/ai-solve-question")
def ai_solve_question_endpoint(data: AiSolveRequest):
    """Sử dụng AI & bộ suy luận để giải đáp án chính xác và tạo 4 lời giải thích chuyên sâu."""
    return solve_and_explain_question(
        content=data.content,
        option_a=data.option_a,
        option_b=data.option_b,
        option_c=data.option_c,
        option_d=data.option_d,
        current_answer=data.current_answer
    )


@router.get("", response_model=List[QuizSummaryOut])
def get_quizzes(
    subject_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Lấy danh sách các bộ đề công khai hoặc bộ đề do chính người dùng tạo ra."""
    query = db.query(
        Quiz,
        Subject.name.label("subject_name"),
        Subject.code.label("subject_code"),
        User.full_name.label("creator_name"),
        func.count(Question.id.distinct()).label("question_count"),
        func.count(QuizAttempt.id.distinct()).label("attempt_count")
    ).outerjoin(Subject, Quiz.subject_id == Subject.id)\
     .outerjoin(User, Quiz.created_by_id == User.id)\
     .outerjoin(Question, Quiz.id == Question.quiz_id)\
     .outerjoin(QuizAttempt, Quiz.id == QuizAttempt.quiz_id)

    # Privacy filtering
    if current_user and current_user.role == "admin":
        pass  # Admin can see all public and private quizzes
    elif current_user:
        query = query.filter((Quiz.is_public == True) | (Quiz.created_by_id == current_user.id) | (Quiz.created_by_id.is_(None)))
    else:
        query = query.filter((Quiz.is_public == True) | (Quiz.created_by_id.is_(None)))

    if subject_id is not None and str(subject_id).strip() != "":
        s_val = str(subject_id).strip().lower()
        if s_val in ["none", "null", "free", "-1", "uncategorized"]:
            query = query.filter(Quiz.subject_id.is_(None))
        elif s_val.isdigit():
            query = query.filter(Quiz.subject_id == int(s_val))

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Quiz.title.ilike(search_fmt)) | 
            (Quiz.description.ilike(search_fmt)) |
            (Quiz.share_code.ilike(search_fmt))
        )

    results = query.group_by(Quiz.id, Subject.name, Subject.code, User.full_name)\
                   .order_by(Quiz.created_at.desc()).all()

    output = []
    for quiz, subject_name, subject_code, creator_name, q_count, a_count in results:
        output.append(QuizSummaryOut(
            id=quiz.id,
            title=quiz.title,
            description=quiz.description,
            subject_id=quiz.subject_id,
            subject_name=subject_name,
            subject_code=subject_code,
            created_by_id=quiz.created_by_id,
            creator_name=creator_name or "Hệ thống",
            is_public=quiz.is_public,
            share_code=quiz.share_code,
            created_at=quiz.created_at,
            question_count=q_count,
            attempt_count=a_count
        ))
    return output


@router.get("/my/created", response_model=List[QuizSummaryOut])
def get_my_created_quizzes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách các bộ đề do chính người dùng hiện tại tạo ra (hoặc tất cả nếu là admin)."""
    query = db.query(
        Quiz,
        Subject.name.label("subject_name"),
        Subject.code.label("subject_code"),
        User.full_name.label("creator_name"),
        func.count(Question.id.distinct()).label("question_count"),
        func.count(QuizAttempt.id.distinct()).label("attempt_count")
    ).outerjoin(Subject, Quiz.subject_id == Subject.id)\
     .outerjoin(User, Quiz.created_by_id == User.id)\
     .outerjoin(Question, Quiz.id == Question.quiz_id)\
     .outerjoin(QuizAttempt, Quiz.id == QuizAttempt.quiz_id)

    if current_user.role != "admin":
        query = query.filter((Quiz.created_by_id == current_user.id) | (Quiz.created_by_id.is_(None)))

    results = query.group_by(Quiz.id, Subject.name, Subject.code, User.full_name)\
                   .order_by(Quiz.created_at.desc()).all()

    output = []
    for quiz, subject_name, subject_code, creator_name, q_count, a_count in results:
        output.append(QuizSummaryOut(
            id=quiz.id,
            title=quiz.title,
            description=quiz.description,
            subject_id=quiz.subject_id,
            subject_name=subject_name,
            subject_code=subject_code,
            created_by_id=quiz.created_by_id,
            creator_name=creator_name or current_user.full_name or current_user.username,
            is_public=quiz.is_public,
            share_code=quiz.share_code,
            created_at=quiz.created_at,
            question_count=q_count,
            attempt_count=a_count
        ))
    return output


@router.get("/my/history", response_model=List[QuizAttemptOut])
def get_my_attempt_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy lịch sử làm bài thi của người dùng đang đăng nhập."""
    attempts = db.query(
        QuizAttempt,
        Quiz.title.label("quiz_title"),
        Quiz.share_code.label("quiz_share_code")
    ).join(Quiz, QuizAttempt.quiz_id == Quiz.id)\
     .filter(QuizAttempt.user_id == current_user.id)\
     .order_by(QuizAttempt.submitted_at.desc())\
     .all()

    output = []
    for attempt, quiz_title, quiz_share_code in attempts:
        output.append(QuizAttemptOut(
            id=attempt.id,
            quiz_id=attempt.quiz_id,
            quiz_title=quiz_title,
            quiz_share_code=quiz_share_code,
            user_id=attempt.user_id,
            taker_name=attempt.taker_name,
            score=float(attempt.score),
            submitted_at=attempt.submitted_at
        ))
    return output


@router.get("/{share_code}", response_model=QuizDetailOut)
def get_quiz_by_share_code(share_code: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()
    
    if not quiz and share_code.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(share_code)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề trắc nghiệm này.")

    attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz.id)\
                 .order_by(QuizAttempt.score.desc(), QuizAttempt.submitted_at.desc())\
                 .limit(10).all()

    # Extract chapters and counts in preserved order
    chapters = []
    chapter_counts = {}
    for q in quiz.questions:
        ch = q.chapter or "Bài 1"
        if ch not in chapters:
            chapters.append(ch)
            chapter_counts[ch] = 0
        chapter_counts[ch] += 1

    chapters_summary = [
        ChapterSummaryOut(name=ch, question_count=chapter_counts[ch])
        for ch in chapters
    ]

    creator_name = quiz.creator.full_name or quiz.creator.username if quiz.creator else None

    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        subject_id=quiz.subject_id,
        created_by_id=quiz.created_by_id,
        creator_name=creator_name,
        subject=quiz.subject,
        is_public=quiz.is_public,
        share_code=quiz.share_code,
        created_at=quiz.created_at,
        questions=quiz.questions,
        chapters=chapters,
        chapters_summary=chapters_summary,
        recent_attempts=[
            QuizAttemptOut(
                id=a.id,
                quiz_id=a.quiz_id,
                quiz_title=quiz.title,
                quiz_share_code=quiz.share_code,
                user_id=a.user_id,
                taker_name=a.taker_name,
                score=float(a.score),
                submitted_at=a.submitted_at
            ) for a in attempts
        ]
    )


@router.post("", response_model=QuizDetailOut)
def create_quiz(
    quiz_in: QuizCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if not quiz_in.title.strip():
        raise HTTPException(status_code=400, detail="Tiêu đề bộ đề không được để trống.")

    share_code = quiz_in.share_code
    if not share_code or db.query(Quiz).filter(Quiz.share_code == share_code).first():
        share_code = generate_share_code(quiz_in.title, db)

    quiz = Quiz(
        title=quiz_in.title.strip(),
        description=quiz_in.description,
        subject_id=quiz_in.subject_id,
        created_by_id=current_user.id if current_user else None,
        is_public=quiz_in.is_public,
        share_code=share_code
    )
    db.add(quiz)
    db.flush()

    for q_data in quiz_in.questions:
        q = Question(
            quiz_id=quiz.id,
            chapter=q_data.chapter.strip() if q_data.chapter else "Bài 1",
            content=q_data.content.strip(),
            option_a=q_data.option_a.strip(),
            option_b=q_data.option_b.strip(),
            option_c=q_data.option_c.strip(),
            option_d=q_data.option_d.strip(),
            correct_answer=q_data.correct_answer.upper().strip(),
            explanation_a=q_data.explanation_a,
            explanation_b=q_data.explanation_b,
            explanation_c=q_data.explanation_c,
            explanation_d=q_data.explanation_d
        )
        db.add(q)

    db.commit()
    db.refresh(quiz)

    chapters = []
    chapter_counts = {}
    for q in quiz.questions:
        ch = q.chapter or "Bài 1"
        if ch not in chapters:
            chapters.append(ch)
            chapter_counts[ch] = 0
        chapter_counts[ch] += 1

    chapters_summary = [
        ChapterSummaryOut(name=ch, question_count=chapter_counts[ch])
        for ch in chapters
    ]

    creator_name = current_user.full_name or current_user.username if current_user else None

    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        subject_id=quiz.subject_id,
        created_by_id=quiz.created_by_id,
        creator_name=creator_name,
        subject=quiz.subject,
        is_public=quiz.is_public,
        share_code=quiz.share_code,
        created_at=quiz.created_at,
        questions=quiz.questions,
        chapters=chapters,
        chapters_summary=chapters_summary,
        recent_attempts=[]
    )


@router.post("/{quiz_id}/submit", response_model=AttemptSubmitResponse)
def submit_quiz_attempt(
    quiz_id: int,
    submission: AttemptSubmitRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề.")

    questions = quiz.questions
    submitted_q_ids = set(int(k) for k in submission.user_answers.keys() if str(k).isdigit())
    if submitted_q_ids:
        eval_questions = [q for q in questions if q.id in submitted_q_ids]
    else:
        eval_questions = questions

    total_q = len(eval_questions)
    if total_q == 0:
        total_q = len(questions)
        eval_questions = questions

    correct_count = 0
    details = []

    for q in eval_questions:
        user_choice = submission.user_answers.get(str(q.id)) or submission.user_answers.get(q.id)
        if user_choice:
            user_choice = str(user_choice).upper().strip()
        else:
            user_choice = None

        is_correct = (user_choice == q.correct_answer)
        if is_correct:
            correct_count += 1

        details.append({
            "question_id": q.id,
            "chapter": q.chapter,
            "content": q.content,
            "user_choice": user_choice,
            "correct_answer": q.correct_answer,
            "is_correct": is_correct,
            "explanation_a": q.explanation_a,
            "explanation_b": q.explanation_b,
            "explanation_c": q.explanation_c,
            "explanation_d": q.explanation_d
        })

    raw_score = (correct_count / total_q) * 10.0 if total_q > 0 else 0
    final_score = round(raw_score, 2)

    if current_user:
        taker = current_user.full_name or current_user.username
        user_id = current_user.id
    else:
        taker = submission.taker_name.strip() if (submission.taker_name and submission.taker_name.strip()) else "Học viên ẩn danh"
        user_id = None

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user_id,
        taker_name=taker,
        score=final_score
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return AttemptSubmitResponse(
        id=attempt.id,
        quiz_id=quiz.id,
        taker_name=attempt.taker_name,
        score=float(attempt.score),
        total_questions=total_q,
        correct_count=correct_count,
        details=details,
        submitted_at=attempt.submitted_at
    )


def filename_to_chapter(fname: str) -> str:
    base = fname.rsplit('.', 1)[0]
    base = re.sub(r'[_\-]+', ' ', base).strip()
    m = re.match(r'^(chuong|chương|bai|bài|phan|phần|tiết|module|chủ đề|chu de)\s*(\d+|[ivx]+)\s*(.*)$', base, re.IGNORECASE)
    if m:
        kw_prefix = m.group(1).lower()
        if 'ch' in kw_prefix:
            kw = 'Chương'
        elif 'b' in kw_prefix:
            kw = 'Bài'
        elif 'ph' in kw_prefix:
            kw = 'Phần'
        else:
            kw = m.group(1).capitalize()
        num = m.group(2)
        rest = m.group(3).strip(' :.-–—\t')
        return f"{kw} {num}" + (f": {rest.capitalize()}" if rest else "")
    return base.capitalize()


@router.post("/{share_code}/append-pdf", response_model=QuizDetailOut)
async def append_pdf_to_quiz(
    share_code: str,
    files: List[UploadFile] = File(...),
    chapter_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Upload and parse one or multiple PDF files to append their questions directly into an existing Quiz.
    """
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()
    if not quiz and share_code.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(share_code)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề trắc nghiệm này.")

    # Check permission: if quiz belongs to someone else and user is not admin
    if current_user and quiz.created_by_id and quiz.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa bộ đề của người khác."
        )

    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 1 file PDF.")

    fallback_chapter = chapter_name.strip() if (chapter_name and chapter_name.strip()) else None

    new_questions = []
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            continue

        try:
            content = await f.read()
            if len(content) == 0:
                continue

            parsed_questions = parse_pdf_to_questions(content)
            if not parsed_questions:
                continue

            file_default_chapter = fallback_chapter or filename_to_chapter(f.filename)

            for q in parsed_questions:
                detected_ch = q.get("chapter")
                if fallback_chapter:
                    q_chapter = fallback_chapter
                elif detected_ch and detected_ch != "Bài 1":
                    q_chapter = detected_ch
                else:
                    q_chapter = file_default_chapter or detected_ch or "Bài 1"

                new_questions.append(
                    Question(
                        quiz_id=quiz.id,
                        chapter=q_chapter.strip(),
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
        except Exception:
            continue

    if len(new_questions) == 0:
        raise HTTPException(
            status_code=422,
            detail="Không trích xuất được câu hỏi nào từ các file PDF đã chọn."
        )

    db.bulk_save_objects(new_questions)
    db.commit()
    db.refresh(quiz)

    chapters = []
    chapter_counts = {}
    for q in quiz.questions:
        ch = q.chapter or "Bài 1"
        if ch not in chapters:
            chapters.append(ch)
            chapter_counts[ch] = 0
        chapter_counts[ch] += 1

    chapters_summary = [
        ChapterSummaryOut(name=ch, question_count=chapter_counts[ch])
        for ch in chapters
    ]

    attempts = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz.id)\
                 .order_by(QuizAttempt.score.desc(), QuizAttempt.submitted_at.desc())\
                 .limit(10).all()

    creator_name = quiz.creator.full_name or quiz.creator.username if quiz.creator else None

    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        subject_id=quiz.subject_id,
        created_by_id=quiz.created_by_id,
        creator_name=creator_name,
        subject=quiz.subject,
        is_public=quiz.is_public,
        share_code=quiz.share_code,
        created_at=quiz.created_at,
        questions=quiz.questions,
        chapters=chapters,
        chapters_summary=chapters_summary,
        recent_attempts=[
            QuizAttemptOut(
                id=a.id,
                quiz_id=a.quiz_id,
                quiz_title=quiz.title,
                quiz_share_code=quiz.share_code,
                user_id=a.user_id,
                taker_name=a.taker_name,
                score=float(a.score),
                submitted_at=a.submitted_at
            ) for a in attempts
        ]
    )


@router.delete("/{identifier}")
def delete_quiz(
    identifier: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    quiz = db.query(Quiz).filter(Quiz.share_code == identifier).first()
    if not quiz and identifier.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(identifier)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề cần xóa.")

    # Check permission: if quiz has a creator, only creator or admin can delete
    if quiz.created_by_id:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vui lòng đăng nhập để xóa bộ đề này.")
        if quiz.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền xóa bộ đề của người khác.")

    quiz_title = quiz.title
    db.delete(quiz)
    db.commit()

    return {"success": True, "message": f"Đã xóa thành công bộ đề '{quiz_title}'."}


@router.get("/{share_code}/export-pdf")
def export_quiz_pdf(
    share_code: str,
    chapter: Optional[str] = Query(None),
    school_name: str = Query("ĐỀ THI TRẮC NGHIỆM CHUẨN"),
    exam_duration: str = Query("45 phút"),
    include_answers: str = Query("bottom_table"),
    include_explanations: bool = Query(False),
    two_column_options: bool = Query(True),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()
    if not quiz and share_code.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(share_code)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề.")

    questions = quiz.questions
    if chapter and chapter != "all":
        questions = [q for q in questions if (q.chapter or "Bài 1") == chapter]

    q_dicts = [
        {
            "content": unicodedata.normalize("NFC", q.content or ""),
            "option_a": unicodedata.normalize("NFC", q.option_a or ""),
            "option_b": unicodedata.normalize("NFC", q.option_b or ""),
            "option_c": unicodedata.normalize("NFC", q.option_c or ""),
            "option_d": unicodedata.normalize("NFC", q.option_d or ""),
            "correct_answer": q.correct_answer or "A",
            "explanation_a": q.explanation_a,
            "explanation_b": q.explanation_b,
            "explanation_c": q.explanation_c,
            "explanation_d": q.explanation_d,
        }
        for q in questions
    ]

    pdf_bytes = build_quiz_pdf(
        quiz_title=unicodedata.normalize("NFC", quiz.title or ""),
        share_code=quiz.share_code,
        questions=q_dicts,
        school_name=unicodedata.normalize("NFC", school_name),
        exam_duration=exam_duration,
        chapter_name=chapter,
        include_answers=include_answers,
        include_explanations=include_explanations,
        two_column_options=two_column_options
    )

    clean_name = re.sub(r'[^a-zA-Z0-9_\-]+', '_', quiz.title)[:25].strip('_')
    if not clean_name:
        clean_name = "De_Thi"
    filename = f"De_Thi_{clean_name}_{quiz.share_code}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.put("/{identifier}", response_model=QuizDetailOut)
def update_quiz_info(
    identifier: str,
    data: QuizUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Cập nhật tiêu đề, mô tả, chủ đề hoặc chế độ công khai của bộ đề."""
    quiz = db.query(Quiz).filter(Quiz.share_code == identifier).first()
    if not quiz and identifier.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(identifier)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề.")

    if quiz.created_by_id and current_user:
        if quiz.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền sửa bộ đề của người khác.")

    if data.title is not None and data.title.strip():
        quiz.title = data.title.strip()
    if data.description is not None:
        quiz.description = data.description.strip()
    if data.subject_id is not None:
        quiz.subject_id = data.subject_id if data.subject_id > 0 else None
    if data.is_public is not None:
        quiz.is_public = data.is_public

    db.commit()
    db.refresh(quiz)
    return get_quiz_by_share_code(quiz.share_code, db)


@router.put("/{identifier}/rename-chapter")
def rename_quiz_chapter(
    identifier: str,
    data: ChapterRenameRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Đổi tên toàn bộ bài / chương trong bộ đề khi có lỗi chính tả từ file PDF."""
    quiz = db.query(Quiz).filter(Quiz.share_code == identifier).first()
    if not quiz and identifier.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(identifier)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề.")

    if quiz.created_by_id and current_user:
        if quiz.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền sửa bộ đề của người khác.")

    old_name = data.old_chapter_name.strip()
    new_name = data.new_chapter_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Tên bài / chương mới không được để trống.")

    updated_count = db.query(Question).filter(
        Question.quiz_id == quiz.id,
        Question.chapter == old_name
    ).update({"chapter": new_name})

    db.commit()
    return {"success": True, "message": f"Đã đổi tên '{old_name}' thành '{new_name}' cho {updated_count} câu hỏi."}


@router.delete("/{identifier}/chapters")
def delete_quiz_chapter(
    identifier: str,
    chapter_name: str = Query(..., description="Tên bài / chương cần xóa"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Xóa toàn bộ một bài / chương cùng tất cả các câu hỏi thuộc bài đó khỏi bộ đề."""
    quiz = db.query(Quiz).filter(Quiz.share_code == identifier).first()
    if not quiz and identifier.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(identifier)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề.")

    if quiz.created_by_id and current_user:
        if quiz.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền sửa bộ đề của người khác.")

    ch_name = chapter_name.strip()
    if not ch_name:
        raise HTTPException(status_code=400, detail="Tên bài / chương không hợp lệ.")

    deleted_count = db.query(Question).filter(
        Question.quiz_id == quiz.id,
        Question.chapter == ch_name
    ).delete(synchronize_session=False)

    db.commit()
    return {"success": True, "message": f"Đã xóa thành công bài '{ch_name}' gồm {deleted_count} câu hỏi.", "deleted_count": deleted_count}


@router.put("/{identifier}/questions/{question_id}", response_model=QuestionOut)
def update_quiz_question(
    identifier: str,
    question_id: int,
    data: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Chỉnh sửa nội dung, 4 đáp án A-B-C-D, đáp án đúng và lời giải thích của một câu hỏi."""
    quiz = db.query(Quiz).filter(Quiz.share_code == identifier).first()
    if not quiz and identifier.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(identifier)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề.")

    if quiz.created_by_id and current_user:
        if quiz.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền sửa câu hỏi trong bộ đề này.")

    question = db.query(Question).filter(Question.id == question_id, Question.quiz_id == quiz.id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi này trong bộ đề.")

    if data.chapter is not None:
        question.chapter = data.chapter.strip() if data.chapter.strip() else "Bài 1"
    if data.content is not None and data.content.strip():
        question.content = data.content.strip()
    if data.option_a is not None:
        question.option_a = data.option_a.strip()
    if data.option_b is not None:
        question.option_b = data.option_b.strip()
    if data.option_c is not None:
        question.option_c = data.option_c.strip()
    if data.option_d is not None:
        question.option_d = data.option_d.strip()
    if data.correct_answer is not None and data.correct_answer.strip():
        question.correct_answer = data.correct_answer.strip().upper()
    if data.explanation_a is not None:
        question.explanation_a = data.explanation_a.strip()
    if data.explanation_b is not None:
        question.explanation_b = data.explanation_b.strip()
    if data.explanation_c is not None:
        question.explanation_c = data.explanation_c.strip()
    if data.explanation_d is not None:
        question.explanation_d = data.explanation_d.strip()

    db.commit()
    db.refresh(question)
    return QuestionOut.model_validate(question)


@router.delete("/{identifier}/questions/{question_id}")
def delete_quiz_question(
    identifier: str,
    question_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Xóa một câu hỏi cụ thể khỏi bộ đề."""
    quiz = db.query(Quiz).filter(Quiz.share_code == identifier).first()
    if not quiz and identifier.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(identifier)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề.")

    if quiz.created_by_id and current_user:
        if quiz.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền xóa câu hỏi trong bộ đề này.")

    question = db.query(Question).filter(Question.id == question_id, Question.quiz_id == quiz.id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi.")

    db.delete(question)
    db.commit()
    return {"success": True, "message": "Đã xóa câu hỏi thành công."}
