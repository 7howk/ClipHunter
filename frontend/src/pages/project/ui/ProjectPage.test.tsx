import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { localPreviewSlice } from '@/entities/project';
import { generatedClipsSlice } from '@/features/generate-clips';
import { highlightSelectionSlice } from '@/features/select-highlights';
import { baseApi } from '@/shared/api';

import { ProjectPage } from './ProjectPage';

const ID = 'p1';

const project = {
  id: ID,
  title: 'Стрим',
  original_filename: 'stream.mp4',
  file_size: 1000,
  duration: 600,
  status: 'failed',
  created_at: '2026-11-25T10:00:00Z',
  updated_at: '2026-11-25T10:00:00Z',
};

const highlight = {
  id: 'h1',
  project_id: ID,
  start_time: 10,
  end_time: 40,
  score: 90,
  category: 'funny',
  title: 'Смешной момент',
  description: 'Описание',
  reason: 'Причина',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Поддельный backend по контракту: ключ — «МЕТОД /путь». */
function stubBackend(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (request: Request) => {
    const key = `${request.method} ${new URL(request.url).pathname.replace('/api/v1', '')}`;
    calls.push(key);
    return routes[key]?.() ?? json({ error: { code: 'not_found', message: 'Не найдено' } }, 404);
  });
  return calls;
}

function renderPage() {
  const store = configureStore({
    reducer: combineSlices(
      baseApi,
      localPreviewSlice,
      highlightSelectionSlice,
      generatedClipsSlice,
    ),
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
  const router = createMemoryRouter(
    [
      { path: '/projects/:projectId', element: <ProjectPage /> },
      { path: '/upload', element: <p>Страница загрузки</p> },
    ],
    { initialEntries: [`/projects/${ID}`] },
  );
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return store;
}

const withStatus = (status: string, extra: object = {}) => ({
  [`GET /projects/${ID}`]: () => json({ ...project, status }),
  [`GET /projects/${ID}/status`]: () =>
    json({ id: ID, status, updated_at: project.updated_at, ...extra }),
});

describe('ProjectPage с настоящим API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('показывает причину ошибки и запускает обработку заново', async () => {
    const calls = stubBackend({
      ...withStatus('failed', { error: 'Groq не отвечает' }),
      [`POST /projects/${ID}/process`]: () => json({ ...project, status: 'processing' }, 202),
    });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Groq не отвечает');
    await userEvent.click(screen.getByRole('button', { name: 'Запустить снова' }));

    expect(calls).toContain(`POST /projects/${ID}/process`);
  });

  it('говорит, что запись в очереди, пока этапа нет', async () => {
    stubBackend(withStatus('processing'));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Запись в очереди' })).toBeInTheDocument();
  });

  it('нарезает выбранный момент и предлагает повторить неудачную нарезку', async () => {
    const clip = { id: 'c1', project_id: ID, highlight_id: 'h1', created_at: project.created_at };
    let attempt = 0;
    stubBackend({
      ...withStatus('completed'),
      [`GET /projects/${ID}/highlights`]: () => json({ items: [highlight], min_score: 60 }),
      'POST /highlights/h1/generate': () => {
        attempt += 1;
        return json({ ...clip, id: `c${attempt}`, status: 'pending' }, 202);
      },
      'GET /clips/c1': () => json({ ...clip, status: 'failed' }),
      'GET /clips/c2': () => json({ ...clip, id: 'c2', status: 'completed' }),
    });
    const store = renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить в нарезку' }));
    await userEvent.click(screen.getByRole('button', { name: /Нарезать 1 клип/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Нарезать заново/ }));

    expect(await screen.findByRole('button', { name: /Скачать клип/ })).toBeInTheDocument();
    expect(store.getState().generatedClips.byProject[ID]).toEqual([
      { clipId: 'c2', highlightId: 'h1' },
    ]);
  });

  it('удаляет проект только после подтверждения', async () => {
    const calls = stubBackend({
      ...withStatus('uploaded'),
      [`DELETE /projects/${ID}`]: () => new Response(null, { status: 204 }),
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить проект' }));
    expect(calls).not.toContain(`DELETE /projects/${ID}`);
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(screen.getByText('Страница загрузки')).toBeInTheDocument());
    expect(calls).toContain(`DELETE /projects/${ID}`);
  });
});
