from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from .database import Base

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)

    quizzes = relationship("Quiz", back_populates="subject", cascade="all, delete-orphan")


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=True)
    share_code = Column(String(20), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    subject = relationship("Subject", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan", order_by="Question.id")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan", order_by="desc(QuizAttempt.submitted_at)")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    chapter = Column(String(150), nullable=True, default="Bài 1") # Phân loại theo Bài / Chương / Chủ đề
    content = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_answer = Column(String(1), nullable=False) # 'A', 'B', 'C', 'D'
    explanation_a = Column(Text, nullable=True)
    explanation_b = Column(Text, nullable=True)
    explanation_c = Column(Text, nullable=True)
    explanation_d = Column(Text, nullable=True)

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    taker_name = Column(String(100), nullable=True, default="Học viên ẩn danh")
    score = Column(Numeric(4, 2), nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    quiz = relationship("Quiz", back_populates="attempts")
