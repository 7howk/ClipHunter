import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';

import {
  previewAttached,
  useCreateProjectMutation,
  useStartProcessingMutation,
  useUploadVideoMutation,
} from '@/entities/project';
import { getErrorMessage } from '@/shared/api';

export type UploadStage = 'idle' | 'creating' | 'uploading' | 'starting' | 'error';

export const UPLOAD_STAGE_LABELS: Record<Exclude<UploadStage, 'idle' | 'error'>, string> = {
  creating: 'Создаём проект',
  uploading: 'Загружаем файл',
  starting: 'Запускаем обработку',
};

/**
 * Сценарий загрузки: создать проект → загрузить файл → запустить обработку.
 * Возвращает id проекта, чтобы страница могла перейти к его результатам.
 */
export function useUploadVideo() {
  const dispatch = useDispatch();
  const [createProject] = useCreateProjectMutation();
  const [uploadVideo] = useUploadVideoMutation();
  const [startProcessing] = useStartProcessingMutation();
  const [stage, setStage] = useState<UploadStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async ({ file, title }: { file: File; title: string }): Promise<string | null> => {
      setError(null);
      try {
        setStage('creating');
        const project = await createProject({ title }).unwrap();

        setStage('uploading');
        await uploadVideo({ projectId: project.id, file }).unwrap();
        dispatch(previewAttached({ projectId: project.id, url: URL.createObjectURL(file) }));

        // Видео уже сохранено. Если запуск обработки не удался, страница проекта
        // покажет это и предложит повторить, поэтому переходим к проекту в любом случае
        setStage('starting');
        await startProcessing(project.id)
          .unwrap()
          .catch(() => undefined);

        setStage('idle');
        return project.id;
      } catch (caught) {
        setStage('error');
        setError(getErrorMessage(caught as Parameters<typeof getErrorMessage>[0]));
        return null;
      }
    },
    [createProject, uploadVideo, startProcessing, dispatch],
  );

  return { run, stage, error, busy: stage !== 'idle' && stage !== 'error' };
}
