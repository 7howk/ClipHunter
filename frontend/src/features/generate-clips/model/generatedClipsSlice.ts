import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface RequestedClip {
  clipId: string;
  highlightId: string;
}

/**
 * Запрошенные клипы по проектам. В контракте API нет списка клипов проекта,
 * поэтому id созданных клипов запоминаем на клиенте.
 */
export interface GeneratedClipsState {
  byProject: Record<string, RequestedClip[]>;
}

const initialState: GeneratedClipsState = { byProject: {} };
const EMPTY: readonly RequestedClip[] = [];

export const generatedClipsSlice = createSlice({
  name: 'generatedClips',
  initialState,
  reducers: {
    clipRequested(state, action: PayloadAction<{ projectId: string } & RequestedClip>) {
      const { projectId, clipId, highlightId } = action.payload;
      const list = state.byProject[projectId] ?? [];
      state.byProject[projectId] = [
        ...list.filter((c) => c.highlightId !== highlightId),
        { clipId, highlightId },
      ];
    },
  },
  selectors: {
    selectRequestedClips: (state, projectId: string): readonly RequestedClip[] =>
      state.byProject[projectId] ?? EMPTY,
  },
});

export const { clipRequested } = generatedClipsSlice.actions;
export const { selectRequestedClips } = generatedClipsSlice.selectors;

export type GeneratedClipsRootState = { [generatedClipsSlice.reducerPath]: GeneratedClipsState };
