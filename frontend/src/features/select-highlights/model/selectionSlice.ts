import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';

import { projectApi } from '@/entities/project';

/** Какие моменты пользователь отметил для нарезки, по проектам. */
export interface HighlightSelectionState {
  byProject: Record<string, string[]>;
}

const initialState: HighlightSelectionState = { byProject: {} };
const EMPTY: readonly string[] = [];

export const highlightSelectionSlice = createSlice({
  name: 'highlightSelection',
  initialState,
  reducers: {
    highlightToggled(state, action: PayloadAction<{ projectId: string; highlightId: string }>) {
      const { projectId, highlightId } = action.payload;
      const current = state.byProject[projectId] ?? [];
      state.byProject[projectId] = current.includes(highlightId)
        ? current.filter((id) => id !== highlightId)
        : [...current, highlightId];
    },
    selectionCleared(state, action: PayloadAction<string>) {
      state.byProject[action.payload] = [];
    },
  },
  extraReducers: (builder) => {
    // После повторной обработки или удаления прежних хайлайтов не существует
    builder.addMatcher(
      isAnyOf(
        projectApi.endpoints.startProcessing.matchFulfilled,
        projectApi.endpoints.deleteProject.matchFulfilled,
      ),
      (state, action) => {
        const { [action.meta.arg.originalArgs]: _removed, ...rest } = state.byProject;
        state.byProject = rest;
      },
    );
  },
  selectors: {
    selectSelectedHighlightIds: (state, projectId: string): readonly string[] =>
      state.byProject[projectId] ?? EMPTY,
  },
});

export const { highlightToggled, selectionCleared } = highlightSelectionSlice.actions;
export const { selectSelectedHighlightIds } = highlightSelectionSlice.selectors;

export type HighlightSelectionRootState = {
  [highlightSelectionSlice.reducerPath]: HighlightSelectionState;
};
