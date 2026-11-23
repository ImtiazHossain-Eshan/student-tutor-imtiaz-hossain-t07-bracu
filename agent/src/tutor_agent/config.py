"""Settings, read from environment variables or a `.env` file in the project root."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / ".env", env_prefix="TUTOR_", extra="ignore")

    google_api_key: str | None = Field(default=None, validation_alias="GOOGLE_API_KEY")
    groq_api_key: str | None = Field(default=None, validation_alias="GROQ_API_KEY")
    # Model names are "provider:name" (gemini or groq); a bare name means Gemini.
    chat_model: str = "gemini-3.5-flash"
    # Offered first when GROQ_API_KEY is set. Chosen from Groq's live model list on 23 Nov 2026 and tested
    # end to end on four questions: qwen3.8-27b answered all correctly (2.4 s for a full answer);
    # gpt-oss-20b and gpt-oss-120b wrongly answered "not in the material" for questions the course
    # covers, so they are not offered.
    groq_models: list[str] = ["groq:qwen/qwen3.8-27b"]
    # tried in order when the main model is overloaded (503), times out or is rate limited;
    # env: TUTOR_FALLBACK_MODELS='["gemini-3.5-flash-lite"]'
    fallback_models: list[str] = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.1-flash-lite"]
    llm_timeout: float = 25.0  # seconds per model call, so a busy model never hangs a student
    llm_max_retries: int = 1  # one quick retry for a brief 503 spike, then the next fallback
    llm_requests_per_minute: float = 10  # client-side pacing per model, under the free-tier limit; 0 = off
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768  # Matryoshka-truncated from 3072: ~4x smaller index

    # Public deployment (tutor-web on a host). Comma-separated site origins allowed to call the API,
    # e.g. TUTOR_ALLOWED_ORIGINS=https://st-imtiaz-t07.vercel.app ; empty = same-origin only.
    allowed_origins: str = ""
    limit_per_minute: int = 5       # questions per visitor per minute
    limit_per_day: int = 40         # questions per visitor per day
    global_per_day: int = 800       # questions per day for everyone together (protects the API quota)
    trust_proxy: bool = False       # true behind a host's proxy, so limits use the visitor's real address
    show_model_menu: bool = True    # false on a public deployment: one model, no menu

    course_dir: Path = PROJECT_ROOT / "data" / "course"
    sample_dir: Path = PROJECT_ROOT / "data" / "sample"
    st_data_dir: Path = PROJECT_ROOT / "data" / "st"
    index_dir: Path = PROJECT_ROOT / "index"
    cache_dir: Path = PROJECT_ROOT / "cache"

    chunk_chars: int = 1100
    chunk_overlap: int = 150
    retrieve_k: int = 5
    max_retrieval_attempts: int = 2

    @property
    def has_llm(self) -> bool:
        return bool(self.google_api_key or self.groq_api_key)

    @property
    def has_embeddings(self) -> bool:
        """Vector search uses Gemini embeddings, so it needs the Google key specifically."""
        return bool(self.google_api_key)

    def api_keys(self) -> dict[str, str | None]:
        return {"gemini": self.google_api_key, "groq": self.groq_api_key}

    def available_models(self) -> list[str]:
        """Every chat model that has a key, Groq first (fastest), then the Gemini chain."""
        out = list(self.groq_models) if self.groq_api_key else []
        if self.google_api_key:
            out += [m if ":" in m else f"gemini:{m}" for m in [self.chat_model, *self.fallback_models]]
        return list(dict.fromkeys(out))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
