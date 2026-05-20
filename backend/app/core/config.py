# backend/app/core/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    gemini_api_key:   str
    database_url:     str

    index_dir:        str = "data/index"
    data_dir:         str = "data/raw"

    embedding_model:  str = "gemini-embedding-001"
    generation_model: str = "gemini-2.5-flash"
    grounding_model:  str = "gemini-2.5-flash"   # ← change from flash-lite

    embed_dimensions:  int = 768
    retrieval_top_k:   int = 5
    vector_candidates: int = 20
    bm25_candidates:   int = 20

    class Config:
        env_file          = ".env"
        env_file_encoding = "utf-8"
        case_sensitive    = False

@lru_cache()
def get_settings() -> Settings:
    return Settings()