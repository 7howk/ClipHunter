# Локальная инфраструктура

Требования: Docker Engine/Desktop с Compose v2, поддерживающим `up --wait`,
и свободные локальные порты 8000, 5432, 9000 и 9001. Другие порты можно задать
в `.env`. Все команды ниже выполняются из корня репозитория.

## Сервисы

| Сервис | Назначение | Проверка готовности |
| --- | --- | --- |
| `api` | Контейнер Python/FastAPI, работающий без прав root | `/api/v1/health` |
| `postgres` | PostgreSQL 17 с данными в постоянном томе | `pg_isready` |
| `migrate` | Применение миграций до запуска API | Успешный выход с кодом 0 |
| `minio` | Локальное S3-совместимое объектное хранилище | `/minio/health/ready` |

API запускается после успешной проверки PostgreSQL и MinIO. Одноразовый сервис `migrate` применяет миграции Alembic; затем
API работает с PostgreSQL. Интеграция приложения с MinIO появится при загрузке видео. Redis, фоновые обработчики, FFmpeg
и конфигурация production предусмотрены следующими этапами. Образ API содержит
только зависимости, необходимые для работы текущего приложения.

MinIO собирается из официального исходного кода закреплённого выпуска
[`RELEASE.2025-10-15T17-29-55Z`](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z).
Community Edition распространяется в виде исходного кода, а прежние публичные
контейнерные образы недоступны. Отдельный многоэтапный Dockerfile использует
рекомендованный способ установки из исходников; Go нужен только при сборке.
Первая сборка загружает модули Go и может занять несколько минут.

## Запуск и проверка

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

Если `.env` уже настроен, не перезаписывайте его примером. При изменении
`APP_PORT` или `MINIO_PORT` скорректируйте адреса в командах проверки.
Внутри Compose API всегда слушает `0.0.0.0`; `APP_HOST` управляет запуском Python
непосредственно на компьютере. Опубликованные порты привязаны к `127.0.0.1`.

Просмотр логов и остановка с сохранением данных:

```sh
docker compose --env-file .env -f infra/docker-compose.yml logs --tail=100
docker compose --env-file .env -f infra/docker-compose.yml down
```

## Переменные окружения и адреса

Compose читает корневой `.env`, явно указанный в команде. Не добавляйте его в Git.
Задайте `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`
и `MINIO_ROOT_PASSWORD`; пример содержит значения для локальной разработки.
Полный вывод конфигурации Compose содержит эти значения, поэтому не публикуйте его.

`APP_PORT`, `POSTGRES_PORT`, `MINIO_PORT` и `MINIO_CONSOLE_PORT` задают порты,
доступные с компьютера. Контейнеры обращаются к `postgres:5432`
и `http://minio:9000`; программы на компьютере — к `localhost`
с соответствующим опубликованным портом.

`DATABASE_URL` используется API и Alembic; `S3_*` пока зарезервированы.
Учётные данные должны совпадать с настройками PostgreSQL и MinIO; специальные
символы в URL базы нужно кодировать. Изменение `POSTGRES_*` не меняет учётные
данные в существующем томе базы. Для этого измените роль через SQL либо явно
сбросьте ненужные локальные данные.

## MinIO и будущая интеграция с Cloudflare R2

Откройте http://localhost:9001 и войдите с `MINIO_ROOT_USER`
и `MINIO_ROOT_PASSWORD` из `.env`. На этом этапе бакет автоматически не создаётся.
Настройка бакета `S3_BUCKET` (по умолчанию `cliphunter`) появится вместе с адаптером
хранилища и загрузкой файлов.

Для будущей интеграции с R2 потребуется указать S3-адрес аккаунта
в `S3_ENDPOINT_URL`, установить `S3_REGION=auto` и передать учётные данные
с доступом к нужному бакету через `S3_ACCESS_KEY` и `S3_SECRET_KEY`.
Текущее приложение ещё не подключается к R2. Адаптеры хранилища и подписанные
ссылки для скачивания появятся в следующих PR. Не добавляйте ключи в репозиторий.
Данный Compose предназначен для локальной разработки.

## Постоянные тома

`postgres_data` и `minio_data` сохраняют базу и объекты при пересоздании
контейнеров. Обычный `down` оставляет их на месте. Перед изменениями сохраняйте
резервную копию важных данных. Команда ниже намеренно удаляет **все локальные
данные базы и объектного хранилища**:

```sh
docker compose --env-file .env -f infra/docker-compose.yml down --volumes
```

Выполняйте её только тогда, когда действительно хотите удалить эти данные.
