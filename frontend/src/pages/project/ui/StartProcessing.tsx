import { Play, RotateCcw } from 'lucide-react';

import { useStartProcessingMutation } from '@/entities/project';
import { getErrorMessage } from '@/shared/api';
import { Button, Notice } from '@/shared/ui';

import styles from './StartProcessing.module.css';

interface StartProcessingProps {
  projectId: string;
  /** Прошлая попытка упала: backend разрешает запустить обработку заново. */
  failure?: string;
}

/** Запуск обработки: после загрузки (если он не прошёл сразу) или после ошибки. */
export function StartProcessing({ projectId, failure }: StartProcessingProps) {
  const [startProcessing, { isLoading, error }] = useStartProcessingMutation();
  const failed = failure !== undefined;

  return (
    <section className={styles.panel} aria-labelledby="start-title">
      <div className={styles.body}>
        <h2 id="start-title" className={styles.title}>
          {failed ? 'Обработка остановилась' : 'Видео загружено и ждёт обработки'}
        </h2>
        <p className={styles.text} role={failed ? 'alert' : undefined}>
          {failed ? failure : 'Запустите обработку, и Бобби найдёт в записи лучшие моменты.'}
        </p>
      </div>
      <Button
        icon={failed ? <RotateCcw /> : <Play />}
        onClick={() => void startProcessing(projectId)}
        loading={isLoading}
      >
        {failed ? 'Запустить снова' : 'Запустить обработку'}
      </Button>
      {error && (
        <div className={styles.error}>
          <Notice tone="error" title="Обработка не запустилась">
            {getErrorMessage(error)}
          </Notice>
        </div>
      )}
    </section>
  );
}
