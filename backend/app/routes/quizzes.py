from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import secrets
import re
import unicodedata
from ..database import get_db
from ..models import Quiz, Question, Subject, QuizAttempt
from ..services.pdf_parser import parse_pdf_to_questions
from ..services.pdf_generator import build_quiz_pdf
from ..schemas import (
    QuizSummaryOut,
    QuizDetailOut,
    QuizCreate,
    AttemptSubmitRequest,
    AttemptSubmitResponse,
    QuizAttemptOut,
    ChapterSummaryOut
)

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


@router.get("", response_model=List[QuizSummaryOut])
def get_quizzes(
    subject_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(
        Quiz,
        Subject.name.label("subject_name"),
        Subject.code.label("subject_code"),
        func.count(Question.id.distinct()).label("question_count"),
        func.count(QuizAttempt.id.distinct()).label("attempt_count")
    ).outerjoin(Subject, Quiz.subject_id == Subject.id)\
     .outerjoin(Question, Quiz.id == Question.quiz_id)\
     .outerjoin(QuizAttempt, Quiz.id == QuizAttempt.quiz_id)\
     .filter(Quiz.is_public == True)

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

    results = query.group_by(Quiz.id, Subject.name, Subject.code)\
                   .order_by(Quiz.created_at.desc()).all()

    output = []
    for quiz, subject_name, subject_code, q_count, a_count in results:
        output.append(QuizSummaryOut(
            id=quiz.id,
            title=quiz.title,
            description=quiz.description,
            subject_id=quiz.subject_id,
            subject_name=subject_name,
            subject_code=subject_code,
            is_public=quiz.is_public,
            share_code=quiz.share_code,
            created_at=quiz.created_at,
            question_count=q_count,
            attempt_count=a_count
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

    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        subject_id=quiz.subject_id,
        subject=quiz.subject,
        is_public=quiz.is_public,
        share_code=quiz.share_code,
        created_at=quiz.created_at,
        questions=quiz.questions,
        chapters=chapters,
        chapters_summary=chapters_summary,
        recent_attempts=attempts
    )


@router.post("", response_model=QuizDetailOut)
def create_quiz(quiz_in: QuizCreate, db: Session = Depends(get_db)):
    if not quiz_in.title.strip():
        raise HTTPException(status_code=400, detail="Tiêu đề bộ đề không được để trống.")

    share_code = quiz_in.share_code
    if not share_code or db.query(Quiz).filter(Quiz.share_code == share_code).first():
        share_code = generate_share_code(quiz_in.title, db)

    quiz = Quiz(
        title=quiz_in.title.strip(),
        description=quiz_in.description,
        subject_id=quiz_in.subject_id,
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

    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        subject_id=quiz.subject_id,
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
    db: Session = Depends(get_db)
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

    taker = submission.taker_name.strip() if (submission.taker_name and submission.taker_name.strip()) else "Học viên ẩn danh"

    attempt = QuizAttempt(
        quiz_id=quiz.id,
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
    db: Session = Depends(get_db)
):
    """
    Upload and parse one or multiple PDF files to append their questions directly into an existing Quiz.
    """
    quiz = db.query(Quiz).filter(Quiz.share_code == share_code).first()
    if not quiz and share_code.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(share_code)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề trắc nghiệm này.")

    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 1 file PDF.")

    total_added = 0
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

            # File-level chapter title if not specified
            file_default_chapter = fallback_chapter or filename_to_chapter(f.filename)

            for q in parsed_questions:
                # If question has internal chapter, prefer it; otherwise use file_default_chapter
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

    # Return refreshed quiz details
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

    return QuizDetailOut(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        subject_id=quiz.subject_id,
        subject=quiz.subject,
        is_public=quiz.is_public,
        share_code=quiz.share_code,
        created_at=quiz.created_at,
        questions=quiz.questions,
        chapters=chapters,
        chapters_summary=chapters_summary,
        recent_attempts=attempts
    )


@router.delete("/{identifier}")
def delete_quiz(identifier: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.share_code == identifier).first()
    if not quiz and identifier.isdigit():
        quiz = db.query(Quiz).filter(Quiz.id == int(identifier)).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề cần xóa.")

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


