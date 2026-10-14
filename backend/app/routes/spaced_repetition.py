from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models import Quiz, Question, UserCardReview, User
from ..auth import get_current_user_optional
from ..services.spaced_repetition import calculate_sm2

router = APIRouter(prefix="/api/quizzes/{quiz_id}/spaced", tags=["Spaced Repetition"])


class ReviewCardRequest(BaseModel):
    question_id: int
    grade: int = Field(..., ge=1, le=4, description="1: Again, 2: Hard, 3: Good, 4: Easy")


class CardReviewOut(BaseModel):
    id: Optional[int] = None
    question_id: int
    chapter: Optional[str] = "Bài 1"
    content: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    explanation_a: Optional[str] = None
    explanation_b: Optional[str] = None
    explanation_c: Optional[str] = None
    explanation_d: Optional[str] = None
    
    # SM-2 info
    repetition: int = 0
    interval_days: int = 1
    ease_factor: float = 2.50
    state: str = "new" # new, learning, review, mastered
    last_grade: Optional[int] = None
    next_review_at: Optional[datetime] = None
    is_due: bool = True


class SpacedStatsOut(BaseModel):
    quiz_id: int
    total_cards: int
    due_today: int
    new_cards: int
    learning: int
    mastered: int
    retention_score: int


@router.get("/cards", response_model=List[CardReviewOut])
def get_spaced_cards_for_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề thi.")

    now = datetime.now(timezone.utc)
    user_id = current_user.id if current_user else None

    # Get all reviews for this user on this quiz
    reviews_map = {}
    if user_id:
        user_reviews = db.query(UserCardReview).filter(
            UserCardReview.quiz_id == quiz_id,
            UserCardReview.user_id == user_id
        ).all()
        for r in user_reviews:
            reviews_map[r.question_id] = r

    result = []
    for q in quiz.questions:
        rev = reviews_map.get(q.id)
        if rev:
            is_due = (rev.next_review_at is None) or (rev.next_review_at <= now)
            result.append(CardReviewOut(
                id=rev.id,
                question_id=q.id,
                chapter=q.chapter,
                content=q.content,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_answer=q.correct_answer,
                explanation_a=q.explanation_a,
                explanation_b=q.explanation_b,
                explanation_c=q.explanation_c,
                explanation_d=q.explanation_d,
                repetition=rev.repetition,
                interval_days=rev.interval_days,
                ease_factor=float(rev.ease_factor),
                state=rev.state,
                last_grade=rev.last_grade,
                next_review_at=rev.next_review_at,
                is_due=is_due
            ))
        else:
            # Fresh card
            result.append(CardReviewOut(
                question_id=q.id,
                chapter=q.chapter,
                content=q.content,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_answer=q.correct_answer,
                explanation_a=q.explanation_a,
                explanation_b=q.explanation_b,
                explanation_c=q.explanation_c,
                explanation_d=q.explanation_d,
                repetition=0,
                interval_days=1,
                ease_factor=2.50,
                state="new",
                last_grade=None,
                next_review_at=now,
                is_due=True
            ))

    # Sort: Due cards first, then new, then future reviews
    result.sort(key=lambda c: (not c.is_due, c.state != 'new', c.next_review_at or now))
    return result


@router.post("/review", response_model=CardReviewOut)
def submit_card_review(
    quiz_id: int,
    req: ReviewCardRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    question = db.query(Question).filter(Question.id == req.question_id, Question.quiz_id == quiz_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi.")

    user_id = current_user.id if current_user else None
    
    # Find existing review
    review = None
    if user_id:
        review = db.query(UserCardReview).filter(
            UserCardReview.quiz_id == quiz_id,
            UserCardReview.question_id == req.question_id,
            UserCardReview.user_id == user_id
        ).first()

    curr_rep = review.repetition if review else 0
    curr_interval = review.interval_days if review else 1
    curr_ease = float(review.ease_factor) if review else 2.50

    # Calculate SM-2
    new_rep, new_interval, new_ease, next_at, new_state = calculate_sm2(
        grade=req.grade,
        current_repetition=curr_rep,
        current_interval=curr_interval,
        current_ease=curr_ease
    )

    if not review:
        review = UserCardReview(
            user_id=user_id,
            quiz_id=quiz_id,
            question_id=req.question_id,
            repetition=new_rep,
            interval_days=new_interval,
            ease_factor=new_ease,
            last_grade=req.grade,
            state=new_state,
            next_review_at=next_at
        )
        db.add(review)
    else:
        review.repetition = new_rep
        review.interval_days = new_interval
        review.ease_factor = new_ease
        review.last_grade = req.grade
        review.state = new_state
        review.last_reviewed_at = datetime.now(timezone.utc)
        review.next_review_at = next_at

    db.commit()
    db.refresh(review)

    return CardReviewOut(
        id=review.id,
        question_id=question.id,
        chapter=question.chapter,
        content=question.content,
        option_a=question.option_a,
        option_b=question.option_b,
        option_c=question.option_c,
        option_d=question.option_d,
        correct_answer=question.correct_answer,
        explanation_a=question.explanation_a,
        explanation_b=question.explanation_b,
        explanation_c=question.explanation_c,
        explanation_d=question.explanation_d,
        repetition=review.repetition,
        interval_days=review.interval_days,
        ease_factor=float(review.ease_factor),
        state=review.state,
        last_grade=review.last_grade,
        next_review_at=review.next_review_at,
        is_due=False
    )


@router.get("/stats", response_model=SpacedStatsOut)
def get_spaced_repetition_stats(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi.")

    total_questions = len(quiz.questions)
    if total_questions == 0:
        return SpacedStatsOut(
            quiz_id=quiz_id,
            total_cards=0,
            due_today=0,
            new_cards=0,
            learning=0,
            mastered=0,
            retention_score=100
        )

    now = datetime.now(timezone.utc)
    user_id = current_user.id if current_user else None

    if not user_id:
        return SpacedStatsOut(
            quiz_id=quiz_id,
            total_cards=total_questions,
            due_today=total_questions,
            new_cards=total_questions,
            learning=0,
            mastered=0,
            retention_score=0
        )

    reviews = db.query(UserCardReview).filter(
        UserCardReview.quiz_id == quiz_id,
        UserCardReview.user_id == user_id
    ).all()

    reviewed_q_ids = {r.question_id for r in reviews}
    new_count = total_questions - len(reviewed_q_ids)
    
    due_today = 0
    learning_count = 0
    mastered_count = 0

    for r in reviews:
        if r.state == "mastered":
            mastered_count += 1
        elif r.state in ("learning", "review"):
            learning_count += 1

        if r.next_review_at is None or r.next_review_at <= now:
            due_today += 1

    # Add unreviewed cards to due today
    due_today += new_count

    retention_score = int(round((mastered_count * 1.0 + learning_count * 0.5) / total_questions * 100))

    return SpacedStatsOut(
        quiz_id=quiz_id,
        total_cards=total_questions,
        due_today=due_today,
        new_cards=new_count,
        learning=learning_count,
        mastered=mastered_count,
        retention_score=retention_score
    )
