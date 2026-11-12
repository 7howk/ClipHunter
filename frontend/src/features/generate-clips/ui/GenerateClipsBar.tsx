import { Scissors } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useGenerateClipMutation } from '@/entities/clip';
import { getErrorMessage } from '@/shared/api';
import { plural } from '@/shared/lib';
import { Button, Notice } from '@/shared/ui';

import {
  clipRequested,
  selectRequestedClips,
  type GeneratedClipsRootState,
} from '../model/generatedClipsSlice';

import styles from './GenerateClipsBar.module.css';

interface GenerateClipsBarProps {
  projectId: string;
  selectedIds: readonly string[];
  total: number;
}

/** Панель «нарезать выбранное»: создаёт клип для каждого ещё не нарезанного момента. */
export function GenerateClipsBar({ projectId, selectedIds, total }: GenerateClipsBarProps) {
  const dispatch = useDispatch();
  const [generateClip] = useGenerateClipMutation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useSelector((state: GeneratedClipsRootState) =>
    selectRequestedClips(state, projectId),
  );

  const queue = selectedIds.filter((id) => !requested.some((clip) => clip.highlightId === id));

  const onGenerate = async () => {
    setPending(true);
    setError(null);
    try {
      for (const highlightId of queue) {
        const clip = await generateClip(highlightId).unwrap();
        dispatch(clipRequested({ projectId, clipId: clip.id, highlightId }));
      }
    } catch (caught) {
      setError(getErrorMessage(caught as Parameters<typeof getErrorMessage>[0]));
    } finally {
      setPending(false);
    }
  };

  const selectedLabel = !selectedIds.length
    ? 'Отметьте моменты, которые нужно нарезать'
    : queue.length === 0
      ? 'Всё выбранное уже нарезано, ссылки ниже'
      : `Выбрано ${selectedIds.length} из ${total}`;

  return (
    <div className={styles.bar}>
      <p className={styles.count} aria-live="polite">
        {selectedLabel}
      </p>
      <Button
        icon={<Scissors />}
        onClick={onGenerate}
        disabled={queue.length === 0}
        loading={pending}
      >
        {queue.length
          ? `Нарезать ${queue.length} ${plural(queue.length, ['клип', 'клипа', 'клипов'])}`
          : 'Нарезать клипы'}
      </Button>
      {error && (
        <div className={styles.error}>
          <Notice tone="error" title="Не удалось запустить нарезку">
            {error}
          </Notice>
        </div>
      )}
    </div>
  );
}
