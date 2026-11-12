import { Link } from 'react-router';

import { landingAnchors, routes } from '@/shared/config';
import { ButtonLink, Logo } from '@/shared/ui';

import styles from './SiteHeader.module.css';

const NAV = [
  { hash: landingAnchors.how, label: 'Как работает' },
  { hash: landingAnchors.result, label: 'Результат' },
  { hash: landingAnchors.principles, label: 'Принципы' },
] as const;

interface SiteHeaderProps {
  /** inset — внутри hero-карточки лендинга, page — сверху обычной страницы. */
  variant?: 'inset' | 'page';
  /** На странице загрузки кнопка «Загрузить видео» не нужна. */
  showUpload?: boolean;
}

export function SiteHeader({ variant = 'page', showUpload = true }: SiteHeaderProps) {
  return (
    <header className={styles.header} data-variant={variant}>
      <Link to={routes.home} className={styles.home} aria-label="ClipHunter, на главную">
        <Logo />
      </Link>
      <nav className={styles.nav} aria-label="Разделы">
        {NAV.map((item) => (
          <Link
            key={item.hash}
            to={{ pathname: routes.home, hash: item.hash }}
            className={styles.link}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {showUpload && (
        <ButtonLink to={routes.upload} size="sm" className={styles.cta}>
          Загрузить видео
        </ButtonLink>
      )}
    </header>
  );
}
