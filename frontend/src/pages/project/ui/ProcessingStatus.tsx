import { Check } from 'lucide-react';

import { PIPELINE_STEPS, getPipelineStepIndex } from '@/entities/project';
import type { ProcessingStage, ProjectStatus } from '@/shared/api';
import { Mascot } from '@/shared/ui';

import styles from './ProcessingStatus.module.css';

interface ProcessingStatusProps {
  status: ProjectStatus;
  stage?: ProcessingStage;
}

/** Пока идёт обработка: Бобби «работает», а рядом — этапы pipeline. */
export function ProcessingStatus({ status, stage }: ProcessingStatusProps) {
  const current = getPipelineStepIndex(status, stage);

  return (
    <section className={styles.panel} aria-labelledby="processing-title">
      <div className={styles.mascot}>
        <Mascot anchorX={0.5} backdrop={false} label="Бобби обрабатывает запись" />
      </div>
      <div className={styles.body}>
        <h2 id="processing-title" className={styles.title}>
          Бобби смотрит запись
        </h2>
        <p className={styles.hint}>
          Страницу можно не обновлять: статус проверяется сам, а длинный стрим обрабатывается
          несколько минут.
        </p>
        <ol className={styles.steps} aria-live="polite">
          {PIPELINE_STEPS.slice(0, -1).map((step, index) => {
            const state = index < current ? 'done' : index === current ? 'current' : 'next';
            return (
              <li key={step.id} className={styles.step} data-state={state}>
                <span className={styles.marker} aria-hidden="true">
                  {state === 'done' && <Check />}
                </span>
                <span className={styles.label}>
                  {step.label}
                  {state === 'current' && <span className="visually-hidden">, сейчас</span>}
                </span>
                <span className={styles.stepHint}>{step.hint}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
