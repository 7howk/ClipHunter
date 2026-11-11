# Backend and infrastructure roadmap

## PR 1: repository foundation (current scope)

- Repository and per-directory agent rules; accurate setup documentation.
- Installable Python 3.12+ package with separated Clean Architecture layers.
- FastAPI application factory, validated environment settings and versioned
  `GET /api/v1/health`; Swagger and OpenAPI.
- Local Docker Compose for API, PostgreSQL and MinIO, health checks and persistent
  data volumes. API runs as a non-root user.
- Pytest API/configuration checks, Ruff, MyPy and CI.

Acceptance: API starts, health returns `{"status":"ok"}`, Swagger/OpenAPI load,
Compose services become healthy, PostgreSQL accepts SQL and MinIO serves its
health endpoint. No credentials or frontend files are committed. PR targets `dev`.

## Later PRs (not implemented here)

1. Database foundation: SQLAlchemy 2, Alembic, entities, repository ports and use cases.
2. Projects and upload: streaming upload, validation, size/duration limits,
   S3-compatible storage (local MinIO / production Cloudflare R2), status tracking.
3. Processing: FFmpeg audio extraction/chunking and a separate worker/queue.
4. AI: Groq Whisper and LLM adapters, bounded retries, timestamp validation,
   structured highlight scoring. Return no highlights when none pass the threshold.
5. Clips: generation for selected highlights, object storage and download links.
6. End-to-end verification and production deployment configuration.

These stages must preserve inward dependencies and keep long jobs outside HTTP
requests. Frontend is owned by a separate contributor. No worker, Redis, FFmpeg,
Groq integration, business endpoints, migrations or production Compose are part
of the foundation PR.
