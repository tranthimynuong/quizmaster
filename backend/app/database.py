from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure connect args for SSL if not in url
connect_args = {}
if "neon.tech" in db_url and "sslmode" not in db_url:
    connect_args["sslmode"] = "require"

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
