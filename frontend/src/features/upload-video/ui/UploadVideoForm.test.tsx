import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { localPreviewSlice } from '@/entities/project';
import { baseApi } from '@/shared/api';

import { UploadVideoForm } from './UploadVideoForm';

const makeStore = () =>
  configureStore({
    reducer: combineSlices(baseApi, localPreviewSlice),
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });

function renderForm() {
  const router = createMemoryRouter([{ path: '/', element: <UploadVideoForm /> }]);
  return render(
    <Provider store={makeStore()}>
      <RouterProvider router={router} />
    </Provider>,
  );
}

describe('UploadVideoForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('убирает пустой проект, если backend отклонил файл', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (request: Request) => {
      const path = new URL(request.url).pathname.replace('/api/v1', '');
      calls.push(`${request.method} ${path}`);
      const headers = { 'Content-Type': 'application/json' };
      if (path === '/projects') {
        return new Response(JSON.stringify({ id: 'p1' }), { status: 201, headers });
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      const error = { code: 'unsupported_media', message: 'Это не видео' };
      return new Response(JSON.stringify({ error }), { status: 415, headers });
    });
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    renderForm();

    await user.upload(
      screen.getByLabelText(/Перетащите запись/),
      new File(['x'], 'a.mp4', { type: 'video/mp4' }),
    );
    await user.click(screen.getByRole('button', { name: 'Найти лучшие моменты' }));

    expect(await screen.findByText('Это не видео')).toBeInTheDocument();
    expect(calls).toContain('DELETE /projects/p1');
  });

  it('не даёт отправить форму без файла', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Найти лучшие моменты' })).toBeDisabled();
  });

  it('объясняет, почему файл не подошёл', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderForm();

    const input = screen.getByLabelText(/Перетащите запись/);
    await user.upload(input, new File(['hello'], 'notes.txt', { type: 'text/plain' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/\.txt не поддерживается/);
  });
});
