import { routes } from '@/shared/config';
import { ButtonLink, PixelHeading } from '@/shared/ui';

import styles from './ClosingCta.module.css';

export function ClosingCta() {
  return (
    <section className={styles.band} aria-labelledby="cta-title">
      <div className={styles.inner}>
        <PixelHeading id="cta-title" size="lg" className={styles.title}>
          Есть длинная запись?
        </PixelHeading>
        <p className={styles.text}>
          Загрузи её, и Бобби найдёт моменты, которые не стыдно выложить. Пока он работает, можно не
          пересматривать стрим самому.
        </p>
        <ButtonLink to={routes.upload} variant="secondary" className={styles.button}>
          Загрузить видео
        </ButtonLink>
      </div>
    </section>
  );
}
