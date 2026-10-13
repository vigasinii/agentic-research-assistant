from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "research_documents"
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_RETRIEVAL_ITERATIONS: int = 3
    TOP_K: int = 5
    EVAL_API_KEY: str = "eval-secret-change-me"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    @field_validator("GROQ_API_KEY")
    @classmethod
    def groq_api_key_must_be_set(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "GROQ_API_KEY is required but not set. "
                "Please set it in your .env file or environment variables."
            )
        return v


settings = Settings()
