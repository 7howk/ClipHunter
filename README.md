# ClipHunter

ClipHunter — веб-приложение для поиска интересных моментов в длинных видео и
создания клипов из выбранных пользователем фрагментов. Цель MVP — загрузка видео,
распознавание речи, оценка и ранжирование хайлайтов, нарезка и скачивание клипов.

Сейчас подготовлен **фундамент backend и локальной инфраструктуры**. Код этого
этапа находится в ветке [`dev`](https://github.com/7howk/ClipHunter/tree/dev).
В `main` пока опубликовано описание проекта. Создание, список, просмотр проектов и их статусы уже доступны.
Загрузка и обработка видео появятся на следующих этапах. Frontend разрабатывает отдельный участник команды.

## Что уже готово в dev

- FastAPI с API проектов, `GET /api/v1/health`, Swagger UI и OpenAPI.
- PostgreSQL через SQLAlchemy 2.0, транзакции и миграции Alembic.
- Проверка настроек окружения и разделение слоёв по Clean Architecture.
- Локальные PostgreSQL и MinIO с постоянными томами и проверками готовности.
- Тесты Pytest, проверки Ruff и MyPy, автоматические проверки GitHub Actions.

Стек текущего этапа: Python 3.12+, FastAPI, Pydantic v2, Uvicorn, PostgreSQL 17,
MinIO, SQLAlchemy 2.0, Alembic и Docker Compose. FFmpeg, Groq, обработчик фоновых задач
и интеграция с Cloudflare R2 предусмотрены
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

Ожидаемый ответ: `{"status":"ok"}`. Значения паролей в `.env.example` предназначены
для локальной разработки; свои настройки указывайте в игнорируемом Git файле
`.env`. Первая сборка MinIO из исходного кода может занять несколько минут.

| Сервис | Локальный адрес |
| --- | --- |
| Swagger UI | http://localhost:8000/docs |
| OpenAPI | http://localhost:8000/openapi.json |
| PostgreSQL | localhost:5432 |
| S3 API MinIO | http://localhost:9000 |
| Консоль MinIO | http://localhost:9001 |

Опубликованные порты доступны только с локального компьютера. Метод проверки
API подтверждает работу процесса приложения; готовность PostgreSQL и MinIO
проверяется отдельно в Compose. API сохраняет проекты в PostgreSQL. Подключение к объектному хранилищу
будет добавлено вместе с загрузкой видео.

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
    infrastructure/      # настройки окружения; адаптеры появятся позже
    presentation/http/   # HTTP-метод проверки состояния и схема ответа
  tests/
  Dockerfile
  pyproject.toml
  requirements.lock
infra/
  docker-compose.yml
  minio/Dockerfile
.github/workflows/checks.yml
```

Зависимости направлены внутрь. Domain не зависит от фреймворков, application
работает через интерфейсы, infrastructure реализует внешние подключения,
presentation отвечает за HTTP. В domain описаны четыре сущности, а в application — сценарии создания,
получения и списка проектов. SQLAlchemy и HTTP остаются во внешних слоях.

## Документация

- [Backend: установка, проверки и контракт API](https://github.com/7howk/ClipHunter/blob/dev/backend/README.md)
- [Инфраструктура: запуск, порты, хранилище и тома](https://github.com/7howk/ClipHunter/blob/dev/infra/README.md)
- [Объём foundation и план развития](https://github.com/7howk/ClipHunter/blob/dev/BACKEND_INFRA_TASK.md)
- [Правила работы в репозитории](https://github.com/7howk/ClipHunter/blob/dev/AGENTS.md)

Новые задачи выполняются в отдельных ветках от `dev` и поступают в неё через PR.
Прямые push в `main` и `dev` запрещены. Релизы переносятся из `dev` в `main`
отдельным PR. Для коммитов используется Conventional Commits; перед PR необходимо
выполнить проверки, описанные в документации.
