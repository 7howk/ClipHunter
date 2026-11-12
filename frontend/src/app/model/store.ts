import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { localPreviewSlice } from '@/entities/project';
import { generatedClipsSlice } from '@/features/generate-clips';
import { highlightSelectionSlice } from '@/features/select-highlights';
import { baseApi } from '@/shared/api';

const rootReducer = combineSlices(
  baseApi,
  localPreviewSlice,
  highlightSelectionSlice,
  generatedClipsSlice,
);

export function makeStore(preloadedState?: Partial<RootState>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
}

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];
