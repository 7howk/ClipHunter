import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { ClipRow, useGenerateClipMutation } from '@/entities/clip';
import { getErrorMessage, type HighlightDto } from '@/shared/api';
import { Notice } from '@/shared/ui';

import {
  clipRequested,
  selectRequestedClips,
  type GeneratedClipsRootState,
} from '../model/generatedClipsSlice';

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
  const dispatch = useDispatch();
  const [generateClip] = useGenerateClipMutation();
  const [error, setError] = useState<string | null>(null);
  const clips = useSelector((state: GeneratedClipsRootState) =>
    selectRequestedClips(state, projectId),
  );
  // Запомненный клип мог остаться от прежней обработки: таких моментов уже нет
  const rows = clips.flatMap(({ clipId, highlightId }) => {
    const highlight = highlights.find((item) => item.id === highlightId);
    return highlight ? [{ clipId, highlight }] : [];
  });
  if (rows.length === 0) return null;

  const retry = async (highlightId: string) => {
    setError(null);
    try {
      const clip = await generateClip(highlightId).unwrap();
      dispatch(clipRequested({ projectId, clipId: clip.id, highlightId }));
    } catch (caught) {
      setError(getErrorMessage(caught as Parameters<typeof getErrorMessage>[0]));
    }
  };

  return (
    <section className={styles.section} aria-labelledby="clips-title">
      <h2 id="clips-title" className={styles.title}>
        Клипы
      </h2>
      <ul className={styles.list}>
        {rows.map(({ clipId, highlight }) => (
          <ClipRow
            key={clipId}
            clipId={clipId}
            title={highlight.title}
            fileName={`${slug(highlight.title)}.mp4`}
            onRetry={() => void retry(highlight.id)}
          />
        ))}
      </ul>
      {error && (
        <Notice tone="error" title="Не удалось запустить нарезку">
          {error}
        </Notice>
      )}
    </section>
  );
}
