import { API_MODE } from '../../config/env';

import { Notice } from './Notice';

/** Явная пометка демо-режима: данные в нём ненастоящие. */
export function DemoApiNotice() {
  if (API_MODE !== 'mock') return null;

  return (
    <Notice title="Демо-режим: backend не подключён">
      Весь API имитируется в браузере, файл никуда не отправляется. Оценки и описания моментов —
      примерные. Чтобы работать с backend, запустите его и уберите VITE_API_MODE=mock.
    </Notice>
  );
}
