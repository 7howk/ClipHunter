import { routes } from '@/shared/config';
import { ButtonLink, PixelHeading } from '@/shared/ui';
import { SiteHeader } from '@/widgets/site-header';

import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <PixelHeading as="h1" size="xl">
          404
        </PixelHeading>
        <p className={styles.text}>Такой страницы нет. Возможно, ссылка устарела.</p>
        <ButtonLink to={routes.home}>На главную</ButtonLink>
      </main>
    </>
  );
}
