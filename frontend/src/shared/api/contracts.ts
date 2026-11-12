/**
 * DTO REST API /api/v1. Реализованные части повторяют схемы backend
 * (backend/src/cliphunter/application/dto.py, domain/entities.py),
 * остальные — контракт из BACKEND_INFRA_TASK.md (разделы 6.4, 7, 8).
 * Поля в snake_case — так их отдаёт FastAPI/Pydantic.
 */

/** ProjectStatus из domain/entities.py. */
export type ProjectStatus =
  'created' | 'uploaded' | 'processing' | 'completed' | 'no_highlights' | 'failed';

/**
 * Этап внутри статуса processing. В backend этого поля пока нет: его отдаёт
 * имитация pipeline. Это предложение к контракту, интерфейс работает и без него.
 */
export type ProcessingStage = 'extracting_audio' | 'transcribing' | 'analyzing';

/** ProjectOutput — реализовано в backend. */
export interface VideoProjectDto {
  id: string;
  title: string;
  original_filename: string | null;
  file_size: number | null;
  duration: number | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

/** ProjectPage — реализовано в backend. */
export interface ProjectPageDto {
  items: VideoProjectDto[];
  total: number;
  limit: number;
  offset: number;
}

/** ProjectStatusOutput — реализовано в backend; stage и error пока только в имитации. */
export interface ProjectStatusDto {
  id: string;
  status: ProjectStatus;
  updated_at: string;
  stage?: ProcessingStage;
  error?: string;
}

/** Категории из критериев оценки LLM. Backend хранит категорию строкой. */
export type HighlightCategory =
  'funny' | 'emotional' | 'surprise' | 'conflict' | 'tension' | 'climax' | 'reaction';

export interface HighlightDto {
  id: string;
  project_id: string;
  start_time: number;
  end_time: number;
  score: number;
  category: HighlightCategory | (string & {});
  title: string;
  description: string;
  reason: string;
}

export interface HighlightListDto {
  items: HighlightDto[];
  min_score: number;
}

/** ClipStatus из domain/entities.py. */
export type ClipStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GeneratedClipDto {
  id: string;
  project_id: string;
  highlight_id: string;
  status: ClipStatus;
  created_at: string;
}

export interface ClipDownloadDto {
  url: string;
  expires_at: string;
}

/** Единый формат ошибок backend (presentation/http/errors.py). */
export interface ApiErrorBody {
  error: { code: string; message: string };
}
