from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from cliphunter.application.dto import CreateProjectInput
from cliphunter.application.projects import CreateVideoProject, GetVideoProject
from cliphunter.domain.entities import (
    ClipStatus,
    GeneratedClip,
    Highlight,
    TranscriptSegment,
    VideoProject,
)
from cliphunter.domain.errors import InvalidInput, NotFound
from cliphunter.infrastructure.config import Settings
from cliphunter.main import create_app
from tests.fakes import MemoryUnitOfWork


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
def test_project_rejects_invalid_title(title: str) -> None:
    with pytest.raises(InvalidInput):
        VideoProject(title=title)


@pytest.mark.parametrize(
    "start,end", [(-1, 1), (1, 1), (2, 1), (0, float("nan")), (0, float("inf"))]
)
def test_transcript_rejects_invalid_timestamps(start: float, end: float) -> None:
    with pytest.raises(InvalidInput):
        TranscriptSegment(project_id=uuid4(), start_time=start, end_time=end, text="text")


def test_highlight_score_and_completed_clip_rules() -> None:
    with pytest.raises(InvalidInput):
        Highlight(
            project_id=uuid4(),
            start_time=0,
            end_time=1,
            score=101,
            category="funny",
            title="Test",
            description="",
            reason="",
        )
    with pytest.raises(InvalidInput):
        GeneratedClip(project_id=uuid4(), highlight_id=uuid4(), status=ClipStatus.COMPLETED)


@pytest.mark.anyio
async def test_create_and_get_project_use_cases() -> None:
    store = {}
    result = await CreateVideoProject(MemoryUnitOfWork(store)).execute(
        CreateProjectInput(title=" Test ")
    )
    assert result.title == "Test"
    assert result.status == "created"
    assert result.original_filename is None
    found = await GetVideoProject(MemoryUnitOfWork(store)).execute(result.id)
    assert found == result
    with pytest.raises(NotFound):
        await GetVideoProject(MemoryUnitOfWork(store)).execute(uuid4())


def test_project_http_lifecycle_and_pagination() -> None:
    store = {}
    app = create_app(Settings(_env_file=None, database_url=None), lambda: MemoryUnitOfWork(store))
    with TestClient(app) as client:
        response = client.post("/api/v1/projects", json={"title": " Мой стрим "})
        assert response.status_code == 201
        project = response.json()
        location = response.headers["location"]
        assert project["title"] == "Мой стрим"
        assert "storage_key" not in project
        assert client.get(location).json() == project
        assert client.get(location + "/status").json()["status"] == "created"
        client.post("/api/v1/projects", json={"title": "Другой"})
        page = client.get("/api/v1/projects?limit=1&offset=1").json()
        assert page["total"] == 2 and len(page["items"]) == 1
        assert page["items"][0]["id"] == project["id"]
        assert client.get(f"/api/v1/projects/{uuid4()}").status_code == 404
        assert client.post("/api/v1/projects", json={"title": "  "}).status_code == 422
        assert client.get("/api/v1/projects?limit=0").status_code == 422
        assert (
            client.get("/api/v1/projects/not-a-uuid").json()["error"]["code"] == "validation_error"
        )


def test_unconfigured_database_has_safe_error() -> None:
    with TestClient(create_app(Settings(_env_file=None, database_url=None))) as client:
        response = client.get("/api/v1/projects")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "service_unavailable"
        assert client.get("/missing").json()["error"]["code"] == "http_error"
