import { useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router';

import { useGetProjectHighlightsQuery } from '@/entities/highlight';
import {
  isFinalStatus,
  projectApi,
  useGetProjectQuery,
  useGetProjectStatusQuery,
} from '@/entities/project';
import { getErrorMessage } from '@/shared/api';
import { routes } from '@/shared/config';
import { formatBytes, formatTimecode } from '@/shared/lib';
import { ButtonLink, DemoApiNotice, Notice, PixelHeading } from '@/shared/ui';
import { SiteHeader } from '@/widgets/site-header';

import { HighlightsWorkspace } from './HighlightsWorkspace';
import { ProcessingStatus } from './ProcessingStatus';
import { StartProcessing } from './StartProcessing';

import styles from './ProjectPage.module.css';

const POLL_MS = 1500;

export function ProjectPage() {
  const { projectId = '' } = useParams();

  // Статус читаем из кеша до подписки: опрашиваем, только пока идёт обработка
  const cachedStatus = projectApi.endpoints.getProjectStatus.useQueryState(projectId).data;
  const stopPolling = cachedStatus ? cachedStatus.status !== 'processing' : false;
  const { data: status, error: statusError } = useGetProjectStatusQuery(projectId, {
    pollingInterval: stopPolling ? 0 : POLL_MS,
    skipPollingIfUnfocused: true,
  });
  const final = status ? isFinalStatus(status.status) : false;

  const {
    data: project,
    error: projectError,
    isLoading,
    refetch: refetchProject,
  } = useGetProjectQuery(projectId);

  // Когда обработка закончилась, у проекта обновляются статус и метаданные
  useEffect(() => {
    if (final) void refetchProject();
  }, [final, refetchProject]);
  const completed = status?.status === 'completed';
  const {
    data: highlights,
    error: highlightsError,
    isLoading: highlightsLoading,
  } = useGetProjectHighlightsQuery(projectId, { skip: !completed });

  const error = projectError ?? statusError;

  if (error) {
    return (
      <Shell>
        <Notice
          tone="error"
          title="Не удалось открыть проект"
          action={
            <ButtonLink to={routes.upload} variant="secondary" size="sm">
              Загрузить видео
            </ButtonLink>
          }
        >
          {getErrorMessage(error)}
        </Notice>
      </Shell>
    );
  }

  if (isLoading || !project || !status) {
    return (
      <Shell>
        <p className={styles.loading} role="status">
          Открываем проект…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={styles.head}>
        <PixelHeading as="h1" size="md" className={styles.title}>
          {project.title}
        </PixelHeading>
        <p className={styles.meta}>
          {[
            project.original_filename,
            project.file_size !== null && formatBytes(project.file_size),
            project.duration !== null && formatTimecode(project.duration),
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>

      <DemoApiNotice />

      {status.status === 'created' && (
        <Notice
          title="В проект ещё не загружено видео"
          action={
            <ButtonLink to={routes.upload} variant="secondary" size="sm">
              Загрузить видео
            </ButtonLink>
          }
        >
          Создайте проект заново на странице загрузки и прикрепите запись
        </Notice>
      )}

      {status.status === 'uploaded' && <StartProcessing projectId={project.id} />}

      {status.status === 'processing' && (
        <ProcessingStatus status={status.status} stage={status.stage} />
      )}

      {status.status === 'failed' && (
        <Notice
          tone="error"
          title="Обработка остановилась"
          action={
            <ButtonLink to={routes.upload} variant="secondary" size="sm">
              Загрузить заново
            </ButtonLink>
          }
        >
          {status.error ?? 'Сервер не смог обработать запись. Попробуйте загрузить её ещё раз'}
        </Notice>
      )}

      {status.status === 'no_highlights' && <EmptyResult />}

      {completed && highlightsLoading && (
        <p className={styles.loading} role="status">
          Загружаем моменты…
        </p>
      )}

      {completed && highlightsError && (
        <Notice tone="error" title="Не удалось получить моменты">
          {getErrorMessage(highlightsError)}
        </Notice>
      )}

      {completed &&
        highlights &&
        (highlights.items.length > 0 ? (
          <HighlightsWorkspace
            project={project}
            highlights={highlights.items}
            minScore={highlights.min_score}
          />
        ) : (
          <EmptyResult />
        ))}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>{children}</main>
    </>
  );
}

function EmptyResult() {
  return (
    <section className={styles.empty} aria-labelledby="empty-title">
      <PixelHeading id="empty-title" size="lg">
        Пусто
      </PixelHeading>
      <p className={styles.emptyText}>
        В этой записи не нашлось моментов выше порога интересности. Мы не придумываем хайлайты ради
        списка: попробуйте запись подлиннее или с более живыми эмоциями.
      </p>
      <ButtonLink to={routes.upload}>Загрузить другую запись</ButtonLink>
    </section>
  );
}
