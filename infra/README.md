# Local infrastructure

Requirements: Docker Engine/Desktop with Compose v2 supporting `up --wait`, and
free local ports 8000, 5432, 9000 and 9001 (or configure alternatives in `.env`).
Run every command below from repository root.

## Services

| Service | Purpose | Health check |
| --- | --- | --- |
| `api` | Non-root Python/FastAPI container | `/api/v1/health` |
| `postgres` | PostgreSQL 17, data in a named volume | `pg_isready` |
| `minio` | Local S3-compatible object storage | `/minio/health/ready` |

The API starts after both services become healthy. It does not connect to them
in this milestone. Redis, workers, FFmpeg and production Compose are deferred.
The API image includes only the foundation runtime dependencies.

MinIO is built from the pinned upstream source release
[`RELEASE.2025-10-15T17-29-55Z`](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z).
Upstream Community Edition is source-only and the historical public container
images are unavailable. A dedicated multi-stage Dockerfile follows the upstream
source-install approach; Go is used only at build time. The first build downloads
Go modules and can take several minutes. This keeps the requested local MinIO
service without relying on third-party images.

## Start and verify

```sh
cp .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml config --quiet
docker compose --env-file .env -f infra/docker-compose.yml up --build --wait
docker compose --env-file .env -f infra/docker-compose.yml ps
curl --fail http://localhost:8000/api/v1/health
curl --fail http://localhost:8000/openapi.json
curl --fail http://localhost:9000/minio/health/ready
docker compose --env-file .env -f infra/docker-compose.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;"'
```

If you change `APP_PORT` or `MINIO_PORT`, adjust the URLs accordingly. Within
Compose, API always listens on `0.0.0.0`; `APP_HOST` controls the host-side Python
launcher. Published service ports bind to `127.0.0.1`.

View logs or stop without removing data:

```sh
docker compose --env-file .env -f infra/docker-compose.yml logs --tail=100
docker compose --env-file .env -f infra/docker-compose.yml down
```

## Environment and addresses

Compose reads the explicitly passed root `.env`. Do not commit it. Set
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `MINIO_ROOT_USER` and
`MINIO_ROOT_PASSWORD`; the example provides development-only values. Avoid
leaking resolved Compose configuration, which contains these values.

`APP_PORT`, `POSTGRES_PORT`, `MINIO_PORT`, `MINIO_CONSOLE_PORT` control published
ports. Container clients use `postgres:5432` and `http://minio:9000`; clients on
your host use `localhost` with the configured published ports.

`DATABASE_URL` and `S3_*` are reserved for later adapters. When those are added,
keep their credentials consistent with PostgreSQL/MinIO, and URL-encode special
characters in database URLs. Changing `POSTGRES_*` does not change credentials
inside an existing database volume; use SQL to alter the role, or explicitly
reset disposable local data.

## MinIO and future Cloudflare R2

Open http://localhost:9001 and sign in with `MINIO_ROOT_USER` and
`MINIO_ROOT_PASSWORD` from your `.env`. No bucket is provisioned in this
milestone. Bucket setup for `S3_BUCKET` (default `cliphunter`) will accompany the
storage adapter and upload endpoint.

For future R2 integration, set `S3_ENDPOINT_URL` to your account's S3 endpoint,
`S3_REGION=auto`, and supply bucket-scoped credentials through `S3_ACCESS_KEY`
and `S3_SECRET_KEY`. The foundation does not connect to R2. Storage adapters and
signed download URLs will be delivered in later PRs; never commit credentials.
This Compose file is for local development, not a production deployment recipe.

## Persistent volumes

`postgres_data` and `minio_data` preserve database files and objects across
container recreation. Normal `down` keeps them. Back up important data before
changes. To intentionally delete **all local database and object data**:

```sh
docker compose --env-file .env -f infra/docker-compose.yml down --volumes
```

Only run that reset when you explicitly want to discard the local data.
