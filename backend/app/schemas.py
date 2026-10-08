from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


# ================= USER & AUTH SCHEMAS =================
class UserRegister(BaseModel):
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    role: Optional[str] = "student"  # "student" or "teacher"


class UserAdminCreate(BaseModel):
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    role: str = Field(default="student", pattern="^(admin|teacher|student)$")


class UserLogin(BaseModel):
    email_or_username: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdateProfile(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserUpdateRole(BaseModel):
    role: str = Field(..., pattern="^(admin|teacher|student)$")


class UserUpdateStatus(BaseModel):
    is_active: bool


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# ================= QUESTION SCHEMAS =================
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


class QuestionUpdate(BaseModel):
    chapter: Optional[str] = None
    content: Optional[str] = None
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: Optional[str] = Field(None, pattern="^[A-Da-d]$")
    explanation_a: Optional[str] = None
    explanation_b: Optional[str] = None
    explanation_c: Optional[str] = None
    explanation_d: Optional[str] = None


class QuestionOut(QuestionBase):
    id: int
    quiz_id: int

    class Config:
        from_attributes = True


# ================= SUBJECT SCHEMAS =================
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


# ================= QUIZ SCHEMAS =================
class QuizBase(BaseModel):
    title: str
    description: Optional[str] = None
    subject_id: Optional[int] = None
    is_public: bool = True


class QuizCreate(QuizBase):
    share_code: Optional[str] = None
    questions: List[QuestionCreate] = []


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject_id: Optional[int] = None
    is_public: Optional[bool] = None


class ChapterRenameRequest(BaseModel):
    old_chapter_name: str
    new_chapter_name: str


class QuizSummaryOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    created_by_id: Optional[int] = None
    creator_name: Optional[str] = None
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
    quiz_title: Optional[str] = None
    quiz_share_code: Optional[str] = None
    user_id: Optional[int] = None
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
    created_by_id: Optional[int] = None
    creator_name: Optional[str] = None
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


# ================= ATTEMPT SUBMIT SCHEMAS =================
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
