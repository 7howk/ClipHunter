import { baseApi, type ClipDownloadDto, type GeneratedClipDto } from '@/shared/api';

export const clipApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    generateClip: build.mutation<GeneratedClipDto, string>({
      query: (highlightId) => ({ url: `/highlights/${highlightId}/generate`, method: 'POST' }),
    }),

    getClip: build.query<GeneratedClipDto, string>({
      query: (clipId) => `/clips/${clipId}`,
      providesTags: (_result, _error, clipId) => [{ type: 'Clip', id: clipId }],
    }),

    getClipDownload: build.query<ClipDownloadDto, string>({
      query: (clipId) => `/clips/${clipId}/download`,
      // Ссылка подписанная и временная: запрашиваем её по нажатию и долго не храним
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGenerateClipMutation, useGetClipQuery, useLazyGetClipDownloadQuery } = clipApi;
