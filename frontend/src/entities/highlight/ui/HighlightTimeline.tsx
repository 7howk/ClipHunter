import type { HighlightDto } from '@/shared/api';
import { formatTimecode } from '@/shared/lib';

import styles from './HighlightTimeline.module.css';

interface HighlightTimelineProps {
  duration: number;
  highlights: readonly HighlightDto[];
  activeId?: string | null;
  /** Текущая позиция плеера, секунды. */
  currentTime?: number;
  onSelect?: (highlight: HighlightDto) => void;
}

const TICKS = 4;

/** Таймлайн всей записи: где именно в ней лежат найденные моменты. */
export function HighlightTimeline({
  duration,
  highlights,
  activeId,
  currentTime,
  onSelect,
}: HighlightTimelineProps) {
  const safeDuration = Math.max(duration, 1);
  const percent = (seconds: number) => `${Math.min(100, (seconds / safeDuration) * 100)}%`;

  return (
    <div className={styles.timeline}>
      <div className={styles.track}>
        {highlights.map((highlight, index) => (
          <button
            key={highlight.id}
            type="button"
            className={styles.segment}
            data-active={highlight.id === activeId}
            style={{
              left: percent(highlight.start_time),
              width: percent(highlight.end_time - highlight.start_time),
            }}
            onClick={() => onSelect?.(highlight)}
            aria-label={`Момент ${index + 1}: ${highlight.title}, ${formatTimecode(highlight.start_time)}`}
            aria-pressed={highlight.id === activeId}
            disabled={!onSelect}
          />
        ))}
        {currentTime !== undefined && (
          <span
            className={styles.playhead}
            style={{ left: percent(currentTime) }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {Array.from({ length: TICKS + 1 }, (_, index) => (
          <span key={index}>{formatTimecode((safeDuration / TICKS) * index)}</span>
        ))}
      </div>
    </div>
  );
}
