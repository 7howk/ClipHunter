import {
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_UPLOAD_SIZE_MB,
  MAX_VIDEO_DURATION_SECONDS,
  getVideoExtension,
} from '@/shared/config';
import { formatBytes, formatTimecode } from '@/shared/lib';

export interface ValidationLimits {
  maxSizeMb: number;
}

/** Проверка на клиенте повторяет правила backend: расширение, MIME-тип и размер. */
export function validateVideoFile(
  file: File,
  { maxSizeMb }: ValidationLimits = { maxSizeMb: MAX_UPLOAD_SIZE_MB },
): string | null {
  const extension = getVideoExtension(file.name);
  const allowedList = ALLOWED_VIDEO_EXTENSIONS.join(', ');

  if (!(ALLOWED_VIDEO_EXTENSIONS as readonly string[]).includes(extension)) {
    return `Формат .${extension || '?'} не поддерживается. Подойдут ${allowedList}`;
  }
  // Некоторые браузеры не знают MIME для mkv и отдают пустую строку — тогда решает расширение
  if (file.type && !(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `Файл не похож на видео (${file.type}). Подойдут ${allowedList}`;
  }
  if (file.size === 0) {
    return 'Файл пустой. Выберите другую запись';
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `Файл весит ${formatBytes(file.size)}, а лимит — ${maxSizeMb} МБ. Обрежьте запись или сожмите её`;
  }
  return null;
}

/** Длительность проверяется по метаданным в браузере, тот же лимит проверит и backend. */
export function validateVideoDuration(
  seconds: number,
  maxSeconds: number = MAX_VIDEO_DURATION_SECONDS,
): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds > maxSeconds) {
    return `Запись длится ${formatTimecode(seconds)}, а лимит — ${formatTimecode(maxSeconds)}. Обрежьте её и загрузите снова`;
  }
  return null;
}

/** Название проекта по умолчанию — имя файла без расширения. */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 120);
}
