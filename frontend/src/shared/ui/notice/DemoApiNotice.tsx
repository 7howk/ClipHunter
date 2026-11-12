import { API_MODE } from '../../config/env';

import { Notice } from './Notice';

/** Явная пометка, какие части работают на настоящем backend, а какие имитируются. */
export function DemoApiNotice() {
  if (API_MODE === 'real') return null;

  if (API_MODE === 'mock') {
    return (
      <Notice title="Демо-режим: backend не подключён">
        Весь API имитируется в браузере, файл никуда не отправляется. Оценки и описания моментов —
        примерные. Чтобы работать с backend, запустите его и уберите VITE_API_MODE=mock.
      </Notice>
    );
  }

  return (
    <Notice title="Часть этапов пока имитируется">
      Проекты и загрузка видео работают через backend: PostgreSQL и хранилище MinIO. Поиск моментов
      и нарезку backend ещё не реализовал, поэтому их прогоняет имитация в браузере по
      API-контракту. Оценки и описания моментов — примерные.
    </Notice>
  );
}
