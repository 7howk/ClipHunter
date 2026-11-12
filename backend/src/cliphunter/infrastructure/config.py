"""Environment-based settings for the foundation API."""

import tempfile
from pathlib import Path
from typing import Literal, Self
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
        hide_input_in_errors=True,
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_host: str = Field(default="0.0.0.0", min_length=1)
    app_port: int = Field(default=8000, ge=1, le=65535)
    database_url: SecretStr | None = None
    s3_endpoint_url: str | None = None
    s3_access_key: SecretStr | None = None
    s3_secret_key: SecretStr | None = None
    s3_bucket: str = Field(
        default="cliphunter", min_length=3, max_length=63, pattern=r"^[a-z0-9][a-z0-9.-]*[a-z0-9]$"
    )
    s3_region: str = Field(default="us-east-1", min_length=1)
    s3_transfer_timeout_seconds: float = Field(default=300, gt=0, allow_inf_nan=False)
    max_upload_size_mb: int = Field(default=500, ge=1, le=10240)
    max_video_duration_seconds: float = Field(default=1800, gt=0, allow_inf_nan=False)
    upload_temp_dir: Path = Path(tempfile.gettempdir()) / "cliphunter-uploads"
    upload_disk_reserve_mb: int = Field(default=64, ge=0)
    max_concurrent_uploads: int = Field(default=2, ge=1, le=32)
    upload_timeout_seconds: float = Field(default=900, gt=0, allow_inf_nan=False)
    ffprobe_timeout_seconds: float = Field(default=20, gt=0, allow_inf_nan=False)

    @field_validator("s3_endpoint_url", mode="before")
    @classmethod
    def validate_s3_endpoint(cls, value: str | None) -> str | None:
        if not value:
            return None
        parts = urlsplit(value)
        if (
            parts.scheme not in ("http", "https")
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
            or parts.path not in ("", "/")
        ):
            raise ValueError(
                "S3_ENDPOINT_URL должен быть HTTP(S)-адресом без секретов и параметров"
            )
        return value.rstrip("/")

    @model_validator(mode="after")
    def validate_storage_credentials(self) -> Self:
        if self.s3_endpoint_url and not (
            self.s3_access_key
            and self.s3_access_key.get_secret_value()
            and self.s3_secret_key
            and self.s3_secret_key.get_secret_value()
        ):
            raise ValueError("Для S3 требуются S3_ACCESS_KEY и S3_SECRET_KEY")
        return self

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            try:
                url = make_url(value.get_secret_value())
                if url.drivername != "postgresql+asyncpg" or not url.database:
                    raise ValueError
            except Exception:
                raise ValueError(
                    "DATABASE_URL must use postgresql+asyncpg and name a database"
                ) from None
        return value
