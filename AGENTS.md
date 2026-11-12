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

ClipHunter разрабатывается совместно людьми и AI-агентами (Claude Code, Codex,
Cursor и др.). Этот раздел — описание того, как устроена такая работа в
проекте: кто за что отвечает, как агент получает контекст, как проверяется
результат и какие ограничения защищают репозиторий. Всё описанное реально
есть в репозитории и применяется.

### 1. Принципы

1. **Явный контекст вместо догадок.** Агент не помнит прошлых сессий, поэтому
   всё, что ему нужно знать, лежит в файлах репозитория: правила, этапы,
   контракты, команды проверки.
2. **Разделение ответственности.** У каждой зоны кода один владелец-агент с
   узкими полномочиями; пересечения идут только через зафиксированный контракт.
3. **Проверяет не автор.** Автор правки склонен считать её верной, поэтому
   перед «готово» результат смотрит отдельный проверяющий агент.
4. **Человек в контуре.** Постановка задач, решения по контракту, ревью и
   влитие — за человеком; необратимые и внешние действия агент делает только
   по явной просьбе.
5. **Честность важнее скорости.** Провал проверки показывается с выводом;
   непроверенное называется непроверенным.

### 2. Иерархия инструкций

Агент читает инструкции от общего к частному. При конфликте действует более
строгое правило.

| Уровень         | Файл                                            | Что задаёт                                |
| --------------- | ----------------------------------------------- | ----------------------------------------- |
| Вход            | `CLAUDE.md`                                     | подключает `AGENTS.md`, указывает на роли |
| Репозиторий     | `AGENTS.md` (этот файл)                         | владение, архитектура, git, качество      |
| Подсистема      | `backend/`, `infra/`, `frontend/` — `AGENTS.md` | стек, структура, рабочий цикл, запреты    |
| Роль            | `.claude/agents/*.md`                           | специализация, инструменты, модель агента |
| Права           | `.claude/settings.json`                         | разрешённые и запрещённые команды         |
| Контекст задачи | `BACKEND_INFRA_TASK.md`                         | выполненные этапы и текущий объём         |

### 3. Команда агентов

Определения лежат в `.claude/agents/`; у каждого свой набор инструментов
(принцип минимальных полномочий) и модель, подобранная под задачу.

| Агент                | Зона и задача                                             | Инструменты                           | Модель  |
| -------------------- | --------------------------------------------------------- | ------------------------------------- | ------- |
| `backend-developer`  | `backend/`, `infra/`: API, домен, БД, хранилище, Compose  | Read, Write, Edit, Glob, Grep, Bash   | sonnet  |
| `frontend-developer` | `frontend/`: страницы, состояние, интеграция с API, стиль | Read, Write, Edit, Glob, Grep, Bash   | inherit |
| `checker`            | независимая проверка перед «готово»; ничего не правит     | Read, Grep, Glob, Bash                | opus    |
| `explorer`           | поиск по коду и документации; только чтение               | Read, Grep, Glob, WebFetch, WebSearch | haiku   |

Почему так:

- **Агентам, которые пишут код, нужна сильная модель**, поэтому разработчики
  работают на `sonnet` или наследуют модель сессии. Лёгкая `haiku` отдана
  только поиску, где ошибка дёшево исправляется.
- **Проверяющий не имеет `Write` и `Edit`.** Он физически не может «подправить»
  код, чтобы тесты стали зелёными: его выход — отчёт о проблемах.
- **Разведчик не имеет доступа к записи**, поэтому поиск безопасен и не
  засоряет diff.

### 4. Границы владения

- Один владелец занимается backend, infrastructure, БД, интеграциями и их
  тестами; другой — frontend. Агенты наследуют границы своего владельца.
- Backend-агент не меняет код, конфигурацию, страницы и дизайн клиента без
  явной просьбы. Frontend-агент не меняет `backend/` и `infra/`, кроме сервиса
  `web` в Compose и job `frontend` в CI.
- **Контракт REST API — единственная точка соприкосновения.** Backend
  описывает его в OpenAPI, frontend отражает в
  `frontend/src/shared/api/contracts.ts`. Если клиенту нужен endpoint, которого
  нет, агент клиента имитирует его по контракту, помечает имитацию в интерфейсе
  и сообщает в отчёте, что нужно backend. Контракт молча не меняют.
- Чужие изменения и ветки не трогаются: перед работой агент смотрит
  `git status` и существующие ветки.

### 5. Контекст агента: что он читает перед работой

1. `AGENTS.md` репозитория и подсистемы, определение своей роли.
2. `BACKEND_INFRA_TASK.md` — какие этапы выполнены; в будущие этапы агент не
   забегает.
