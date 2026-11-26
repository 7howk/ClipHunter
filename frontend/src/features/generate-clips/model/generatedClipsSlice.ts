import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';

import { projectApi } from '@/entities/project';

export interface RequestedClip {
  clipId: string;
  highlightId: string;
}

/**
 * Запрошенные клипы по проектам. В контракте API нет списка клипов проекта,
 * поэтому id созданных клипов запоминаем на клиенте (см. clipStorage).
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
    /** Другая вкладка изменила сохранённый список. */
    clipsRestored(_state, action: PayloadAction<GeneratedClipsState>) {
      return action.payload;
    },
    clipRequested(state, action: PayloadAction<{ projectId: string } & RequestedClip>) {
      const { projectId, clipId, highlightId } = action.payload;
      const list = state.byProject[projectId] ?? [];
      state.byProject[projectId] = [
        ...list.filter((c) => c.highlightId !== highlightId),
        { clipId, highlightId },
      ];
    },
  },
  extraReducers: (builder) => {
    // Backend удаляет клипы при повторной обработке и вместе с проектом
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
    selectRequestedClips: (state, projectId: string): readonly RequestedClip[] =>
      state.byProject[projectId] ?? EMPTY,
  },
});

export const { clipRequested, clipsRestored } = generatedClipsSlice.actions;
export const { selectRequestedClips } = generatedClipsSlice.selectors;

export type GeneratedClipsRootState = { [generatedClipsSlice.reducerPath]: GeneratedClipsState };
