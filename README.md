# ClipHunter

ClipHunter — веб-приложение для поиска интересных моментов в длинных видео и
создания клипов из выбранных пользователем фрагментов. Цель MVP — загрузка видео,
распознавание речи, оценка и ранжирование хайлайтов, нарезка и скачивание клипов.

Сейчас реализованы **фундамент backend, PostgreSQL и загрузка видео**. Код этого
этапа находится в ветке [`dev`](https://github.com/7howk/ClipHunter/tree/dev).
В `main` пока опубликовано описание проекта. Создание, список, просмотр проектов и их статусы уже доступны.
Видео загружается в S3-совместимое хранилище с проверкой формата, размера
и длительности. Обработка видео появится на следующих этапах. Клиент на React
подключён к API: проекты и загрузка идут в backend, а ещё не реализованные этапы
(поиск моментов и нарезка) интерфейс пока имитирует с явной пометкой.

## Что уже готово в dev

- FastAPI с API проектов, `GET /api/v1/health`, Swagger UI и OpenAPI.
- PostgreSQL через SQLAlchemy 2.0, транзакции и миграции Alembic.
- Потоковая загрузка видео в MinIO; настройки совместимы с Cloudflare R2.
- Проверка MIME-типа, расширения, содержимого, размера и длительности видео.
- Проверка настроек окружения и разделение слоёв по Clean Architecture.
- Локальные PostgreSQL и MinIO с постоянными томами и проверками готовности.
- Тесты Pytest, проверки Ruff и MyPy, автоматические проверки GitHub Actions.
- Frontend: лендинг, страница загрузки и страница проекта на React, TypeScript,
  Redux Toolkit (RTK Query) и React Router, архитектура Feature-Sliced Design.

Стек текущего этапа: Python 3.12+, FastAPI, Pydantic v2, Uvicorn, PostgreSQL 17,
MinIO, SQLAlchemy 2.0, Alembic, boto3, ffprobe и Docker Compose. Извлечение аудио
через FFmpeg, Groq и обработчик фоновых задач предусмотрены
[планом следующих этапов](https://github.com/7howk/ClipHunter/blob/dev/BACKEND_INFRA_TASK.md).

## Быстрый запуск

Установите Docker с плагином Compose v2. Получите код из ветки `dev`:

```sh
git clone --branch dev https://github.com/7howk/ClipHunter.git
cd ClipHunter
```

Если репозиторий уже скачан, перейдите в его корень и переключитесь на `dev`.
Затем выполните:

```sh
cp .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml up --build --wait
curl --fail http://localhost:8000/api/v1/health
```

Ожидаемый ответ: `{"status":"ok"}`. Интерфейс открывается на http://localhost:8080. Значения паролей в `.env.example` предназначены
для локальной разработки; свои настройки указывайте в игнорируемом Git файле
`.env`. Первая сборка MinIO из исходного кода может занять несколько минут.

| Сервис | Локальный адрес |
| --- | --- |
| Frontend | http://localhost:8080 |
| Swagger UI | http://localhost:8000/docs |
| OpenAPI | http://localhost:8000/openapi.json |
| PostgreSQL | localhost:5432 |
| S3 API MinIO | http://localhost:9000 |
| Консоль MinIO | http://localhost:9001 |

Опубликованные порты доступны только с локального компьютера. Метод проверки
API подтверждает работу процесса приложения; готовность PostgreSQL и MinIO
проверяется отдельно в Compose. API сохраняет проекты и метаданные в PostgreSQL, а оригиналы видео —
в MinIO. Объекты остаются закрытыми; ссылки на скачивание клипов появятся позже.

## Загрузка видео

Создайте проект:

```sh
curl --fail http://localhost:8000/api/v1/projects \
  -H 'Content-Type: application/json' \
  --data '{"title":"Мой стрим"}'
```

Подставьте полученный `id` в адрес загрузки и укажите существующий видеофайл:

```sh
curl --fail -X POST 'http://localhost:8000/api/v1/projects/<id>/upload?filename=stream.mp4' \
  -H 'Content-Type: video/mp4' \
  --data-binary @stream.mp4
```

Тело запроса содержит само видео; `multipart/form-data` не используется.
По умолчанию допускаются видео до 500 МиБ и 1800 секунд. После загрузки статус
проекта меняется с `created` на `uploaded`. Повторная загрузка в этот проект
возвращает 409. Форматы, ошибки и настройки описаны в документации backend.

Остановка с сохранением данных:

```sh
docker compose --env-file .env -f infra/docker-compose.yml down
```

## Структура и архитектура

Структура ветки `dev`:

```text
backend/
  src/cliphunter/
    main.py              # сборка приложения и подключение компонентов
    domain/              # границы бизнес-логики и интерфейсов репозиториев
    application/         # границы сценариев использования и интерфейсов сервисов
    infrastructure/      # настройки, PostgreSQL, S3, временные файлы и ffprobe
    presentation/http/   # HTTP-метод проверки состояния и схема ответа
  tests/
  Dockerfile
  pyproject.toml
  requirements.lock
frontend/
  src/                   # app, pages, widgets, features, entities, shared (FSD)
  nginx/                 # раздача сборки и прокси /api в контейнере web
  AGENTS.md              # регламент агента клиентской разработки
  Dockerfile
infra/
  docker-compose.yml
  minio/Dockerfile
.claude/agents/          # определение frontend-агента
.github/workflows/checks.yml
```

Зависимости направлены внутрь. Domain не зависит от фреймворков, application
работает через интерфейсы, infrastructure реализует внешние подключения,
presentation отвечает за HTTP. В domain описаны четыре сущности, а в application — сценарии создания,
получения и списка проектов. SQLAlchemy и HTTP остаются во внешних слоях.

## Документация

- [Backend: установка, проверки и контракт API](https://github.com/7howk/ClipHunter/blob/dev/backend/README.md)
- [Frontend: стек, архитектура, режимы API и запуск](https://github.com/7howk/ClipHunter/blob/dev/frontend/README.md)
- [Инфраструктура: запуск, порты, хранилище и тома](https://github.com/7howk/ClipHunter/blob/dev/infra/README.md)
- [Объём foundation и план развития](https://github.com/7howk/ClipHunter/blob/dev/BACKEND_INFRA_TASK.md)
- [Правила работы в репозитории](https://github.com/7howk/ClipHunter/blob/dev/AGENTS.md)

Новые задачи выполняются в отдельных ветках от `dev` и поступают в неё через PR.
Прямые push в `main` и `dev` запрещены. Релизы переносятся из `dev` в `main`
отдельным PR. Для коммитов используется Conventional Commits; перед PR необходимо
выполнить проверки, описанные в документации.
