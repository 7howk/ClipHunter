import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { landingAnchors, routes } from '@/shared/config';
import { ButtonLink, Mascot } from '@/shared/ui';
import { SiteHeader } from '@/widgets/site-header';

import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <SiteHeader variant="inset" showUpload={false} />

      <div className={styles.copy}>
        <h1 id="hero-title" className={styles.headline}>
          <span className="visually-hidden">ClipHunter. </span>
          Привет,
          <br />я Бобби
        </h1>

        <div className={styles.lower}>
          <p className={styles.lead}>
            Я маскот ClipHunter. Пересматриваю за тебя многочасовые стримы и игровые сессии, нахожу
            смешные, эмоциональные и неожиданные моменты и отдаю их с таймкодами. Остаётся выбрать
            лучшие для Shorts, TikTok или клипов.
          </p>
          <div className={styles.actions}>
            <ButtonLink to={routes.upload}>Загрузить видео</ButtonLink>
            <Link to={{ hash: landingAnchors.how }} className={styles.secondary}>
              Как это работает
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.visual}>
        <Mascot className={styles.canvas} anchorX={0.56} />
      </div>
    </section>
  );
}
