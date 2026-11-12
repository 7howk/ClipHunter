import { ApiStatus } from '@/entities/system';
import { REPOSITORY_URL } from '@/shared/config';
import { Logo } from '@/shared/ui';

import styles from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>
        <Logo />
        <p className={styles.tagline}>Поиск лучших моментов в длинных видеозаписях</p>
      </div>
      <div className={styles.meta}>
        <ApiStatus />
        <a href={REPOSITORY_URL} className={styles.link} target="_blank" rel="noreferrer">
          Исходный код на GitHub
        </a>
      </div>
    </footer>
  );
}
