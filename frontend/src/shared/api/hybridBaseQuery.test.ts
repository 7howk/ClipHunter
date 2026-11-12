import type { BaseQueryApi, FetchArgs } from '@reduxjs/toolkit/query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectStatusDto, VideoProjectDto } from './contracts';
import { createHybridBaseQuery } from './hybridBaseQuery';

const api = {} as BaseQueryApi;

const project: VideoProjectDto = {
  id: 'p-1',
  title: 'Стрим',
  original_filename: 'stream.mp4',
  file_size: 150_000_000,
  duration: 600,
  status: 'uploaded',
  created_at: '2026-11-12T10:00:00Z',
  updated_at: '2026-11-12T10:00:00Z',
};

/** Поддельный backend: знает только реализованные маршруты. */
function fakeBackend() {
  const calls: string[] = [];
  const http = vi.fn(async (args: string | FetchArgs) => {
    const { url, method = 'GET' } = typeof args === 'string' ? { url: args } : args;
    calls.push(`${method} ${url}`);
    if (url === `/projects/${project.id}`) return { data: project };
    if (url === `/projects/${project.id}/status`) {
      return { data: { id: project.id, status: 'uploaded', updated_at: project.updated_at } };
    }
    if (url === `/projects/${project.id}/upload`) return { data: project };
    return {
      error: { status: 404, data: { error: { code: 'http_error', message: 'Not Found' } } },
    };
  });
  return { http, calls };
}

async function run(query: ReturnType<typeof createHybridBaseQuery>, args: string | FetchArgs) {
  const promise = query(args, api, {});
  await vi.runAllTimersAsync();
  return promise;
}

describe('createHybridBaseQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:hybrid');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('отправляет реализованные маршруты в настоящий backend', async () => {
    const { http, calls } = fakeBackend();
    const query = createHybridBaseQuery(http);

    const result = await run(query, `/projects/${project.id}`);

    expect(result.data).toEqual(project);
    expect(calls).toEqual([`GET /projects/${project.id}`]);
  });

  it('имитирует обработку на настоящих данных проекта и подменяет статус', async () => {
    const { http, calls } = fakeBackend();
    const query = createHybridBaseQuery(http);

    await run(query, { url: `/projects/${project.id}/process`, method: 'POST' });
    // backend не знает про /process: вместо него читаем проект и запускаем имитацию
    expect(calls).toEqual([`GET /projects/${project.id}`]);

    const status = await run(query, `/projects/${project.id}/status`);
    expect((status.data as ProjectStatusDto).status).toBe('processing');

    vi.advanceTimersByTime(15_000);
    const done = await run(query, `/projects/${project.id}/status`);
    expect((done.data as ProjectStatusDto).status).toBe('completed');

    const highlights = await run(query, `/projects/${project.id}/highlights`);
    expect(calls).not.toContain(`GET /projects/${project.id}/highlights`);
    expect((highlights.data as { items: unknown[] }).items.length).toBeGreaterThan(0);
  });

  it('передаёт ошибки backend без изменений', async () => {
    const { http } = fakeBackend();
    const query = createHybridBaseQuery(http);

    const result = await run(query, '/projects/missing');

    expect(result.error).toMatchObject({ status: 404 });
  });
});
