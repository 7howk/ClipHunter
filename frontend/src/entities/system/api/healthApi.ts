import { baseApi } from '@/shared/api';

/** GET /api/v1/health: жив ли процесс API. */
export const healthApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<{ status: string; mock?: boolean }, undefined>({
      query: () => '/health',
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;
