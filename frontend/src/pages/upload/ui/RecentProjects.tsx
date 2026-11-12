import { Link } from 'react-router';

import { STATUS_LABELS, useListProjectsQuery } from '@/entities/project';
import { routes } from '@/shared/config';
import { formatTimecode } from '@/shared/lib';

import styles from './RecentProjects.module.css';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Последние проекты из GET /api/v1/projects — к ним можно вернуться без повторной загрузки. */
export function RecentProjects() {
  const { data, isLoading, isError } = useListProjectsQuery({ limit: 5 });

  if (isLoading) return null;

  return (
    <section className={styles.section} aria-labelledby="recent-title">
      <h2 id="recent-title" className={styles.title}>
        Недавние проекты
      </h2>
      {isError && <p className={styles.muted}>Список недоступен: backend не отвечает</p>}
      {data && data.items.length === 0 && (
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
    </section>
  );
}
