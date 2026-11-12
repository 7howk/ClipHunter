import { baseApi } from '@/shared/api';

/** GET /api/v1/health — единственный endpoint, который backend уже реализует. */
export const healthApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<{ status: string; mock?: boolean }, undefined>({
      query: () => '/health',
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;
