import { baseApi, type HighlightDto, type HighlightListDto } from '@/shared/api';

export const highlightApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProjectHighlights: build.query<HighlightListDto, string>({
      query: (projectId) => `/projects/${projectId}/highlights`,
      providesTags: (result, _error, projectId) => [
        { type: 'Highlight', id: `project-${projectId}` },
        ...(result?.items.map((item) => ({ type: 'Highlight' as const, id: item.id })) ?? []),
      ],
    }),

    getHighlight: build.query<HighlightDto, string>({
      query: (highlightId) => `/highlights/${highlightId}`,
      providesTags: (_result, _error, highlightId) => [{ type: 'Highlight', id: highlightId }],
    }),
  }),
});

export const { useGetProjectHighlightsQuery, useGetHighlightQuery } = highlightApi;
