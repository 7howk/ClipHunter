import type { ReactNode } from 'react';

import styles from './CaptureFrame.module.css';

interface CaptureFrameProps {
  /** Уголки видны только у «пойманного» фрагмента. */
  active: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Фирменная деталь ClipHunter — уголки рамки захвата, как в видоискателе.
 * Ставится только на выбранный или лучший фрагмент, нигде больше.
 */
export function CaptureFrame({ active, children, className }: CaptureFrameProps) {
  return (
    <div className={[styles.frame, className].filter(Boolean).join(' ')} data-active={active}>
      {children}
      <span className={styles.corners} aria-hidden="true" />
    </div>
  );
}
