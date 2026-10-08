from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import (
    UserRegister,
    UserLogin,
    UserOut,
    AuthResponse,
    UserUpdateProfile,
    ChangePasswordRequest
)
from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """Đăng ký tài khoản người dùng mới (Học sinh hoặc Giáo viên)."""
    # Check if email exists
    if db.query(User).filter(User.email.ilike(data.email.strip())).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập."
        )

    # Check if username exists
    clean_username = data.username.strip().lower()
    if db.query(User).filter(User.username.ilike(clean_username)).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác."
        )

    # Validate role - default to student if invalid or not allowed to self-grant admin
    role = data.role.strip().lower() if data.role else "student"
    if role not in ["student", "teacher"]:
        role = "student"

    new_user = User(
        email=data.email.strip().lower(),
        username=clean_username,
        full_name=data.full_name.strip() if data.full_name else None,
        hashed_password=hash_password(data.password),
        role=role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create JWT Token
    token = create_access_token({"sub": str(new_user.id), "role": new_user.role, "username": new_user.username})

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(new_user)
    )


@router.post("/login", response_model=AuthResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Đăng nhập bằng Email hoặc Tên đăng nhập."""
    login_id = data.email_or_username.strip()
    clean_id = login_id.lower()
    
    # Search by email or username (case-insensitive)
    user = db.query(User).filter(
        (User.email.ilike(login_id)) | (User.username.ilike(login_id))
    ).first()

    # Self-healing auto-provision for default system accounts (admin, teacher, student)
    default_system_accounts = {
        "admin": {
            "email": "admin@quizmaster.local",
            "full_name": "Quản Trị Viên Hệ Thống",
            "password": "Admin@123456",
            "role": "admin"
        },
        "admin@quizmaster.local": {
            "email": "admin@quizmaster.local",
            "full_name": "Quản Trị Viên Hệ Thống",
            "password": "Admin@123456",
            "role": "admin"
        },
        "teacher": {
            "email": "teacher@quizmaster.local",
            "full_name": "Giáo Viên Mẫu",
            "password": "Teacher@123456",
            "role": "teacher"
        },
        "student": {
            "email": "student@quizmaster.local",
            "full_name": "Học Viên Mẫu",
            "password": "Student@123456",
            "role": "student"
        }
    }

    if not user and clean_id in default_system_accounts:
        acc_info = default_system_accounts[clean_id]
        if data.password == acc_info["password"]:
            try:
                user = User(
                    email=acc_info["email"],
                    username=acc_info["role"],
                    full_name=acc_info["full_name"],
                    hashed_password=hash_password(acc_info["password"]),
                    role=acc_info["role"],
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            except Exception:
                db.rollback()
                user = db.query(User).filter(
                    (User.email.ilike(acc_info["email"])) | (User.username.ilike(acc_info["role"]))
                ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản không tồn tại. Vui lòng kiểm tra lại Email hoặc Tên đăng nhập."
        )

    # Check password
    is_valid = verify_password(data.password, user.hashed_password)
    
    # Auto-heal default accounts if password matches default definition
    if not is_valid and clean_id in default_system_accounts and data.password == default_system_accounts[clean_id]["password"]:
        user.hashed_password = hash_password(default_system_accounts[clean_id]["password"])
        user.is_active = True
        db.commit()
        db.refresh(user)
        is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mật khẩu không chính xác. Vui lòng thử lại."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị khóa. Vui lòng liên hệ quản trị viên."
        )

    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Lấy thông tin tài khoản hiện tại."""
    return UserOut.model_validate(current_user)


@router.put("/profile", response_model=UserOut)
def update_profile(
    data: UserUpdateProfile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cập nhật thông tin cá nhân (Họ tên, Avatar)."""
    if data.full_name is not None:
        current_user.full_name = data.full_name.strip()
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url.strip()

    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Đổi mật khẩu tài khoản."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không đúng."
        )

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công."}
