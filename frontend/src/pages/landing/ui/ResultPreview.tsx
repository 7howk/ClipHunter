import { FileVideo } from 'lucide-react';
import { useState } from 'react';

import { HighlightCard, HighlightTimeline } from '@/entities/highlight';
import { landingAnchors, routes } from '@/shared/config';
import { formatTimecode, plural } from '@/shared/lib';
import { ButtonLink, PixelHeading } from '@/shared/ui';

import { SAMPLE_FILE, SAMPLE_HIGHLIGHTS } from '../model/sample';

import styles from './ResultPreview.module.css';

const VISIBLE = 3;

export function ResultPreview() {
  const [activeId, setActiveId] = useState<string>(SAMPLE_HIGHLIGHTS[0]?.id ?? '');
  const hidden = SAMPLE_HIGHLIGHTS.length - VISIBLE;

  return (
    <section id={landingAnchors.result} className={styles.section} aria-labelledby="result-title">
      <div className={styles.copy}>
        <PixelHeading id="result-title" size="lg">
          Что ты получишь
        </PixelHeading>
        <p className={styles.lead}>
          Список моментов с таймкодами, оценкой от 0 до 100 и объяснением, почему фрагмент
          интересен. Лучшие наверху, а на таймлайне видно, где они лежат в записи.
        </p>
        <p className={styles.note}>Справа пример ответа для трёхчасового стрима.</p>
        <ButtonLink to={routes.upload} variant="secondary">
          Попробовать на своей записи
        </ButtonLink>
      </div>

      <figure className={styles.panel} aria-label="Пример результата ClipHunter">
        <figcaption className={styles.file}>
          <FileVideo aria-hidden="true" />
          <span className={styles.fileName}>{SAMPLE_FILE.name}</span>
          <span className={styles.fileMeta}>{formatTimecode(SAMPLE_FILE.duration)}</span>
        </figcaption>

        <HighlightTimeline
          duration={SAMPLE_FILE.duration}
          highlights={SAMPLE_HIGHLIGHTS}
          activeId={activeId}
          onSelect={(highlight) => setActiveId(highlight.id)}
        />

        <div className={styles.list}>
          {SAMPLE_HIGHLIGHTS.slice(0, VISIBLE).map((highlight, index) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              rank={index + 1}
              active={highlight.id === activeId}
              onActivate={() => setActiveId(highlight.id)}
            />
          ))}
        </div>

        <p className={styles.more}>
          И ещё {hidden} {plural(hidden, ['момент', 'момента', 'моментов'])} выше порога 60
        </p>
      </figure>
    </section>
  );
}
