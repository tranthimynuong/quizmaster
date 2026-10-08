from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from sqlalchemy import text
from .database import engine, Base, SessionLocal
from .models import User, Subject, Quiz, Question, QuizAttempt
from .routes import subjects, quizzes, pdf, auth, users
from .auth import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="QuizMaster API",
    description="Hệ thống Backend Trắc nghiệm trực tuyến thông minh & Phân quyền RBAC với Neon PostgreSQL",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev/production flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(subjects.router)
app.include_router(quizzes.router)
app.include_router(pdf.router)


def run_database_migrations_and_seed():
    """Ensure database tables & columns exist on Neon PostgreSQL and seed default Admin."""
    db = SessionLocal()
    try:
        logger.info("Initializing database schema on Neon PostgreSQL...")
        Base.metadata.create_all(bind=engine)

        # Run safe alter table commands if tables were created before this update
        with engine.connect() as conn:
            conn.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='users' AND column_name='password_hash'
                    ) THEN
                        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='quizzes' AND column_name='created_by_id'
                    ) THEN
                        ALTER TABLE quizzes ADD COLUMN created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='quiz_attempts' AND column_name='user_id'
                    ) THEN
                        ALTER TABLE quiz_attempts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            """))
            conn.commit()

        # Seed default Admin account if no admin exists
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            logger.info("No Admin account found. Creating default admin account...")
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
            logger.info("Default Admin created: admin@quizmaster.local / Admin@123456")

        # Seed demo Teacher and Student if database is fresh
        teacher_user = db.query(User).filter(User.role == "teacher").first()
        if not teacher_user:
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

        student_user = db.query(User).filter(User.role == "student").first()
        if not student_user:
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

        logger.info("Neon PostgreSQL schema & seed initialization completed.")
    except Exception as e:
        logger.error(f"Error during database startup initialization: {e}")
    finally:
        db.close()


@app.on_event("startup")
def startup_event():
    run_database_migrations_and_seed()


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "QuizMaster Online Quiz & RBAC API",
        "database": "Neon PostgreSQL",
        "docs": "/docs"
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database": "connected", "auth": "jwt_rbac"}
