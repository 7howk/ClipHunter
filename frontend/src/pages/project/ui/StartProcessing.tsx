import { Play } from 'lucide-react';

import { useStartProcessingMutation } from '@/entities/project';
import { getErrorMessage } from '@/shared/api';
import { Button, Notice } from '@/shared/ui';

import styles from './StartProcessing.module.css';

/**
 * Видео загружено, но обработка не идёт: например, после перезагрузки страницы
 * или если backend ещё не реализует запуск обработки.
 */
export function StartProcessing({ projectId }: { projectId: string }) {
  const [startProcessing, { isLoading, error }] = useStartProcessingMutation();
  const notImplemented =
    error && 'status' in error && (error.status === 404 || error.status === 405);

  return (
    <section className={styles.panel} aria-labelledby="start-title">
      <div className={styles.body}>
        <h2 id="start-title" className={styles.title}>
          Видео загружено и ждёт обработки
        </h2>
        <p className={styles.text}>Запустите обработку, и Бобби найдёт в записи лучшие моменты.</p>
      </div>
      <Button icon={<Play />} onClick={() => void startProcessing(projectId)} loading={isLoading}>
        Запустить обработку
      </Button>
      {error && (
        <div className={styles.error}>
          <Notice tone="error" title="Обработка не запустилась">
            {notImplemented
              ? 'Backend пока не умеет обрабатывать видео: этот этап ещё в разработке. В режиме hybrid обработку прогоняет имитация'
              : getErrorMessage(error)}
          </Notice>
        </div>
      )}
    </section>
  );
}
