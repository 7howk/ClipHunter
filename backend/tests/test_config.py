from pathlib import Path

import pytest
from pydantic import ValidationError

from cliphunter.infrastructure.config import Settings


def test_settings_read_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("APP_HOST", "127.0.0.1")
    monkeypatch.setenv("APP_PORT", "8123")
    settings = Settings(_env_file=None)
    assert (settings.app_env, settings.app_host, settings.app_port) == ("test", "127.0.0.1", 8123)


@pytest.mark.parametrize("port", ["0", "65536", "invalid"])
def test_invalid_port_fails_at_startup(port: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_PORT", port)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_dotenv_accepts_other_services_settings(tmp_path: Path) -> None:
    # Docker passes only APP_* to the API; local .env also has database/storage keys.
    env_file = tmp_path / ".env"
    env_file.write_text("POSTGRES_PASSWORD=sample\nS3_BUCKET=cliphunter\n", encoding="utf-8")
    settings = Settings(_env_file=env_file, app_env="test", app_port=8000)
    assert settings.app_env == "test"
