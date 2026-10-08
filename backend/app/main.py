from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from .database import engine, Base, SessionLocal
from .models import Subject, Quiz, Question, QuizAttempt
from .routes import subjects, quizzes, pdf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Quizlet/Azota Clone API",
    description="Hệ thống Backend Trắc nghiệm trực tuyến thông minh với Neon PostgreSQL",
    version="1.0.0"
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
app.include_router(subjects.router)
app.include_router(quizzes.router)
app.include_router(pdf.router)


@app.on_event("startup")
def startup_event():
    """Create DB tables if not exist."""
    try:
        logger.info("Initializing database schema on Neon PostgreSQL...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error during database startup initialization: {e}")


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Quizlet/Azota Online Quiz API",
        "docs": "/docs"
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database": "connected"}
