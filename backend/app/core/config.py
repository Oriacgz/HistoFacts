"""
Application configuration via Pydantic Settings.

Reads from environment variables or a .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # ── CORS ──────────────────────────────────────────────────
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # ── LLM (Phase 5) ────────────────────────────────────────
    llm_api_key: str = ""
    llm_provider: str = "openai"

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

