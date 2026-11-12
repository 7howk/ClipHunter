import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

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
