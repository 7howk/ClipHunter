const env = import.meta.env;

/** Базовый URL backend. Пусто — тот же origin (в dev и в Docker запросы /api проксируются). */
export const API_URL = (env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Как интерфейс общается с API:
 * - `hybrid` (по умолчанию) — всё, что backend уже умеет, идёт в настоящий REST API,
 *   а этапы, которых в backend ещё нет (обработка, хайлайты, клипы), имитируются в браузере;
 * - `mock` — весь API имитируется в браузере, backend не нужен (демонстрация без Docker);
 * - `real` — только настоящий backend, без имитации.
 */
export type ApiMode = 'hybrid' | 'mock' | 'real';

function readApiMode(value: string | undefined): ApiMode {
  return value === 'mock' || value === 'real' ? value : 'hybrid';
}

export const API_MODE: ApiMode = readApiMode(env.VITE_API_MODE);

/** Совпадает с MAX_UPLOAD_SIZE_MB backend (.env.example в корне репозитория). */
export const MAX_UPLOAD_SIZE_MB = Number(env.VITE_MAX_UPLOAD_SIZE_MB ?? 500);

/** Совпадает с MAX_VIDEO_DURATION_SECONDS backend. */
export const MAX_VIDEO_DURATION_SECONDS = Number(env.VITE_MAX_VIDEO_DURATION_SECONDS ?? 1800);

/** Расширения и MIME-типы — как VIDEO_TYPES в backend/src/cliphunter/application/upload.py. */
export const VIDEO_CONTENT_TYPES = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
} as const;

export type VideoExtension = keyof typeof VIDEO_CONTENT_TYPES;

export const ALLOWED_VIDEO_EXTENSIONS = Object.keys(VIDEO_CONTENT_TYPES) as VideoExtension[];

/** video/mp4 подходит и для .m4v — backend принимает оба варианта. */
export const ALLOWED_VIDEO_MIME_TYPES: readonly string[] = Object.values(VIDEO_CONTENT_TYPES);

export function getVideoExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

/** Content-Type для загрузки: backend сверяет его с расширением файла. */
export function getVideoContentType(fileName: string): string {
  const extension = getVideoExtension(fileName);
  return VIDEO_CONTENT_TYPES[extension as VideoExtension] ?? 'application/octet-stream';
}

export const REPOSITORY_URL = 'https://github.com/7howk/ClipHunter';
