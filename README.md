# ClipHunter

ClipHunter will find interesting moments in long videos and generate clips chosen
by the user. The goal is an MVP with upload, transcription, highlight ranking and
clip downloads. This repository currently contains **only the backend and local
infrastructure foundation**. Video processing and business endpoints are not yet
implemented. A separate contributor owns frontend.

## Available now

- FastAPI with `GET /api/v1/health`, Swagger UI and OpenAPI.
- Validated environment settings and separate Clean Architecture packages.
- Local PostgreSQL and MinIO with persistent volumes and service health checks.
- Pytest, Ruff, MyPy and GitHub Actions checks.

Foundation stack: Python 3.12+, FastAPI, Pydantic v2, Uvicorn, PostgreSQL 17,
MinIO and Docker Compose. SQLAlchemy/Alembic, FFmpeg, Groq, worker/queue and
Cloudflare R2 integration belong to [later PRs](BACKEND_INFRA_TASK.md).

## Quick start

Install Docker with the Compose v2 plugin, then run from repository root:

```sh
cp .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml up --build --wait
curl --fail http://localhost:8000/api/v1/health
```

The response is `{"status":"ok"}`. Sample credentials in `.env.example` are for
local development; edit the ignored `.env` for your environment.

| Service | Local address |
| --- | --- |
| Swagger UI | http://localhost:8000/docs |
| OpenAPI | http://localhost:8000/openapi.json |
| PostgreSQL | localhost:5432 |
| MinIO S3 API | http://localhost:9000 |
| MinIO console | http://localhost:9001 |

All published ports bind to loopback. The API health endpoint checks the API
process only; Compose checks PostgreSQL and MinIO separately. The foundation API
does not yet read or write either service.

Stop while preserving data:

```sh
docker compose --env-file .env -f infra/docker-compose.yml down
```

## Structure and architecture

```text
backend/
  src/cliphunter/
    main.py              # composition root
    domain/              # business rules and repository ports (future)
    application/         # use cases and service ports (future)
    infrastructure/      # environment configuration; adapters added later
    presentation/http/   # health route and response schema
  tests/
  Dockerfile
  pyproject.toml
  requirements.lock
infra/
  docker-compose.yml
.github/workflows/checks.yml
```

Dependencies point inward. Domain has no framework dependencies; application
uses ports; infrastructure supplies adapters; presentation translates HTTP.
Domain/application packages currently document their boundaries without fake
business implementations or unused subdirectories.

- [Backend setup, checks and API contract](backend/README.md)
- [Infrastructure, ports, storage and volumes](infra/README.md)
- [Foundation scope and roadmap](BACKEND_INFRA_TASK.md)
- [Contributor/agent rules](AGENTS.md)

Feature branches start from `dev` and open PRs into `dev`. Never push directly
to `main`/`dev`; releases enter `main` through a PR from `dev`. Use Conventional
Commits and run the documented checks before opening a PR.
