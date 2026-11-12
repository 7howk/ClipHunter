import type { FetchArgs } from '@reduxjs/toolkit/query';

export interface ParsedRequest {
  verb: string;
  /** Путь без ведущего слэша и query: `projects/42/status`. */
  path: string;
  parts: string[];
  params: Record<string, string>;
  body: unknown;
}

/** Разбор аргументов RTK Query, чтобы маршрутизировать запрос между backend и имитацией. */
export function parseRequest(args: string | FetchArgs): ParsedRequest {
  const { url, method = 'GET', body, params } = typeof args === 'string' ? { url: args } : args;
  const [rawPath = '', rawQuery = ''] = url.replace(/^\/+/, '').split('?');
  const query = Object.fromEntries(new URLSearchParams(rawQuery));
  const extra = Object.fromEntries(
    Object.entries((params ?? {}) as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value),
    ]),
  );
  return {
    verb: method.toUpperCase(),
    path: rawPath,
    parts: rawPath.split('/').filter(Boolean),
    params: { ...query, ...extra },
    body,
  };
}
