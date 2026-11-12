# Infrastructure rules

Follow the root AGENTS.md. This milestone provides local development only.

- Run Compose commands from repository root with explicit `--env-file .env`.
- Bind development ports to loopback, use named volumes for stateful services,
  and provide health checks. Use specific image versions, never `latest`.
- Keep secrets out of tracked YAML and images. Fail clearly on missing credentials.
- The `web` service builds `frontend/` and serves it with nginx, proxying `/api`
  to `api`; the frontend owner maintains it. Do not add Redis, workers or
  production deployment until needed.
- Never delete data volumes unless explicitly requested; `down -v` destroys data.
- Validate `docker compose --env-file .env -f infra/docker-compose.yml config --quiet`
  and run the documented startup/service checks when infrastructure changes.
- Document the difference between container hostnames and host-side addresses.
