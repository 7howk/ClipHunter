import { Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { HighlightCard, HighlightTimeline } from '@/entities/highlight';
import { selectPreviewUrl, type LocalPreviewRootState } from '@/entities/project';
import { GenerateClipsBar, RequestedClipsList } from '@/features/generate-clips';
import {
  SelectHighlightToggle,
  selectSelectedHighlightIds,
  type HighlightSelectionRootState,
} from '@/features/select-highlights';
import type { HighlightDto, VideoProjectDto } from '@/shared/api';
import { plural } from '@/shared/lib';
import { Button } from '@/shared/ui';

import styles from './HighlightsWorkspace.module.css';

type State = LocalPreviewRootState & HighlightSelectionRootState;

interface HighlightsWorkspaceProps {
  project: VideoProjectDto;
  highlights: readonly HighlightDto[];
  minScore: number;
}

export function HighlightsWorkspace({ project, highlights, minScore }: HighlightsWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentEnd = useRef<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(highlights[0]?.id ?? null);
  const [currentTime, setCurrentTime] = useState(0);

  const previewUrl = useSelector((state: State) => selectPreviewUrl(state, project.id));
  const selectedIds = useSelector((state: State) => selectSelectedHighlightIds(state, project.id));
  const duration = project.duration ?? Math.max(...highlights.map((item) => item.end_time), 1);

  const playSegment = (highlight: HighlightDto) => {
    setActiveId(highlight.id);
    const video = videoRef.current;
    if (!video) return;
    segmentEnd.current = highlight.end_time;
    video.currentTime = highlight.start_time;
    void video.play().catch(() => undefined);
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (segmentEnd.current !== null && video.currentTime >= segmentEnd.current) {
      video.pause();
      segmentEnd.current = null;
    }
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.viewer}>
        <div className={styles.sticky}>
          {previewUrl ? (
            <video
              ref={videoRef}
              className={styles.video}
              src={previewUrl}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={onTimeUpdate}
            />
          ) : (
            <div className={styles.noPreview}>
              <p>Превью доступно во вкладке, из которой загружали видео.</p>
              <p className={styles.noPreviewHint}>Таймкоды и нарезка работают и без него</p>
            </div>
          )}
          <HighlightTimeline
            duration={duration}
            highlights={highlights}
            activeId={activeId}
            currentTime={previewUrl ? currentTime : undefined}
            onSelect={playSegment}
          />
          <p className={styles.legend}>
            {highlights.length} {plural(highlights.length, ['момент', 'момента', 'моментов'])} с
            оценкой от {minScore}. Нажмите на отрезок, чтобы посмотреть его
          </p>
        </div>
      </div>

      <div className={styles.side}>
        <ol className={styles.list} aria-label="Найденные моменты, лучшие сверху">
          {highlights.map((highlight, index) => (
            <li key={highlight.id}>
              <HighlightCard
                highlight={highlight}
                rank={index + 1}
                active={highlight.id === activeId}
                actions={
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Play />}
                      onClick={() => playSegment(highlight)}
                      disabled={!previewUrl}
                    >
                      Смотреть
                    </Button>
                    <SelectHighlightToggle projectId={project.id} highlightId={highlight.id} />
                  </>
                }
              />
            </li>
          ))}
        </ol>

        <div className={styles.bar}>
          <GenerateClipsBar
            projectId={project.id}
            selectedIds={selectedIds}
            total={highlights.length}
          />
        </div>

        <RequestedClipsList projectId={project.id} highlights={highlights} />
      </div>
    </div>
  );
}
