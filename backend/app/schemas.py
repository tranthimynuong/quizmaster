from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# Question Schemas
class QuestionBase(BaseModel):
    chapter: Optional[str] = "Bài 1"
    content: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str = Field(..., pattern="^[A-Da-d]$")
    explanation_a: Optional[str] = None
    explanation_b: Optional[str] = None
    explanation_c: Optional[str] = None
    explanation_d: Optional[str] = None


class QuestionCreate(QuestionBase):
    pass


class QuestionOut(QuestionBase):
    id: int
    quiz_id: int

    class Config:
        from_attributes = True


# Subject Schemas
class SubjectBase(BaseModel):
    name: str
    code: Optional[str] = None


class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None


class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    quiz_count: int = 0

    class Config:
        from_attributes = True


# Quiz Schemas
class QuizBase(BaseModel):
    title: str
    description: Optional[str] = None
    subject_id: Optional[int] = None
    is_public: bool = True


class QuizCreate(QuizBase):
    share_code: Optional[str] = None
    questions: List[QuestionCreate] = []


class QuizSummaryOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    is_public: bool
    share_code: str
    created_at: Optional[datetime] = None
    question_count: int = 0
    attempt_count: int = 0

    class Config:
        from_attributes = True


class QuizAttemptOut(BaseModel):
    id: int
    quiz_id: int
    taker_name: Optional[str] = None
    score: float
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChapterSummaryOut(BaseModel):
    name: str
    question_count: int = 0


class QuizDetailOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    subject_id: Optional[int] = None
    subject: Optional[SubjectOut] = None
    is_public: bool
    share_code: str
    created_at: Optional[datetime] = None
    questions: List[QuestionOut] = []
    chapters: List[str] = []
    chapters_summary: List[ChapterSummaryOut] = []
    recent_attempts: List[QuizAttemptOut] = []

    class Config:
        from_attributes = True


# Attempt Submit Schemas
class AttemptSubmitRequest(BaseModel):
    taker_name: Optional[str] = "Học viên"
    user_answers: dict = {}


class AttemptSubmitResponse(BaseModel):
    id: int
    quiz_id: int
    taker_name: str
    score: float
    total_questions: int
    correct_count: int
    details: List[dict]
    submitted_at: datetime
