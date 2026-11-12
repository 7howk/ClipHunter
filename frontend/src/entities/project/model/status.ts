import type { ProcessingStage, ProjectStatus } from '@/shared/api';

export interface PipelineStep {
  id: 'upload' | 'audio' | 'speech' | 'analysis' | 'done';
  label: string;
  hint: string;
}

/** Этапы pipeline в том виде, в каком их видит пользователь. */
export const PIPELINE_STEPS: readonly PipelineStep[] = [
  { id: 'upload', label: 'Видео загружено', hint: 'Файл сохранён в хранилище' },
  { id: 'audio', label: 'Достаём звук', hint: 'FFmpeg извлекает аудиодорожку' },
  { id: 'speech', label: 'Расшифровываем речь', hint: 'Whisper размечает текст таймкодами' },
  { id: 'analysis', label: 'Ищем лучшие моменты', hint: 'Модель оценивает каждый фрагмент' },
  { id: 'done', label: 'Готово', hint: 'Список моментов ниже' },
];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  created: 'Ждёт видео',
  uploaded: 'Видео загружено',
  processing: 'Обрабатывается',
  completed: 'Моменты найдены',
  no_highlights: 'Моментов нет',
  failed: 'Ошибка обработки',
};

const STEP_BY_STAGE: Record<ProcessingStage, number> = {
  extracting_audio: 1,
  transcribing: 2,
  analyzing: 3,
};

/**
 * Индекс текущего этапа; -1 — обработка упала. Если backend не сообщает
 * подэтап обработки, считаем текущим первый шаг после загрузки.
 */
export function getPipelineStepIndex(status: ProjectStatus, stage?: ProcessingStage): number {
  switch (status) {
    case 'created':
    case 'uploaded':
      return 0;
    case 'processing':
      return stage ? STEP_BY_STAGE[stage] : 1;
    case 'completed':
    case 'no_highlights':
      return 4;
    case 'failed':
      return -1;
  }
}

export function isFinalStatus(status: ProjectStatus): boolean {
  return status === 'completed' || status === 'no_highlights' || status === 'failed';
}
