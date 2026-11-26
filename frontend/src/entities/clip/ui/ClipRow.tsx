import { Download, RotateCcw } from 'lucide-react';

import { getErrorMessage, type ClipStatus } from '@/shared/api';
import { Button } from '@/shared/ui';

import { clipApi, useGetClipQuery, useLazyGetClipDownloadQuery } from '../api/clipApi';

import styles from './ClipRow.module.css';

const STATUS_LABELS: Record<ClipStatus, string> = {
  pending: 'В очереди',
  processing: 'Режем',
  completed: 'Готов',
  failed: 'Не получилось',
};

const POLL_MS = 2000;

interface ClipRowProps {
  clipId: string;
  title: string;
  fileName: string;
  /** Нарезать заново: клип не получился или его больше нет на сервере. */
  onRetry: () => void;
}

/** Строка клипа: опрашивает статус, пока клип не будет готов, и отдаёт файл. */
export function ClipRow({ clipId, title, fileName, onRetry }: ClipRowProps) {
  // Читаем кеш до подписки, чтобы выключить опрос, как только ждать больше нечего
  const cached = clipApi.endpoints.getClip.useQueryState(clipId);
  const settled =
    cached.data?.status === 'completed' ||
    cached.data?.status === 'failed' ||
    isMissing(cached.error);
  const { data: clip, error } = useGetClipQuery(clipId, {
    pollingInterval: settled ? 0 : POLL_MS,
    skipPollingIfUnfocused: true,
  });
  const [requestDownload, download] = useLazyGetClipDownloadQuery();

  const missing = isMissing(error);
  const status = missing ? 'failed' : (clip?.status ?? 'pending');
  const label = missing
    ? 'Клипа нет на сервере'
    : error
      ? 'Нет связи с сервером'
      : STATUS_LABELS[status];
  const problem = download.error && getErrorMessage(download.error);

  // Ссылка живёт ограниченное время, поэтому берём свежую на каждое нажатие
  const onDownload = async () => {
    const result = await requestDownload(clipId);
    if (!result.data) return;
    const link = document.createElement('a');
    link.href = result.data.url;
    link.download = fileName;
    link.click();
  };

  return (
    <li className={styles.row} data-status={status}>
      <span className={styles.indicator} aria-hidden="true" />
      <span className={styles.title}>{title}</span>
      <span className={styles.status} aria-live="polite">
        {label}
      </span>
      {status === 'completed' && (
        <Button
          variant="text"
          size="sm"
          icon={<Download />}
          onClick={() => void onDownload()}
          loading={download.isFetching}
          aria-label={`Скачать клип «${title}»`}
        >
          Скачать
        </Button>
      )}
      {status === 'failed' && (
        <Button
          variant="text"
          size="sm"
          icon={<RotateCcw />}
          onClick={onRetry}
          aria-label={`Нарезать заново «${title}»`}
        >
          Повторить
        </Button>
      )}
      {problem && (
        <span className={styles.problem} role="alert">
          {problem}
        </span>
      )}
    </li>
  );
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}
