# ClipHunter backend

The foundation provides an installable FastAPI application, environment settings,
a liveness endpoint and API documentation. It does not yet implement projects,
uploads, database access, storage access, video processing or AI integrations.

## Architecture

The `src/cliphunter` package separates four layers:

| Package | Responsibility |
| --- | --- |
| `domain` | Future business entities and repository ports; standard library only |
| `application` | Future use cases/DTOs/service interfaces; depends inward |
| `infrastructure` | Environment settings; future DB/storage/external adapters |
| `presentation/http` | HTTP routes and Pydantic response schemas |

`main.py` wires these layers together through `create_app()`. Domain and
application have no business implementations in this milestone. The health route
has no business logic and requires no fake use case or repository.

Runtime: Python 3.12–3.14, FastAPI, Pydantic v2/settings, Uvicorn. Tests and checks:
Pytest, HTTPX2 (Starlette TestClient), Ruff, MyPy. Runtime transitive dependencies are pinned in
`requirements.lock`; Docker installs them without development tools.

## Run without Docker

From repository root, using Python 3.12+:

```sh
python3 -m venv backend/.venv
. backend/.venv/bin/activate
python -m pip install -c backend/requirements.lock -e './backend[dev]'
cp .env.example .env
python -m cliphunter
```

Settings load `.env` from the working directory; process environment variables
take precedence. Run the API from repository root to read the shared `.env`.
The following settings are active now:

| Variable | Default | Validation |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test`, `production` |
| `APP_HOST` | `0.0.0.0` | Nonempty bind address |
| `APP_PORT` | `8000` | Integer, 1–65535 |

Other `.env.example` values configure Compose or reserve names for later PRs.
They are not active database/storage/AI connections in the API. Do not log the
complete settings or environment. Production deployment is outside this PR.

For development reload, run from repository root in the activated environment:

```sh
python -m uvicorn cliphunter.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

## API contract

`GET /api/v1/health` returns HTTP 200 and `application/json`:

```json
{"status": "ok"}
```

This is liveness only. It does not assert DB/storage readiness. No authentication
or business endpoints are implemented. Swagger: http://localhost:8000/docs;
OpenAPI: http://localhost:8000/openapi.json. Future business endpoints will use
`/api/v1` and a documented common error format.

## Checks

With the development environment activated, from `backend/`:

```sh
ruff check .
ruff format --check .
mypy src
pytest
```

Tests exercise the HTTP contract, app factory isolation and configuration
validation. They require no PostgreSQL, MinIO or API keys. CI runs these checks
on Python 3.12 and 3.13 and verifies the full Compose stack separately.

## Database migrations

There are no ORM models or migrations yet. Do not run Alembic or expect tables
from this PR. SQLAlchemy 2 and Alembic will be introduced in the database PR.

For container setup, refer to [infrastructure instructions](../infra/README.md).
