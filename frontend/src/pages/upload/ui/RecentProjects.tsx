import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { projectApi, STATUS_LABELS, useListProjectsQuery } from '@/entities/project';
import { routes } from '@/shared/config';
import { formatTimecode } from '@/shared/lib';
import { Button } from '@/shared/ui';

import styles from './RecentProjects.module.css';

const PAGE_SIZE = 5;
const POLL_MS = 5000;

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Проекты из GET /api/v1/projects: к ним можно вернуться без повторной загрузки. */
export function RecentProjects() {
  const [page, setPage] = useState(0);
  const query = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  // Опрашиваем список, только пока в нём есть обрабатывающиеся проекты
  const cached = projectApi.endpoints.listProjects.useQueryState(query).data;
  const processing = cached?.items.some((item) => item.status === 'processing');
  const { data, isLoading, isError } = useListProjectsQuery(query, {
    pollingInterval: processing ? POLL_MS : 0,
    skipPollingIfUnfocused: true,
    refetchOnMountOrArgChange: true,
  });

  if (isLoading) return null;

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  // После удаления последняя страница может исчезнуть
  if (data && page >= pages) setPage(pages - 1);

  return (
    <section className={styles.section} aria-labelledby="recent-title">
      <h2 id="recent-title" className={styles.title}>
        Проекты
      </h2>
      {isError && <p className={styles.muted}>Список недоступен: backend не отвечает</p>}
      {data && data.total === 0 && (
        <p className={styles.muted}>Пока пусто. Первый проект появится здесь после загрузки</p>
      )}
      {data && data.items.length > 0 && (
        <ul className={styles.list}>
          {data.items.map((project) => (
            <li key={project.id}>
              <Link to={routes.project(project.id)} className={styles.row}>
                <span className={styles.name}>{project.title}</span>
                <span className={styles.meta}>
                  {STATUS_LABELS[project.status]}
                  {project.duration !== null && `, ${formatTimecode(project.duration)}`}
                </span>
                <span className={styles.date}>
                  {dateFormat.format(new Date(project.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className={styles.pager} aria-label="Страницы списка проектов">
          <Button
            variant="text"
            size="sm"
            icon={<ChevronLeft />}
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            Новее
          </Button>
          <span className={styles.muted}>
            {page + 1} из {pages}
          </span>
          <Button
            variant="text"
            size="sm"
            icon={<ChevronRight />}
            iconPosition="end"
            onClick={() => setPage(page + 1)}
            disabled={page >= pages - 1}
          >
            Старше
          </Button>
        </nav>
      )}
    </section>
  );
}
