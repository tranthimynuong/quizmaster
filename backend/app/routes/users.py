from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import User
from ..schemas import UserOut, UserUpdateRole, UserUpdateStatus, UserAdminCreate
from ..auth import get_current_admin, hash_password

router = APIRouter(prefix="/api/users", tags=["User Management (Admin)"])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_by_admin(
    data: UserAdminCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """(Admin Only) Tạo người dùng mới trong hệ thống."""
    # Check if email or username already exists
    if db.query(User).filter(User.email == data.email.lower().strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được sử dụng."
        )
    if db.query(User).filter(User.username == data.username.lower().strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập (username) này đã tồn tại."
        )

    new_user = User(
        email=data.email.lower().strip(),
        username=data.username.lower().strip(),
        full_name=data.full_name.strip() if data.full_name else None,
        role=data.role,
        hashed_password=hash_password(data.password),
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserOut.model_validate(new_user)



@router.get("", response_model=List[UserOut])
def list_users(
    search: Optional[str] = Query(None, description="Tìm kiếm theo tên, email, username"),
    role: Optional[str] = Query(None, description="Lọc theo vai trò"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """(Admin Only) Lấy danh sách toàn bộ người dùng trong hệ thống."""
    query = db.query(User)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (User.email.ilike(search_fmt)) |
            (User.username.ilike(search_fmt)) |
            (User.full_name.ilike(search_fmt))
        )

    if role:
        query = query.filter(User.role == role)

    users = query.order_by(User.id.desc()).all()
    return [UserOut.model_validate(u) for u in users]


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    data: UserUpdateRole,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """(Admin Only) Cập nhật vai trò người dùng (admin, teacher, student)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại.")

    # Prevent admin from demoting themselves
    if user.id == admin.id and data.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự hạ quyền Admin của chính mình."
        )

    user.role = data.role
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: int,
    data: UserUpdateStatus,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """(Admin Only) Khóa hoặc Mở khóa tài khoản."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại.")

    if user.id == admin.id and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự khóa tài khoản của chính mình."
        )

    user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """(Admin Only) Xóa người dùng khỏi hệ thống."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại.")

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự xóa tài khoản của chính mình."
        )

    db.delete(user)
    db.commit()
    return {"message": f"Đã xóa người dùng {user.username} thành công."}
