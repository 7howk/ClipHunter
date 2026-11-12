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

## Агентная разработка: методология проекта

ClipHunter разрабатывается совместно человеком и AI-агентами (Claude Code,
Codex, Cursor и др.). Этот раздел описывает, как организована их работа, чтобы
результат был воспроизводимым и проверяемым.

### Иерархия инструкций

Агент читает инструкции от общего к частному; при конфликте действует более
строгое правило:

| Уровень         | Файл                                            | Что задаёт                                   |
| --------------- | ----------------------------------------------- | -------------------------------------------- |
| Репозиторий     | `AGENTS.md` (этот файл)                         | границы владения, архитектура, git, качество |
| Подсистема      | `backend/`, `infra/`, `frontend/` + `AGENTS.md` | стек, структура, рабочий цикл, запреты       |
| Роль            | `.claude/agents/frontend-developer.md`          | специализированный агент клиента             |
| Контекст задачи | `BACKEND_INFRA_TASK.md`                         | выполненные этапы и текущий объём работ      |

### Роли и границы

- **Человек** ставит задачу, принимает решения о контракте API, ревьюит PR и
  решает, что вливать. Агент не расширяет задачу сам.
- **Агент backend/infra** работает в `backend/` и `infra/`, не трогает фронтенд.
- **Агент frontend** (`frontend-developer`) работает в `frontend/`, не трогает
  backend; недостающие endpoint'ы имитирует по контракту и явно помечает.
- **Контракт REST API** — единственная точка соприкосновения: backend описывает
  его в OpenAPI, frontend отражает в `frontend/src/shared/api/contracts.ts`.

Разделение владения нужно, чтобы параллельная работа двух людей и их агентов
не приводила к конфликтам и «молчаливым» изменениям чужого кода.

### Рабочий цикл агента

1. **Разведка.** Прочитать задачу, `git status`, ветку, затронутые модули и
   AGENTS.md подсистемы. Чужие изменения не трогать.
2. **План.** Определить слой (domain / application / infrastructure /
   presentation или слайс FSD) для каждого изменения. Без абстракций «на будущее».
3. **Реализация** маленькими шагами и Conventional Commits.
4. **Автоматическая проверка** — команды из раздела «Quality and security».
5. **Независимая проверка.** Перед «готово» результат смотрит не автор правки:
   перечитать diff, запустить линтеры и тесты заново, проверить крайние случаи.
6. **Отчёт.** Что сделано, как проверено, что не удалось проверить и почему.

### Принципы надёжной работы агента

- **Честная отчётность.** Не писать «готово», если проверка не запускалась или
  упала; провал показывать с выводом. Документировать только то, что есть.
- **Не выдумывать данные.** Продуктовый принцип: пустой результат показывается
  как пустой, имитация всегда помечена в интерфейсе и в документации.
- **Минимальные полномочия.** Агент правит только свою зону; необратимые и
  внешние действия (push, PR, merge, удаление) выполняются по явной просьбе человека.
- **Секреты вне контекста.** Ключи только в ignored `.env`; в логи, коммиты и
  запросы к внешним сервисам они не попадают.
- **Воспроизводимость.** Любой вывод агента проверяем командой из репозитория;
  unit-тесты не требуют сервисов и реальных ключей.

### Git и ревью агентской работы

- Ветка `feature/<область>-<задача>` от актуального `dev`, PR — в `dev`.
- Прямой push в `main` и `dev`, force-push общих веток запрещены.
- Один коммит — одно законченное изменение; сообщение объясняет назначение.
- Коммиты и PR, созданные агентом, содержат атрибуцию (`Co-Authored-By`,
  пометка Claude Code в описании PR), чтобы вклад агента был виден в истории.
- Человек просматривает diff до влития; результаты CI и локальных проверок
  указываются в описании PR.

### Definition of Done

Задача завершена, когда одновременно выполнено всё:

- проверки подсистемы зелёные (backend: ruff, mypy, pytest; frontend:
  typecheck, lint, lint:fsd, format:check, test, build; infra: валидный Compose);
- запуск и health затронутых сервисов подтверждены, либо в отчёте сказано, что
  именно не удалось проверить;
- документация (на русском) описывает фактическое поведение;
- в diff нет секретов, логов, временных скриптов и чужих изменений;
- PR открыт в `dev` с описанием «что сделано / как проверено».
