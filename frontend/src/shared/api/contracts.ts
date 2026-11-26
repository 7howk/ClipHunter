/**
 * DTO REST API /api/v1. Повторяют схемы backend
 * (backend/src/cliphunter/application/dto.py, domain/entities.py).
 * Поля в snake_case — так их отдаёт FastAPI/Pydantic.
 */

/** ProjectStatus из domain/entities.py. */
export type ProjectStatus =
  'created' | 'uploaded' | 'processing' | 'completed' | 'no_highlights' | 'failed';

/** ProcessingStage: этап внутри статуса processing. Пока задача в очереди, его нет. */
export type ProcessingStage = 'extracting_audio' | 'transcribing' | 'analyzing';

/** ProjectOutput. */
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

/** ProjectPage. */
export interface ProjectPageDto {
  items: VideoProjectDto[];
  total: number;
  limit: number;
  offset: number;
}

/** ProjectStatusOutput: пустые stage и error backend не присылает. */
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
