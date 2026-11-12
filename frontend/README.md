# ClipHunter Frontend

Клиентская часть ClipHunter: лендинг с маскотом Бобби, страница загрузки видео
и страница проекта с найденными моментами, плеером и нарезкой клипов.

Правила разработки и рабочий цикл AI-агента описаны в [AGENTS.md](AGENTS.md),
само определение агента — в [`.claude/agents/frontend-developer.md`](../.claude/agents/frontend-developer.md).

## Стек

| Задача              | Технология                                                                      |
| ------------------- | ------------------------------------------------------------------------------- |
| UI                  | React 19, TypeScript (strict)                                                   |
| Сборка и dev-сервер | Vite                                                                            |
| Состояние           | Redux Toolkit, RTK Query для REST API                                           |
| Маршрутизация       | React Router (data router, ленивые страницы)                                    |
| Стили               | CSS Modules и дизайн-токены (`src/app/styles/tokens.css`)                       |
| Иконки              | lucide-react                                                                    |
| Шрифты              | Press Start 2P (заголовки), IBM Plex Mono (текст), self-hosted через Fontsource |
| Графика             | WebGL-шейдер сканлайнов для маскота, без сторонних библиотек                    |
| Качество            | ESLint, Prettier, Steiger (линтер FSD), Vitest и Testing Library                |
| Раздача в Docker    | nginx: статические файлы и прокси `/api`                                        |

## Архитектура: Feature-Sliced Design

```text
src/
├── app/        # точка входа, store, роутер, layout, глобальные стили и токены
├── pages/      # landing, upload, project, not-found; блоки, которые нужны одной странице
├── widgets/    # site-header, site-footer — общие для нескольких страниц
├── features/   # upload-video, select-highlights, generate-clips — действия пользователя
├── entities/   # project, highlight, clip, system — домен API: endpoints, модели, UI
└── shared/     # api (baseApi, контракты, имитация), config, lib (форматы, WebGL), ui-kit
```

Слой импортирует только нижележащие слои и только через `index.ts` слайса.
Это проверяют ESLint и Steiger. Подробные правила — в [AGENTS.md](AGENTS.md).

## Маршруты

| Путь                   | Страница                                                                   |
| ---------------------- | -------------------------------------------------------------------------- |
| `/`                    | Лендинг: что делает ClipHunter, пример результата, принципы                |
| `/upload`              | Загрузка видео: проверка формата, размера и длительности, недавние проекты |
| `/projects/:projectId` | Прогресс обработки, найденные моменты, выбор и нарезка клипов              |

## Связь с backend

Типы ответов описаны в `src/shared/api/contracts.ts` и повторяют схемы
backend (`backend/src/cliphunter/application/dto.py`).

| Действие в интерфейсе | Запрос                                                                          | Где выполняется |
| --------------------- | ------------------------------------------------------------------------------- | --------------- |
| Индикатор в футере    | `GET /health`                                                                   | backend         |
| Создание проекта      | `POST /projects`                                                                | backend         |
| Недавние проекты      | `GET /projects`                                                                 | backend         |
| Загрузка файла        | `POST /projects/{id}/upload?filename=…`, тело — сам файл                        | backend         |
| Проект и прогресс     | `GET /projects/{id}`, `GET /projects/{id}/status`                               | backend         |
| Запуск обработки      | `POST /projects/{id}/process`                                                   | имитация        |
| Список моментов       | `GET /projects/{id}/highlights`                                                 | имитация        |
| Нарезка               | `POST /highlights/{id}/generate`, `GET /clips/{id}`, `GET /clips/{id}/download` | имитация        |

Загрузка идёт потоком (не `multipart`): имя файла — в query `filename`,
`Content-Type` соответствует расширению (`mp4`, `m4v`, `mov`, `mkv`, `webm`).
Клиент заранее проверяет формат, размер (500 МБ) и длительность (30 минут);
те же проверки повторяет backend.

### Режимы API

| `VITE_API_MODE`         | Поведение                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `hybrid` (по умолчанию) | Всё, что backend уже реализует, идёт в настоящий API. Обработку, моменты и нарезку прогоняет имитация в браузере на настоящих данных проекта |
| `real`                  | Только настоящий backend. Запуск обработки покажет, что этап ещё не реализован                                                               |
| `mock`                  | Весь API в браузере, backend не нужен — для показа без Docker                                                                                |

Имитация повторяет маршруты и форматы контракта: обработка занимает около
10 секунд, записи короче 30 секунд дают честный пустой результат, а «клип» —
это исходный файл с media fragment на нужный интервал. Везде, где она работает,
интерфейс показывает пометку. Когда backend реализует этап, его маршрут
убирают из `isSimulatedPipelineRoute` (рецепт — в AGENTS.md, раздел 6).

## Запуск

### Весь стек в Docker

Из корня репозитория:

```sh
cp .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml up --build --wait
```

Интерфейс — http://localhost:8080, API — http://localhost:8000/docs.

### Разработка

Нужен Node.js 22 или новее. Backend поднимается через Docker, как выше,
или любым способом из `backend/README.md`.

```sh
cd frontend
npm install
cp .env.example .env.local   # при необходимости
npm run dev                  # http://localhost:5173
```

Dev-сервер проксирует `/api` на `VITE_API_PROXY_TARGET` (по умолчанию
`http://localhost:8000`). Без backend можно работать в режиме
`VITE_API_MODE=mock npm run dev`.

## Переменные окружения

| Переменная                        | По умолчанию            | Назначение                                                   |
| --------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `VITE_API_MODE`                   | `hybrid`                | `hybrid`, `real` или `mock`, см. выше                        |
| `VITE_API_URL`                    | пусто                   | Базовый URL API; пусто — тот же origin                       |
| `VITE_API_PROXY_TARGET`           | `http://localhost:8000` | Куда dev-сервер проксирует `/api`                            |
| `VITE_MAX_UPLOAD_SIZE_MB`         | `500`                   | Лимит размера, совпадает с `MAX_UPLOAD_SIZE_MB` backend      |
| `VITE_MAX_VIDEO_DURATION_SECONDS` | `1800`                  | Лимит длительности, совпадает с `MAX_VIDEO_DURATION_SECONDS` |

Переменные `VITE_*` встраиваются при сборке. В Docker их передаёт сервис `web`
из корневого `.env`.

## Скрипты

| Команда                | Что делает                                   |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Dev-сервер                                   |
| `npm run build`        | Проверка типов и production-сборка в `dist/` |
| `npm run preview`      | Локальный просмотр сборки                    |
| `npm run typecheck`    | Проверка типов                               |
| `npm run lint`         | ESLint                                       |
| `npm run lint:fsd`     | Steiger: проверка правил FSD                 |
| `npm run format:check` | Prettier                                     |
| `npm test`             | Vitest                                       |

## Маскот

Бобби — кинокамера на ножках: бобины вместо ушей, объектив вместо носа, хвост из
плёнки. Сцена рисуется процедурно на 2D-canvas (`src/shared/ui/mascot/bobbyScene.ts`),
а WebGL-шейдер (`src/shared/lib/scanline`) перерисовывает её горизонтальными
сканлайнами 12 раз в секунду. Корпус неподвижен, чтобы линии не «прыгали»
между строками; двигаются бобины, хвост и лапки. Вне экрана анимация стоит на
паузе, при `prefers-reduced-motion` показывается один статичный кадр, без
WebGL — обычный canvas.
