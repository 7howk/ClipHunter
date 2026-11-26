import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { localPreviewSlice } from '@/entities/project';
import {
  CLIPS_STORAGE_KEY,
  clipsRestored,
  generatedClipsSlice,
  loadGeneratedClips,
  saveGeneratedClips,
} from '@/features/generate-clips';
import { highlightSelectionSlice } from '@/features/select-highlights';
import { baseApi } from '@/shared/api';
import { API_MODE } from '@/shared/config';

const rootReducer = combineSlices(
  baseApi,
  localPreviewSlice,
  highlightSelectionSlice,
  generatedClipsSlice,
);

export function makeStore(preloadedState?: Partial<RootState>) {
  // Имитация живёт до перезагрузки, поэтому в режиме mock клипы не запоминаем
  const persist = API_MODE !== 'mock';
  const store = configureStore({
    reducer: rootReducer,
    preloadedState:
      preloadedState ?? (persist ? { generatedClips: loadGeneratedClips() } : undefined),
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
  setupListeners(store.dispatch);

  if (persist) {
    let saved = store.getState().generatedClips;
    store.subscribe(() => {
      const next = store.getState().generatedClips;
      if (next === saved) return;
      saved = next;
      saveGeneratedClips(next);
    });
    // Каждая вкладка пишет список целиком: без синхронизации они затирали бы друг друга
    window.addEventListener('storage', (event) => {
      if (event.key === CLIPS_STORAGE_KEY) store.dispatch(clipsRestored(loadGeneratedClips()));
    });
  }
  return store;
}

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
