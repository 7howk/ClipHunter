import type { BaseQueryApi } from '@reduxjs/toolkit/query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HighlightListDto, ProjectStatusDto, VideoProjectDto } from '../contracts';

import { mockBaseQuery } from './mockBaseQuery';

const api = {} as BaseQueryApi;

async function call<T>(args: Parameters<typeof mockBaseQuery>[0]) {
  const promise = mockBaseQuery(args, api, {});
  await vi.runAllTimersAsync();
  const result = await promise;
  if ('error' in result && result.error) throw new Error(JSON.stringify(result.error));
  return result.data as T;
}

/** Загрузка как в backend: тело — сам файл, имя — в query `filename`. */
const upload = (projectId: string, file: File) =>
  call<VideoProjectDto>({
    url: `/projects/${projectId}/upload`,
    method: 'POST',
    params: { filename: file.name },
    body: file,
  });

describe('mockBaseQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('проводит проект через весь pipeline по контракту', async () => {
    const project = await call<VideoProjectDto>({
      url: '/projects',
      method: 'POST',
      body: { title: 'Стрим' },
    });
    expect(project.status).toBe('created');

    // ~10 минут по оценке размера: в jsdom метаданные видео недоступны
    const file = new File([new Uint8Array(150_000_000)], 'stream.mp4', { type: 'video/mp4' });
    const uploaded = await upload(project.id, file);
    expect(uploaded.status).toBe('uploaded');
    expect(uploaded.original_filename).toBe('stream.mp4');
    expect(uploaded.duration).toBeGreaterThan(30);

    await call({ url: `/projects/${project.id}/process`, method: 'POST' });
    const processing = await call<ProjectStatusDto>(`/projects/${project.id}/status`);
    expect(processing.status).toBe('processing');
    expect(processing.stage).toBe('extracting_audio');

    vi.advanceTimersByTime(15_000);
    const done = await call<ProjectStatusDto>(`/projects/${project.id}/status`);
    expect(['completed', 'no_highlights']).toContain(done.status);
    expect(done.stage).toBeUndefined();

    const { items, min_score } = await call<HighlightListDto>(`/projects/${project.id}/highlights`);
    for (const item of items) {
      expect(item.score).toBeGreaterThanOrEqual(min_score);
      expect(item.end_time).toBeGreaterThan(item.start_time);
      expect(item.end_time).toBeLessThanOrEqual(uploaded.duration ?? Infinity);
    }
    // Лучшие моменты идут первыми
    const scores = items.map((item) => item.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('честно возвращает пустой список для короткой записи', async () => {
    const project = await call<VideoProjectDto>({
      url: '/projects',
      method: 'POST',
      body: { title: 'Коротко' },
    });
    await upload(project.id, new File([new Uint8Array(1000)], 'clip.mp4', { type: 'video/mp4' }));
    await call({ url: `/projects/${project.id}/process`, method: 'POST' });

    vi.advanceTimersByTime(15_000);
    const done = await call<ProjectStatusDto>(`/projects/${project.id}/status`);
    expect(done.status).toBe('no_highlights');
    const list = await call<HighlightListDto>(`/projects/${project.id}/highlights`);
    expect(list.items).toEqual([]);
  });

  it('не даёт загрузить видео в проект дважды, как backend', async () => {
    const project = await call<VideoProjectDto>({
      url: '/projects',
      method: 'POST',
      body: { title: 'Дубль' },
    });
    const file = new File([new Uint8Array(1000)], 'a.mp4', { type: 'video/mp4' });
    await upload(project.id, file);

    await expect(upload(project.id, file)).rejects.toThrow(/"status":409/);
  });

  it('отвечает ошибкой в едином формате', async () => {
    const promise = mockBaseQuery('/projects/unknown', api, {});
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.error).toEqual({
      status: 404,
      data: { error: { code: 'not_found', message: 'Проект не найден' } },
    });
  });
});
