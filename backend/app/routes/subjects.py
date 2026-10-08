import re
import unicodedata
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..database import get_db
from ..models import Subject, Quiz
from ..schemas import SubjectOut, SubjectCreate, SubjectUpdate

router = APIRouter(prefix="/api/subjects", tags=["Subjects"])


def generate_subject_code(name: str) -> str:
    """Generate a clean code slug from Vietnamese name."""
    s = unicodedata.normalize('NFD', name)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('đ', 'd').replace('Đ', 'D')
    s = re.sub(r'[^a-zA-Z0-9\s]', '', s).strip()
    code = re.sub(r'\s+', '_', s).upper()
    return code[:50] if code else "SUBJ"


@router.get("", response_model=List[SubjectOut])
def get_subjects(db: Session = Depends(get_db)):
    """Get all subjects along with the count of quizzes in each."""
    subjects = db.query(Subject).order_by(Subject.name).all()
    results = []
    for s in subjects:
        q_count = db.query(func.count(Quiz.id)).filter(Quiz.subject_id == s.id).scalar() or 0
        results.append(SubjectOut(
            id=s.id,
            name=s.name,
            code=s.code,
            quiz_count=q_count
        ))
    return results


@router.post("", response_model=SubjectOut)
def create_subject(subject_in: SubjectCreate, db: Session = Depends(get_db)):
    """Create a new subject with optional auto code generation."""
    name = subject_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên chủ đề không được để trống")

    code = (subject_in.code.strip() if subject_in.code else "").upper()
    if not code:
        base_code = generate_subject_code(name)
        code = base_code
        counter = 1
        while db.query(Subject).filter(Subject.code == code).first():
            code = f"{base_code}_{counter}"
            counter += 1
    else:
        existing = db.query(Subject).filter(Subject.code == code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Mã chủ đề '{code}' đã tồn tại")

    subj = Subject(name=name, code=code)
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return SubjectOut(id=subj.id, name=subj.name, code=subj.code, quiz_count=0)


@router.put("/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: int, subject_in: SubjectUpdate, db: Session = Depends(get_db)):
    """Update subject name or code."""
    subj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề")

    if subject_in.name is not None and subject_in.name.strip():
        subj.name = subject_in.name.strip()

    if subject_in.code is not None and subject_in.code.strip():
        new_code = subject_in.code.strip().upper()
        if new_code != subj.code:
            existing = db.query(Subject).filter(Subject.code == new_code).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Mã chủ đề '{new_code}' đã tồn tại")
            subj.code = new_code

    db.commit()
    db.refresh(subj)
    q_count = db.query(func.count(Quiz.id)).filter(Quiz.subject_id == subj.id).scalar() or 0
    return SubjectOut(id=subj.id, name=subj.name, code=subj.code, quiz_count=q_count)


@router.delete("/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    """Delete a subject and unassign its quizzes."""
    subj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề")

    # Set subject_id to NULL on existing quizzes
    db.query(Quiz).filter(Quiz.subject_id == subject_id).update({"subject_id": None})
    db.delete(subj)
    db.commit()
    return {"message": f"Đã xóa chủ đề '{subj.name}' thành công"}
