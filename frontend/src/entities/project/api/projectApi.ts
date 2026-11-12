import {
  baseApi,
  type ProjectPageDto,
  type ProjectStatusDto,
  type VideoProjectDto,
} from '@/shared/api';
import { getVideoContentType } from '@/shared/config';

export const projectApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createProject: build.mutation<VideoProjectDto, { title: string }>({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: [{ type: 'Project', id: 'LIST' }],
    }),

    /**
     * Backend принимает видео потоком в теле запроса (не multipart):
     * имя файла — в query `filename`, Content-Type должен соответствовать расширению.
     */
    uploadVideo: build.mutation<VideoProjectDto, { projectId: string; file: File }>({
      query: ({ projectId, file }) => ({
        url: `/projects/${projectId}/upload`,
        method: 'POST',
        params: { filename: file.name },
        headers: { 'Content-Type': getVideoContentType(file.name) },
        body: file,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'Project', id: projectId },
        { type: 'Project', id: 'LIST' },
      ],
    }),

    startProcessing: build.mutation<VideoProjectDto, string>({
      query: (projectId) => ({ url: `/projects/${projectId}/process`, method: 'POST' }),
      invalidatesTags: (_result, _error, projectId) => [
        { type: 'Project', id: projectId },
        { type: 'Project', id: 'LIST' },
      ],
    }),

    listProjects: build.query<ProjectPageDto, { limit?: number; offset?: number } | undefined>({
      query: (page) => ({
        url: '/projects',
        params: { limit: page?.limit ?? 10, offset: page?.offset ?? 0 },
      }),
      providesTags: (result) => [
        { type: 'Project', id: 'LIST' },
        ...(result?.items.map((item) => ({ type: 'Project' as const, id: item.id })) ?? []),
      ],
    }),

    getProject: build.query<VideoProjectDto, string>({
      query: (projectId) => `/projects/${projectId}`,
      providesTags: (_result, _error, projectId) => [{ type: 'Project', id: projectId }],
    }),

    getProjectStatus: build.query<ProjectStatusDto, string>({
      query: (projectId) => `/projects/${projectId}/status`,
      providesTags: (_result, _error, projectId) => [{ type: 'Project', id: projectId }],
    }),
  }),
});

export const {
  useCreateProjectMutation,
  useUploadVideoMutation,
  useStartProcessingMutation,
  useListProjectsQuery,
  useGetProjectQuery,
  useGetProjectStatusQuery,
} = projectApi;
