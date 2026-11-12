import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { baseApi } from '@/shared/api';

import { LandingPage } from './LandingPage';

const makeStore = () =>
  configureStore({
    reducer: combineSlices(baseApi),
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });

function renderLanding() {
  const router = createMemoryRouter([{ path: '/', element: <LandingPage /> }]);
  return render(
    <Provider store={makeStore()}>
      <RouterProvider router={router} />
    </Provider>,
  );
}

describe('LandingPage', () => {
  it('представляет Бобби и ведёт на загрузку видео', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Привет,\s*я Бобби/i);
    const uploadLinks = screen.getAllByRole('link', { name: /Загрузить видео/ });
    expect(uploadLinks.length).toBeGreaterThan(0);
    for (const link of uploadLinks) expect(link).toHaveAttribute('href', '/upload');
  });

  it('показывает все секции лендинга', () => {
    renderLanding();

    for (const name of [/Как это работает/i, /Что ты получишь/i, /Честные хайлайты/i]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('img', { name: /Бобби/ })).toBeInTheDocument();
  });
});
