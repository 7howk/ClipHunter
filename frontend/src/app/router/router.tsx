import { createBrowserRouter } from 'react-router';

import { LandingPage } from '@/pages/landing';
import { NotFoundPage } from '@/pages/not-found';
import { routes } from '@/shared/config';

import { RootLayout } from '../layouts/RootLayout';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: routes.home, element: <LandingPage /> },
      {
        // Рабочие страницы грузятся лениво — лендинг остаётся лёгким
        path: routes.upload,
        lazy: async () => ({ Component: (await import('@/pages/upload')).UploadPage }),
      },
      {
        path: routes.projectPattern,
        lazy: async () => ({ Component: (await import('@/pages/project')).ProjectPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