3. `git status`, текущая ветка, затронутые модули и их публичные границы
   (`index.ts` слайса, порты домена).
4. Для задач на стыке — контракт API и по DTO, и по OpenAPI.

### 6. Рабочий цикл

```text
задача → разведка → план → реализация малыми шагами → автопроверка
       → независимая проверка (checker) → исправления → отчёт → PR
```

1. **Разведка.** Прочитать контекст из раздела 5; для широкого поиска
   подключить `explorer`.
2. **План.** Для каждого изменения определить слой (domain / application /
   infrastructure / presentation или слайс FSD). Абстракции «на будущее» не
   добавлять.
3. **Реализация** маленькими шагами; каждый законченный шаг — отдельный
   Conventional Commit.
4. **Автоматическая проверка** командами подсистемы (см. «Quality and
   security»).
5. **Независимая проверка.** `checker` перечитывает diff, перезапускает
   линтеры и тесты, пробует крайние случаи, сверяет границы владения и
   отсутствие секретов. Найденные проблемы исправляет агент-разработчик, а не
   проверяющий; после исправлений проверка повторяется.
6. **Отчёт:** что сделано, как проверено, что не удалось проверить и почему,
   какие изменения контракта затронуты.
7. **PR в `dev`** с описанием «что сделано / как проверено».

Если одна и та же ошибка повторяется второй раз, агент не пробует
наугад: он останавливается, пересматривает подход и при необходимости
возвращается к человеку или проверяющему.

### 7. Ограничения инструментов

Файл `.claude/settings.json` фиксирует права для всех, кто работает с
репозиторием через Claude Code:

- **Разрешены** безопасные проверочные команды: `git status/diff/log`,
  `ruff`, `mypy`, `pytest`, скрипты `npm` для typecheck, lint, test и build.
- **Запрещены** чтение `.env` (секреты не попадают в контекст модели),
  force-push и прямой push в `main` и `dev`.

Это не заменяет правила git, а делает их исполнимыми на уровне инструмента.

### 8. Секреты и приватные данные

- Ключи живут только в ignored `.env`; в репозитории — только безопасные
  примеры в `.env.example`.
- Агент не читает `.env`, не логирует секреты, токены, подписанные URL и
  настройки целиком, не передаёт приватные данные проекта во внешние сервисы.
- У клиента секретов нет по определению: всё приватное живёт в backend.

### 9. Git и ревью агентской работы

- Ветка `feature/<область>-<задача>` от актуального `dev`, PR — в `dev`;
  `main` получает релизы отдельным PR из `dev`.
- Прямой push в `main` и `dev` и force-push общих веток запрещены.
- Коммиты малые, формат Conventional Commits со scope области
  (`feat(backend): …`, `fix(frontend): …`).
- Коммиты и PR агента несут атрибуцию (`Co-Authored-By`, пометка Claude Code в
  описании PR): вклад агента виден в истории.
- Человек просматривает diff до влития; результат CI и локальных проверок
  указывается в описании PR. Влить без CI можно только по явному решению
  человека, и об этом говорится в PR.

### 10. Как оценивается качество агентской работы

| Критерий               | Как проверяется                                                 |
| ---------------------- | --------------------------------------------------------------- |
| Корректность           | тесты и линтеры подсистемы, независимая проверка `checker`      |
| Соблюдение архитектуры | MyPy, Ruff, Steiger (FSD), ревью направления зависимостей       |
| Соблюдение границ      | diff PR не содержит чужих зон                                   |
| Воспроизводимость      | любой вывод агента подтверждается командой из репозитория       |
| Честность отчёта       | в отчёте перечислено непроверенное; провалы приведены с выводом |
| Безопасность           | нет секретов и логов в diff, `.env` не читался                  |

### 11. Definition of Done

Задача завершена, когда одновременно выполнено всё:

- проверки подсистемы зелёные (backend: ruff, mypy, pytest; frontend:
  typecheck, lint, lint:fsd, format:check, test, build; infra: валидный
  Compose);
- старт и health затронутых сервисов подтверждены, либо в отчёте сказано, что
  не удалось проверить;
- независимая проверка `checker` выполнена, замечания закрыты;
- документация (на русском) описывает фактическое поведение;
- в diff нет секретов, логов, временных скриптов и чужих изменений;
- PR открыт в `dev` с описанием «что сделано / как проверено».

### 12. Ограничения подхода

Агенты ошибаются: могут уверенно описать несуществующее, пропустить крайний
случай или выйти за границы задачи. Поэтому проект опирается не на доверие, а
на контроль: узкие полномочия, автоматические проверки, независимый
проверяющий и человек, принимающий итоговое решение.
