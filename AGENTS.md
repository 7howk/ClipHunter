# ClipHunter: repository rules

ClipHunter will find highlights in long videos and generate selected clips.
Completed milestones and current scope are documented in BACKEND_INFRA_TASK.md.
Write README files and contributor-facing documentation in Russian.

## Ownership and layout

- Two contributors share the repository. One owns backend, infrastructure,
  database, integrations and their tests; the other owns the frontend.
- `backend/` contains the Python package, API and tests.
- `infra/` contains local Docker Compose and infrastructure documentation.
- `frontend/` contains the React client; its rules are in `frontend/AGENTS.md`
  and its agent definition is `.claude/agents/frontend-developer.md`.
- Backend and infrastructure work must not change frontend code, configuration,
  pages or design without an explicit request. Frontend work must not change
  `backend/` or `infra/`, except the `web` Compose service and the `frontend` CI job.
- The REST API contract is the boundary between them: backend documents it in
  OpenAPI; frontend mirrors it in `frontend/src/shared/api/contracts.ts`.
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
- From `frontend/`, run `npm run typecheck`, `npm run lint`, `npm run lint:fsd`,
  `npm run format:check`, `npm test` and `npm run build` before submitting changes.
- Test meaningful API and business behavior; mock external APIs in unit tests.
  Unit tests must not require running services or real API keys.
- Verify startup and applicable service health before opening a PR; report any
  check that could not run. Document only functionality that actually exists.
- Keep credentials in ignored `.env` files. Commit only safe example values.
  Never log secrets, tokens, signed URLs or complete settings objects.
- Do not commit logs, virtual environments, test videos or temporary scripts.
- Avoid unused dependencies, speculative abstractions and duplicate configs.
