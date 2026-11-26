import type { GeneratedClipsState, RequestedClip } from './generatedClipsSlice';

export const CLIPS_STORAGE_KEY = 'cliphunter.generatedClips';

const isClip = (value: unknown): value is RequestedClip =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RequestedClip).clipId === 'string' &&
  typeof (value as RequestedClip).highlightId === 'string';

/** Запомненные клипы из localStorage. Недоступное или испорченное хранилище — пустой список. */
export function loadGeneratedClips(): GeneratedClipsState {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CLIPS_STORAGE_KEY) ?? '{}');
    if (typeof stored !== 'object' || stored === null) return { byProject: {} };
    const byProject = Object.fromEntries(
      Object.entries(stored)
        .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
        .map(([projectId, list]) => [projectId, list.filter(isClip)]),
    );
    return { byProject };
  } catch {
    return { byProject: {} };
  }
}

export function saveGeneratedClips({ byProject }: GeneratedClipsState): void {
  try {
    localStorage.setItem(CLIPS_STORAGE_KEY, JSON.stringify(byProject));
  } catch {
    // Приватный режим или переполнение: клипы просто не переживут перезагрузку
  }
}
