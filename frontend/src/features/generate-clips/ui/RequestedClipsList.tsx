import { useSelector } from 'react-redux';

import { ClipRow } from '@/entities/clip';
import type { HighlightDto } from '@/shared/api';

import { selectRequestedClips, type GeneratedClipsRootState } from '../model/generatedClipsSlice';

import styles from './RequestedClipsList.module.css';

interface RequestedClipsListProps {
  projectId: string;
  highlights: readonly HighlightDto[];
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

export function RequestedClipsList({ projectId, highlights }: RequestedClipsListProps) {
  const clips = useSelector((state: GeneratedClipsRootState) =>
    selectRequestedClips(state, projectId),
  );
  if (clips.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="clips-title">
      <h2 id="clips-title" className={styles.title}>
        Клипы
      </h2>
      <ul className={styles.list}>
        {clips.map(({ clipId, highlightId }) => {
          const highlight = highlights.find((item) => item.id === highlightId);
          const title = highlight?.title ?? 'Клип';
          return (
            <ClipRow key={clipId} clipId={clipId} title={title} fileName={`${slug(title)}.mp4`} />
          );
        })}
      </ul>
    </section>
  );
}
