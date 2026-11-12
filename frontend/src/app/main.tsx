import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';

import { router } from './router/router';
import { makeStore } from './model/store';
import './styles/global.css';

const store = makeStore();
const container = document.getElementById('root');
if (!container) throw new Error('Не найден #root в index.html');

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
);
