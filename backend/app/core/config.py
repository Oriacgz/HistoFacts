"""
Application configuration via Pydantic Settings.

Reads from environment variables or a .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Central settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ──────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/histofacts"

    # ── JWT ───────────────────────────────────────────────────
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    notes_context_limit: int = Field(default=8192, ge=4096, le=131072)
    notes_memory_dense_enabled: bool = False
    notes_session_window_tokens: int = Field(default=150000, ge=1000, le=1000000)
    notes_research_think_output_tokens: int = Field(default=3072, ge=2048, le=4096)

    # ── CORS ──────────────────────────────────────────────────
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list with automatic localhost/127.0.0.1 alias support."""
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        expanded = set(origins)
        for o in origins:
            if "localhost" in o:
                expanded.add(o.replace("localhost", "127.0.0.1"))
            elif "127.0.0.1" in o:
                expanded.add(o.replace("127.0.0.1", "localhost"))
        return list(expanded)

    # ── LLM — LM Studio / Qwen3-VL-4B-Thinking ─────────────────
    # Override these via environment variables for cloud deployments.
    # llm_base_url must point to an OpenAI-compatible inference endpoint.
    llm_base_url: str = "http://localhost:1234/v1"   # LM Studio default port
    llm_model: str = "qwen3-vl-4b-thinking"           # exact model ID from LM Studio
    llm_api_key: str = "not-needed"                  # local inference; no real key required
    llm_provider: str = "lm_studio"
    notes_llm_base_url: str = "http://127.0.0.1:11434/v1"
    notes_llm_model: str = "llama3.2:3b"
    notes_thinking_llm_base_url: str | None = None
    notes_thinking_llm_model: str | None = None
    # Web Research stays unavailable until a server-side free-tier key is set.
    tavily_api_key: str = ""
    quiz_llm_base_url: str | None = "http://127.0.0.1:11434/v1"
    quiz_llm_model: str | None = "llama3.2:3b"
    quiz_generation_timeout_seconds: int = Field(default=150, ge=10, le=300)
    quiz_context_length: int = Field(default=8192, ge=2048)

    # ── Wikimedia API ─────────────────────────────────────────
    wikimedia_api_token: str = ""

    gemini_api_key: str = ""
    groq_api_key: str = ""

    # ── Tenor GIF Search (community comments, chat) ───────────
    tenor_api_key: str = ""

    # ── Redis ─────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Microservices Discovery URLs ──────────────────────────
    auth_service_url: str = "http://127.0.0.1:8001"
    history_service_url: str = "http://127.0.0.1:8002"
    social_service_url: str = "http://127.0.0.1:8003"
    groups_service_url: str = "http://127.0.0.1:8004"
    notes_service_url: str = "http://127.0.0.1:8005"
    quiz_service_url: str = "http://127.0.0.1:8006"
    notification_service_url: str = "http://127.0.0.1:8007"


# Singleton — import this everywhere
settings = Settings()

