import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

import type { ProjectPageDto, ProjectStatusDto, VideoProjectDto } from './contracts';
import { handleMockRequest, isSimulatedPipelineRoute } from './mock/mockBaseQuery';
import { mockDb } from './mock/mockDb';
import { parseRequest } from './request';

type Query = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

/**
 * Режим hybrid. Всё, что backend уже реализует (health, проекты, статус, загрузка),
 * идёт в настоящий REST API. Этапы, которых в backend пока нет (обработка, хайлайты,
 * клипы), прогоняет имитация, опираясь на настоящие данные проекта из backend.
 * Когда backend реализует этап, его маршрут убирают из isSimulatedPipelineRoute.
 */
export function createHybridBaseQuery(http: Query): Query {
  return async (args, api: BaseQueryApi, extraOptions) => {
    const request = parseRequest(args);
    const [resource, projectId, action] = request.parts;

    // Запуск обработки: берём настоящий проект из backend и отдаём его имитации
    if (resource === 'projects' && projectId && action === 'process' && request.verb === 'POST') {
      const real = await http(`/projects/${projectId}`, api, extraOptions);
      if (real.error) return real;
      mockDb.adoptProject(real.data as VideoProjectDto);
      return handleMockRequest(request);
    }

    if (isSimulatedPipelineRoute(request)) return handleMockRequest(request);

    const result = await http(args, api, extraOptions);
    if (result.error || resource !== 'projects') return result;

    // Загруженный файл запоминаем, чтобы имитация нарезки могла отдать «клип»
    if (projectId && action === 'upload' && request.body instanceof Blob) {
      mockDb.adoptProject(result.data as VideoProjectDto, request.body);
      return result;
    }

    // Пока идёт имитация, статус проекта берём из неё — backend о ней не знает
    if (projectId && mockDb.isSimulating(projectId)) {
      const simulated = mockDb.getStatus(projectId);
      if (simulated && action === 'status') {
        return { ...result, data: { ...(result.data as ProjectStatusDto), ...simulated } };
      }
      if (simulated && !action) {
        return {
          ...result,
          data: { ...(result.data as VideoProjectDto), status: simulated.status },
        };
      }
    }

    if (!projectId && request.verb === 'GET') {
      const page = result.data as ProjectPageDto;
      const items = page.items.map((item) =>
        mockDb.isSimulating(item.id)
          ? { ...item, status: mockDb.getStatus(item.id)?.status ?? item.status }
          : item,
      );
      return { ...result, data: { ...page, items } };
    }

    return result;
  };
}
