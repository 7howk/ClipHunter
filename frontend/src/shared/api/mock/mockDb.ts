import type {
  ClipDownloadDto,
  GeneratedClipDto,
  HighlightCategory,
  HighlightDto,
  ProcessingStage,
  ProjectStatusDto,
  VideoProjectDto,
} from '../contracts';

/**
 * In-memory имитация backend. Используется целиком в режиме `mock` и для
 * ещё не реализованных этапов (обработка, хайлайты, клипы) в режиме `hybrid`.
 * Живёт только в текущей вкладке: после перезагрузки данные исчезают.
 */

interface MockProject extends VideoProjectDto {
  objectUrl: string | null;
  processStartedAt: number | null;
}

interface MockClip extends GeneratedClipDto {
  requestedAt: number;
}

const MIN_SCORE = 60;
/** Короче этого видео имитация считает «пустым» — чтобы было видно честное пустое состояние. */
const MIN_DURATION_FOR_HIGHLIGHTS = 30;

const STAGES: { stage: ProcessingStage; untilMs: number }[] = [
  { stage: 'extracting_audio', untilMs: 3000 },
  { stage: 'transcribing', untilMs: 6800 },
  { stage: 'analyzing', untilMs: 10_400 },
];

const CLIP_READY_AFTER_MS = 2600;

const SAMPLES: {
  category: HighlightCategory;
  title: string;
  description: string;
  reason: string;
}[] = [
  {
    category: 'surprise',
    title: 'Неожиданный поворот',
    description: 'Игрок выигрывает раунд, когда команда уже сдалась',
    reason: 'Резкая смена тона речи и неожиданный исход',
  },
  {
    category: 'funny',
    title: 'Чат угадал раньше стримера',
    description: 'Стример читает подсказку из чата и хохочет над собой',
    reason: 'Смех, шутка и быстрая реакция в одном фрагменте',
  },
  {
    category: 'climax',
    title: 'Финальный раунд',
    description: 'Последние секунды матча с комментарием на пределе эмоций',
    reason: 'Кульминация сессии, фрагмент понятен без контекста',
  },
  {
    category: 'reaction',
    title: 'Реакция на донат',
    description: 'Стример замолкает, а потом благодарит зрителя',
    reason: 'Яркая эмоциональная реакция участника',
  },
  {
    category: 'tension',
    title: 'Один на один в последней зоне',
    description: 'Долгая пауза, шёпот и решающий выстрел',
    reason: 'Нарастающее напряжение и чёткая развязка',
  },
  {
    category: 'conflict',
    title: 'Спор с тиммейтом',
    description: 'Короткая перепалка о тактике прямо посреди боя',
    reason: 'Конфликт с понятной завязкой и итогом',
  },
  {
    category: 'emotional',
    title: 'Не верит своим глазам',
    description: 'Редкий дроп после трёх часов попыток',
    reason: 'Сильная эмоция, фрагмент самостоятелен',
  },
];

const projects = new Map<string, MockProject>();
const highlights = new Map<string, HighlightDto>();
const clips = new Map<string, MockClip>();

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

