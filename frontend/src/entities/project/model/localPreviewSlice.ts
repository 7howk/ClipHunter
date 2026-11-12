import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Локальное превью: blob-URL исходного файла, чтобы смотреть найденные моменты
 * без скачивания видео обратно с сервера. Живёт только в текущей вкладке.
 */
export interface LocalPreviewState {
  urls: Record<string, string>;
}

const initialState: LocalPreviewState = { urls: {} };

export const localPreviewSlice = createSlice({
  name: 'localPreview',
  initialState,
  reducers: {
    previewAttached(state, action: PayloadAction<{ projectId: string; url: string }>) {
      state.urls[action.payload.projectId] = action.payload.url;
    },
    previewReleased(state, action: PayloadAction<string>) {
      const { [action.payload]: _released, ...rest } = state.urls;
      state.urls = rest;
    },
  },
  selectors: {
    selectPreviewUrl: (state, projectId: string): string | undefined => state.urls[projectId],
  },
});

export const { previewAttached, previewReleased } = localPreviewSlice.actions;
export const { selectPreviewUrl } = localPreviewSlice.selectors;

/** Часть корневого состояния, которую читают селекторы слайса. */
export type LocalPreviewRootState = { [localPreviewSlice.reducerPath]: LocalPreviewState };
