import { useGetHealthQuery } from '../api/healthApi';

import styles from './ApiStatus.module.css';

/** Живой индикатор связи с backend: опрашивает /health раз в 30 секунд. */
export function ApiStatus() {
  const { data, isError, isLoading } = useGetHealthQuery(undefined, {
    pollingInterval: 30_000,
    skipPollingIfUnfocused: true,
  });

  const state = isLoading ? 'checking' : isError ? 'down' : data?.mock ? 'mock' : 'up';
  const label = {
    checking: 'Проверяем API',
    down: 'API недоступен',
    mock: 'Демо-режим API',
    up: 'API на связи',
  }[state];

  return (
    <span className={styles.status} data-state={state} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
