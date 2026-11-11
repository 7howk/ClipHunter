from fastapi.testclient import TestClient

from cliphunter.infrastructure.config import Settings
from cliphunter.main import create_app


def test_health_and_documented_contract() -> None:
    with TestClient(create_app(Settings(_env_file=None, app_env="test"))) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response.headers["content-type"] == "application/json"

        schema = client.get("/openapi.json").json()
        operation = schema["paths"]["/api/v1/health"]["get"]
        assert "200" in operation["responses"]
        assert client.get("/docs").status_code == 200


def test_app_factory_creates_independent_applications() -> None:
    first = create_app(Settings(_env_file=None, app_env="test"))
    second = create_app(Settings(_env_file=None, app_env="development"))
    assert first is not second
    assert first.state.settings.app_env == "test"
    assert second.state.settings.app_env == "development"