/** Детерминированный генератор, чтобы хайлайты одного видео не прыгали между запросами. */
function seeded(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function strip(project: MockProject): VideoProjectDto {
  const { objectUrl: _url, processStartedAt: _started, ...dto } = project;
  return dto;
}

function currentStage(project: MockProject): ProcessingStage | undefined {
  if (project.status !== 'processing' || project.processStartedAt === null) return undefined;
  const elapsed = Date.now() - project.processStartedAt;
  return STAGES.find((step) => elapsed < step.untilMs)?.stage;
}

function refreshStatus(project: MockProject) {
  if (project.status !== 'processing' || currentStage(project)) return;
  generateHighlights(project);
  const found = [...highlights.values()].some((item) => item.project_id === project.id);
  project.status = found ? 'completed' : 'no_highlights';
  project.updated_at = now();
}

function generateHighlights(project: MockProject) {
  const duration = project.duration ?? 0;
  if (duration < MIN_DURATION_FOR_HIGHLIGHTS) return;

  const random = seeded(Math.round(duration * 1000) + (project.file_size ?? 0));
  const count = Math.min(7, Math.max(2, Math.floor(duration / 240) + 2));
  const slot = duration / count;

  for (let index = 0; index < count; index++) {
    const sample = SAMPLES[
      Math.floor(random() * SAMPLES.length) % SAMPLES.length
    ] as (typeof SAMPLES)[number];
    const length = Math.min(slot * 0.8, 14 + random() * 32);
    const start = index * slot + random() * Math.max(0, slot - length);
    const item: HighlightDto = {
      id: id(),
      project_id: project.id,
      start_time: Math.round(start * 10) / 10,
      end_time: Math.round((start + length) * 10) / 10,
      score: Math.round(52 + random() * 44),
      ...sample,
    };
    // Как в backend: ниже порога HIGHLIGHT_MIN_SCORE момент в список не попадает
    if (item.score >= MIN_SCORE) highlights.set(item.id, item);
  }
}

function getOrNull(projectId: string): MockProject | undefined {
  const project = projects.get(projectId);
  if (project) refreshStatus(project);
  return project;
}

export const mockDb = {
  minScore: MIN_SCORE,

  createProject(title: string): VideoProjectDto {
    const project: MockProject = {
      id: id(),
      title,
      original_filename: null,
      file_size: null,
      duration: null,
      status: 'created',
      created_at: now(),
      updated_at: now(),
      objectUrl: null,
      processStartedAt: null,
    };
    projects.set(project.id, project);
    return strip(project);
  },

  /**
   * Режим hybrid: проект живёт в настоящем backend, а имитация берёт его
   * метаданные, чтобы прогнать ещё не реализованные этапы pipeline.
   */
  adoptProject(dto: VideoProjectDto, file?: Blob): void {
    const existing = projects.get(dto.id);
    projects.set(dto.id, {
      ...dto,
      objectUrl: existing?.objectUrl ?? (file ? URL.createObjectURL(file) : null),
      processStartedAt: existing?.processStartedAt ?? null,
      status: existing?.status ?? dto.status,
    });
  },

  isSimulating(projectId: string): boolean {
    return projects.get(projectId)?.processStartedAt != null;
  },

  listProjects(): VideoProjectDto[] {
    return [...projects.values()].map((project) => {
      refreshStatus(project);
      return strip(project);
    });
  },

  getProject(projectId: string): VideoProjectDto | undefined {
    const project = getOrNull(projectId);
    return project && strip(project);
  },

  getStatus(projectId: string): ProjectStatusDto | undefined {
    const project = getOrNull(projectId);
    if (!project) return undefined;
    return {
      id: project.id,
      status: project.status,
      updated_at: project.updated_at,
      stage: currentStage(project),
    };
  },

  attachVideo(
    projectId: string,
    file: Blob,
    meta: { filename: string; duration: number },
  ): VideoProjectDto | 'conflict' | undefined {
    const project = projects.get(projectId);
    if (!project) return undefined;
    if (project.status !== 'created') return 'conflict';
    project.original_filename = meta.filename;
    project.file_size = file.size;
    project.duration = meta.duration;
    project.objectUrl = URL.createObjectURL(file);
    project.status = 'uploaded';
    project.updated_at = now();
    return strip(project);
  },

  startProcessing(projectId: string): VideoProjectDto | 'conflict' | undefined {
    const project = projects.get(projectId);
    if (!project) return undefined;
    if (project.status === 'created') return 'conflict';
    for (const [key, item] of highlights) if (item.project_id === projectId) highlights.delete(key);
    project.processStartedAt = Date.now();
    project.status = 'processing';
    project.updated_at = now();
    return strip(project);
  },

  deleteProject(projectId: string): boolean {
    const project = projects.get(projectId);
    if (!project) return false;
    if (project.objectUrl) URL.revokeObjectURL(project.objectUrl);
    projects.delete(projectId);
    for (const [key, item] of highlights) if (item.project_id === projectId) highlights.delete(key);
    return true;
  },

  listHighlights(projectId: string): HighlightDto[] {
    return [...highlights.values()]
      .filter((item) => item.project_id === projectId)
      .sort((a, b) => b.score - a.score);
  },

  getHighlight(highlightId: string): HighlightDto | undefined {
    return highlights.get(highlightId);
  },

  generateClip(highlightId: string): GeneratedClipDto | undefined {
    const highlight = highlights.get(highlightId);
    if (!highlight) return undefined;
    const clip: MockClip = {
      id: id(),
      project_id: highlight.project_id,
      highlight_id: highlight.id,
      status: 'pending',
      created_at: now(),
      requestedAt: Date.now(),
    };
    clips.set(clip.id, clip);
    const { requestedAt: _requested, ...dto } = clip;
    return dto;
  },

  getClip(clipId: string): GeneratedClipDto | undefined {
    const clip = clips.get(clipId);
    if (!clip) return undefined;
    const elapsed = Date.now() - clip.requestedAt;
    clip.status =
      elapsed < 600 ? 'pending' : elapsed < CLIP_READY_AFTER_MS ? 'processing' : 'completed';
    const { requestedAt: _requested, ...dto } = clip;
    return dto;
  },

  getClipDownload(clipId: string): ClipDownloadDto | undefined {
    const clip = clips.get(clipId);
    const highlight = clip && highlights.get(clip.highlight_id);
    const project = highlight && projects.get(highlight.project_id);
    if (!clip || clip.status !== 'completed' || !highlight || !project?.objectUrl) return undefined;
    // Имитация не режет файл: отдаёт исходное видео с media fragment на нужный интервал
    return {
      url: `${project.objectUrl}#t=${highlight.start_time},${highlight.end_time}`,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  },
};
