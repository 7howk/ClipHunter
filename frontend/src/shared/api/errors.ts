import type { SerializedError } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

import type { ApiErrorBody } from './contracts';

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return typeof error === 'object' && error !== null && 'message' in error;
}

/** Человеческое сообщение из ошибки RTK Query: что случилось и что делать. */
export function getErrorMessage(error: FetchBaseQueryError | SerializedError | undefined): string {
  if (!error) return 'Неизвестная ошибка. Обновите страницу и попробуйте ещё раз';

  if ('status' in error) {
    if (error.status === 'FETCH_ERROR') {
      return 'Сервер ClipHunter недоступен. Проверьте, что backend запущен, и повторите';
    }
    if (error.status === 'PARSING_ERROR' || error.status === 'TIMEOUT_ERROR') {
      return 'Сервер ответил некорректно. Повторите попытку через минуту';
    }
    if (isApiErrorBody(error.data)) return error.data.error.message;
    if (error.status === 404) return 'Не нашли такой проект. Возможно, он был удалён';
    if (error.status === 413) return 'Файл больше допустимого размера';
    return `Сервер вернул ошибку ${String(error.status)}. Повторите попытку`;
  }

  return error.message ?? 'Неизвестная ошибка. Обновите страницу и попробуйте ещё раз';
}
