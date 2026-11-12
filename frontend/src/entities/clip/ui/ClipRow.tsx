import { Download } from 'lucide-react';
import type { ClipStatus } from '@/shared/api';

import { clipApi, useGetClipDownloadQuery, useGetClipQuery } from '../api/clipApi';

import styles from './ClipRow.module.css';

const STATUS_LABELS: Record<ClipStatus, string> = {
  pending: 'В очереди',
  processing: 'Режем',
  completed: 'Готов',
  failed: 'Не получилось',
};

interface ClipRowProps {
  clipId: string;
  title: string;
  fileName: string;
}

/** Строка готовящегося клипа: опрашивает статус, пока клип не будет готов. */
export function ClipRow({ clipId, title, fileName }: ClipRowProps) {
  // Читаем кеш до подписки, чтобы выключить опрос, как только клип готов или упал
  const cached = clipApi.endpoints.getClip.useQueryState(clipId).data;
  const settled = cached?.status === 'completed' || cached?.status === 'failed';
  const { data: clip } = useGetClipQuery(clipId, {
    pollingInterval: settled ? 0 : 1200,
    skipPollingIfUnfocused: true,
  });
  const ready = clip?.status === 'completed';
  const { data: download, isFetching } = useGetClipDownloadQuery(clipId, { skip: !ready });
  const status = clip?.status ?? 'pending';

  return (
    <li className={styles.row} data-status={status}>
      <span className={styles.indicator} aria-hidden="true" />
      <span className={styles.title}>{title}</span>
      <span className={styles.status} aria-live="polite">
        {STATUS_LABELS[status]}
      </span>
      {download && (
        <a className={styles.download} href={download.url} download={fileName}>
          <Download aria-hidden="true" />
          Скачать
        </a>
      )}
      {ready && !download && isFetching && <span className={styles.status}>Готовим ссылку</span>}
    </li>
  );
}
