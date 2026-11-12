import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

import { MAX_VIDEO_DURATION_SECONDS } from '../../config/env';
import type { ApiErrorBody } from '../contracts';
import { parseRequest, type ParsedRequest } from '../request';

import { mockDb } from './mockDb';

const LATENCY_MS = 280;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Result = { data: unknown } | { error: FetchBaseQueryError };

function fail(status: number, code: string, message: string): { error: FetchBaseQueryError } {
  const data: ApiErrorBody = { error: { code, message } };
  return { error: { status, data } };
}

const notFound = (what: string) => fail(404, 'not_found', `${what} не найден`);
const conflict = (message: string) => fail(409, 'conflict', message);

/** Длительность видео из метаданных браузера; в окружении без медиа — оценка по размеру. */
function readDuration(file: Blob): Promise<number> {
  const estimate = file.size / 250_000;
  if (typeof document === 'undefined') return Promise.resolve(estimate);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value: number) => {
      // Сначала отвязываем источник, иначе браузер продолжит читать уже отозванный URL
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) && value > 0 ? value : estimate);
    };
    const timer = setTimeout(() => done(estimate), 4000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      done(video.duration);
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(estimate);
    };
    video.src = url;
  });
}

/** Этапы, которых в backend ещё нет: обработка, хайлайты, клипы. */
export function isSimulatedPipelineRoute({ verb, parts }: ParsedRequest): boolean {
  const [resource, , action] = parts;
  if (resource === 'projects') {
    return (action === 'process' && verb === 'POST') || (action === 'highlights' && verb === 'GET');
  }
  return resource === 'highlights' || resource === 'clips';
}

/** Ответ имитации на разобранный запрос. Маршруты и форматы — как в контракте API. */
export async function handleMockRequest({
  verb,
  path,
  parts,
  params,
  body,
}: ParsedRequest): Promise<Result> {
  await delay(LATENCY_MS);

  if (path === 'health') return { data: { status: 'ok', mock: true } };

  if (parts[0] === 'projects') {
    const [, projectId, action] = parts;

    if (!projectId) {
      if (verb === 'GET') {
        const items = mockDb.listProjects().reverse();
        return { data: { items, total: items.length, limit: 20, offset: 0 } };
      }
      if (verb === 'POST') {
        const title = (body as { title?: string } | undefined)?.title?.trim();
        if (!title) return fail(422, 'validation_error', 'Некорректные параметры запроса');
        return { data: mockDb.createProject(title) };
      }
    }

    if (projectId && !action) {
      if (verb === 'GET') {
        const project = mockDb.getProject(projectId);
        return project ? { data: project } : notFound('Проект');
      }
      if (verb === 'DELETE') {
        return mockDb.deleteProject(projectId) ? { data: null } : notFound('Проект');
      }
    }

    if (projectId && action === 'upload' && verb === 'POST') {
      const filename = params.filename;
      if (!(body instanceof Blob) || !filename) {
        return fail(422, 'validation_error', 'Некорректные параметры запроса');
      }
      const duration = await readDuration(body);
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        return fail(422, 'invalid_input', 'Видео длиннее допустимого');
      }
      const project = mockDb.attachVideo(projectId, body, { filename, duration });
      if (project === 'conflict') return conflict('В проект уже загружено видео');
      return project ? { data: project } : notFound('Проект');
    }

    if (projectId && action === 'process' && verb === 'POST') {
      const project = mockDb.startProcessing(projectId);
      if (project === 'conflict') return conflict('Сначала загрузите видео');
      return project ? { data: project } : notFound('Проект');
    }

    if (projectId && action === 'status' && verb === 'GET') {
      const status = mockDb.getStatus(projectId);
      return status ? { data: status } : notFound('Проект');
    }

    if (projectId && action === 'highlights' && verb === 'GET') {
      if (!mockDb.getProject(projectId)) return notFound('Проект');
      return { data: { items: mockDb.listHighlights(projectId), min_score: mockDb.minScore } };
    }
  }

  if (parts[0] === 'highlights' && parts[1]) {
    if (!parts[2] && verb === 'GET') {
      const highlight = mockDb.getHighlight(parts[1]);
      return highlight ? { data: highlight } : notFound('Хайлайт');
    }
    if (parts[2] === 'generate' && verb === 'POST') {
      const clip = mockDb.generateClip(parts[1]);
      return clip ? { data: clip } : notFound('Хайлайт');
    }
  }

  if (parts[0] === 'clips' && parts[1]) {
    if (!parts[2] && verb === 'GET') {
      const clip = mockDb.getClip(parts[1]);
      return clip ? { data: clip } : notFound('Клип');
    }
    if (parts[2] === 'download' && verb === 'GET') {
      const link = mockDb.getClipDownload(parts[1]);
      return link ? { data: link } : conflict('Клип ещё не готов');
    }
  }

  return fail(404, 'http_error', 'Not Found');
}

/** Режим mock: весь API /api/v1 имитируется в браузере. */
export const mockBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = (
  args,
) => handleMockRequest(parseRequest(args));
