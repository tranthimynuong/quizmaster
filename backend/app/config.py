import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://neondb_owner:npg_lfMW3iKjFm2B@ep-twilight-art-b3zzjqcc-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    )
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
