import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { API_MODE, API_URL } from '@/shared/config';

import { mockBaseQuery } from './mock/mockBaseQuery';

const baseQuery =
  API_MODE === 'mock' ? mockBaseQuery : fetchBaseQuery({ baseUrl: `${API_URL}/api/v1` });

/**
 * Корневой RTK Query API. Сущности добавляют свои endpoints через injectEndpoints,
 * поэтому shared ничего не знает о конкретных слайсах.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Project', 'Highlight', 'Clip'],
  endpoints: () => ({}),
});
