import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useDeleteProjectMutation } from '@/entities/project';
import { getErrorMessage } from '@/shared/api';
import { routes } from '@/shared/config';
import { Button, Notice } from '@/shared/ui';

import styles from './DeleteProjectButton.module.css';

/** Удаление проекта в два шага: backend стирает и видео, и клипы без возможности вернуть. */
export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [deleteProject, { isLoading, error, reset }] = useDeleteProjectMutation();
  const [confirming, setConfirming] = useState(false);

  const onConfirm = async () => {
    const result = await deleteProject(projectId);
    // 404: проект уже удалили, например в другой вкладке — результат тот же
    const gone = result.error && 'status' in result.error && result.error.status === 404;
    if (!result.error || gone) void navigate(routes.upload);
  };

  if (!confirming) {
    return (
      <Button variant="text" size="sm" icon={<Trash2 />} onClick={() => setConfirming(true)}>
        Удалить проект
      </Button>
    );
  }

  return (
    <div className={styles.confirm} role="group" aria-label="Подтверждение удаления">
      <p className={styles.question}>
        Удалить проект вместе с видео и клипами? Вернуть не получится
      </p>
      <Button size="sm" onClick={() => void onConfirm()} loading={isLoading} autoFocus>
        Удалить
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={isLoading}
        onClick={() => {
          reset();
          setConfirming(false);
        }}
      >
        Отмена
      </Button>
      {error && (
        <div className={styles.error}>
          <Notice tone="error" title="Не удалось удалить проект">
            {getErrorMessage(error)}
          </Notice>
        </div>
      )}
    </div>
  );
}
