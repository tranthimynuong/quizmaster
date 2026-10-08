from app.database import engine, Base, SessionLocal
from app.models import User, Subject, Quiz, Question, QuizAttempt
from app.auth import hash_password
from sqlalchemy import text

def migrate():
    print("Connecting to Neon PostgreSQL...")
    with engine.connect() as conn:
        cols = [r[0] for r in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")).fetchall()]
        print("Current columns in users table:", cols)

        # If old password_hash exists, drop not null constraint or drop column if unused
        if "password_hash" in cols:
            print("Removing NOT NULL constraint or dropping old password_hash column...")
            try:
                conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;"))
                conn.commit()
            except Exception as e:
                print("Notice on altering password_hash:", e)

        needed_cols = {
            "email": "VARCHAR(255) UNIQUE",
            "username": "VARCHAR(100) UNIQUE",
            "full_name": "VARCHAR(255)",
            "hashed_password": "VARCHAR(255)",
            "role": "VARCHAR(50) DEFAULT 'student'",
            "is_active": "BOOLEAN DEFAULT TRUE",
            "avatar_url": "VARCHAR(500)",
            "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"
        }
        for col_name, col_type in needed_cols.items():
            if col_name not in cols:
                print(f"Adding column '{col_name}' to users table...")
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"))
                    conn.commit()
                except Exception as e:
                    print(f"Notice on adding {col_name}: {e}")

        # Ensure quizzes and quiz_attempts columns exist
        quiz_cols = [r[0] for r in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'quizzes'")).fetchall()]
        if "created_by_id" not in quiz_cols:
            print("Adding 'created_by_id' column to quizzes table...")
            try:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
                conn.commit()
            except Exception as e:
                print(f"Notice on adding created_by_id: {e}")

        attempt_cols = [r[0] for r in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'quiz_attempts'")).fetchall()]
        if "user_id" not in attempt_cols:
            print("Adding 'user_id' column to quiz_attempts table...")
            try:
                conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
                conn.commit()
            except Exception as e:
                print(f"Notice on adding user_id: {e}")

    # Seed Admin, Teacher, Student
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            print("Creating Admin account on Neon DB...")
            default_admin = User(
                email="admin@quizmaster.local",
                username="admin",
                full_name="Quản Trị Viên Hệ Thống",
                hashed_password=hash_password("Admin@123456"),
                role="admin",
                is_active=True
            )
            db.add(default_admin)
            db.commit()
            print("Admin created successfully on Neon DB!")

        teacher_user = db.query(User).filter(User.role == "teacher").first()
        if not teacher_user:
            print("Creating Teacher account on Neon DB...")
            demo_teacher = User(
                email="teacher@quizmaster.local",
                username="teacher",
                full_name="Giáo Viên Mẫu",
                hashed_password=hash_password("Teacher@123456"),
                role="teacher",
                is_active=True
            )
            db.add(demo_teacher)
            db.commit()
            print("Teacher created successfully on Neon DB!")

        student_user = db.query(User).filter(User.role == "student").first()
        if not student_user:
            print("Creating Student account on Neon DB...")
            demo_student = User(
                email="student@quizmaster.local",
                username="student",
                full_name="Học Viên Mẫu",
                hashed_password=hash_password("Student@123456"),
                role="student",
                is_active=True
            )
            db.add(demo_student)
            db.commit()
            print("Student created successfully on Neon DB!")

        print("\n=== CURRENT USERS IN NEON POSTGRESQL ===")
        all_users = db.query(User).all()
        for u in all_users:
            print(f"- ID: {u.id} | Username: {u.username} | Email: {u.email} | Role: {u.role} | Active: {u.is_active}")
        print("========================================")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
