# ClipHunter: repository rules

ClipHunter will find highlights in long videos and generate selected clips.
Completed milestones and current scope are documented in BACKEND_INFRA_TASK.md.
Write README files and contributor-facing documentation in Russian.

## Ownership and layout

- This work covers backend, infrastructure, database, integrations and tests.
- Another contributor owns frontend. Do not create a frontend directory or change
  frontend code, configuration, pages or design without an explicit request.
- `backend/` contains the Python package, API and tests.
- `infra/` contains local Docker Compose and infrastructure documentation.
- Follow the additional AGENTS.md in each directory.

## Architecture

Dependencies point inward: presentation/infrastructure → application → domain.
Domain uses the standard library only; no FastAPI, ORM or SDK imports.
Application depends on domain and interfaces, never concrete infrastructure.
Infrastructure implements adapters. Presentation validates HTTP requests and
delegates business work to use cases. `main.py` is the composition root.
Keep controllers thin; avoid circular imports, god objects and duplicate logic.
Add modules when they have a real purpose, rather than empty directory trees.

## Git workflow

- Start feature branches from current `dev`; target PRs at `dev`.
- Never push directly to `main` or `dev`. Never force-push shared branches.
- `main` receives releases through a separate PR from `dev`.
- Inspect existing changes and branches first; preserve others' work.
- Use small Conventional Commits, e.g. `feat(backend): add health endpoint`.
- Do not merge or expand into later milestones unless requested.

## Quality and security

- Use Python 3.12+, type hints, Pydantic v2, Ruff, MyPy and Pytest.
- From `backend/`, run `ruff check .`, `ruff format --check .`, `mypy src`,
  and `pytest` before submitting changes. Validate Compose from repository root.
- Test meaningful API and business behavior; mock external APIs in unit tests.
  Unit tests must not require running services or real API keys.
- Verify startup and applicable service health before opening a PR; report any
  check that could not run. Document only functionality that actually exists.
- Keep credentials in ignored `.env` files. Commit only safe example values.
  Never log secrets, tokens, signed URLs or complete settings objects.
- Do not commit logs, virtual environments, test videos or temporary scripts.
- Avoid unused dependencies, speculative abstractions and duplicate configs.
