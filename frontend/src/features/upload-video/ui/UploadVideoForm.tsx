import { FileVideo, Upload, X } from 'lucide-react';
import { useId, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import {
  ALLOWED_VIDEO_EXTENSIONS,
  MAX_UPLOAD_SIZE_MB,
  MAX_VIDEO_DURATION_SECONDS,
  routes,
} from '@/shared/config';
import { formatBytes, formatTimecode, useObjectUrl } from '@/shared/lib';
import { Button, Notice } from '@/shared/ui';

import {
  titleFromFileName,
  validateVideoDuration,
  validateVideoFile,
} from '../lib/validateVideoFile';
import { UPLOAD_STAGE_LABELS, useUploadVideo } from '../model/useUploadVideo';

import styles from './UploadVideoForm.module.css';

const ACCEPT = ALLOWED_VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(',') + ',video/*';

export function UploadVideoForm() {
  const navigate = useNavigate();
  const inputId = useId();
  const titleId = useId();
  const { run, stage, error, busy } = useUploadVideo();

  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const previewUrl = useObjectUrl(file);

  const pick = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = validateVideoFile(candidate);
    setFileError(problem);
    if (problem) return;
    setFile(candidate);
    setDuration(null);
    setTitle((current) => current || titleFromFileName(candidate.name));
  };

  const clear = () => {
    setFile(null);
    setDuration(null);
    setTitle('');
    setFileError(null);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || busy) return;
    const projectId = await run({ file, title: title.trim() || titleFromFileName(file.name) });
    if (projectId) navigate(routes.project(projectId));
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {!file ? (
        <label
          htmlFor={inputId}
          className={styles.dropzone}
          data-dragging={dragging}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Upload className={styles.dropIcon} aria-hidden="true" />
          <span className={styles.dropTitle}>Перетащите запись сюда или выберите файл</span>
          <span className={styles.dropHint}>
            {ALLOWED_VIDEO_EXTENSIONS.join(', ')} до {MAX_UPLOAD_SIZE_MB} МБ и не длиннее{' '}
            {Math.round(MAX_VIDEO_DURATION_SECONDS / 60)} минут
          </span>
          <input
            id={inputId}
            className="visually-hidden"
            type="file"
            accept={ACCEPT}
            onChange={(event) => pick(event.target.files?.[0])}
            aria-describedby={fileError ? `${inputId}-error` : undefined}
          />
        </label>
      ) : (
        <div className={styles.picked}>
          {previewUrl && (
            <video
              className={styles.preview}
              src={previewUrl}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => {
                const seconds = event.currentTarget.duration;
                setDuration(seconds);
                setFileError(validateVideoDuration(seconds));
              }}
            />
          )}
          <div className={styles.pickedInfo}>
            <p className={styles.fileName}>
              <FileVideo aria-hidden="true" />
              <span>{file.name}</span>
            </p>
            <p className={styles.fileMeta}>
              {formatBytes(file.size)}
              {duration !== null && Number.isFinite(duration) && `, ${formatTimecode(duration)}`}
            </p>
          </div>
          <Button variant="text" size="sm" icon={<X />} onClick={clear} disabled={busy}>
            Другой файл
          </Button>
        </div>
      )}

      {fileError && (
        <p id={`${inputId}-error`} className={styles.fieldError} role="alert">
          {fileError}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor={titleId} className={styles.label}>
          Название проекта
        </label>
        <input
          id={titleId}
          className={styles.input}
          value={title}
          maxLength={120}
          placeholder="Например, стрим от 8 ноября"
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
        />
      </div>

      {error && (
        <Notice tone="error" title="Не удалось загрузить видео">
          {error}
        </Notice>
      )}

      <div className={styles.submitRow}>
        <Button type="submit" disabled={!file || Boolean(fileError)} loading={busy}>
          Найти лучшие моменты
        </Button>
        <span className={styles.stage} aria-live="polite">
          {busy && stage !== 'idle' && stage !== 'error' ? `${UPLOAD_STAGE_LABELS[stage]}…` : ''}
        </span>
      </div>
    </form>
  );
}
