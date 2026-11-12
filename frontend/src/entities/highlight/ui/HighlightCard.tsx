import type { ReactNode } from 'react';

import type { HighlightDto } from '@/shared/api';
import { formatSpan, formatTimecode } from '@/shared/lib';
import { CaptureFrame } from '@/shared/ui';

import { getCategoryLabel } from '../lib/category';

import styles from './HighlightCard.module.css';

interface HighlightCardProps {
  highlight: HighlightDto;
  rank: number;
  active?: boolean;
  /** Слот для действий фич: просмотр, выбор для нарезки. */
  actions?: ReactNode;
  onActivate?: () => void;
}

export function HighlightCard({
  highlight,
  rank,
  active = false,
  actions,
  onActivate,
}: HighlightCardProps) {
  const span = highlight.end_time - highlight.start_time;

  return (
    <CaptureFrame active={active}>
      <article
        className={styles.card}
        data-active={active}
        onMouseEnter={onActivate}
        aria-label={`Момент ${rank}: ${highlight.title}`}
      >
        <div className={styles.score} aria-label={`Оценка ${highlight.score} из 100`}>
          <span className={styles.scoreValue}>{highlight.score}</span>
          <span className={styles.rank}>#{rank}</span>
        </div>

        <div className={styles.body}>
          <h3 className={styles.title}>{highlight.title}</h3>
          <p className={styles.meta}>
            <span className={styles.time}>
              {formatTimecode(highlight.start_time)}–{formatTimecode(highlight.end_time)}
            </span>
            <span>{formatSpan(span)}</span>
            <span>{getCategoryLabel(highlight.category)}</span>
          </p>
          <p className={styles.description}>{highlight.description}</p>
          <p className={styles.reason}>{highlight.reason}</p>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </article>
    </CaptureFrame>
  );
}
