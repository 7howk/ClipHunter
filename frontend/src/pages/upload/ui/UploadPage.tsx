import { UploadVideoForm } from '@/features/upload-video';
import { DemoApiNotice, PixelHeading } from '@/shared/ui';
import { SiteHeader } from '@/widgets/site-header';

import { RecentProjects } from './RecentProjects';
import styles from './UploadPage.module.css';

const AFTER = [
  'Звук извлекается и расшифровывается с таймкодами',
  'Каждый фрагмент получает оценку интересности от 0 до 100',
  'Моменты выше порога появляются списком, лучшие сверху',
  'Ты отмечаешь нужные, и ClipHunter нарезает клипы',
] as const;

export function UploadPage() {
  return (
    <>
      <SiteHeader showUpload={false} />
      <main className={styles.page}>
        <div className={styles.main}>
          <PixelHeading as="h1" size="lg">
            Загрузка видео
          </PixelHeading>
          <p className={styles.lead}>
            Подойдёт запись стрима, игровой сессии или подкаста. Чем больше в ней живой речи, тем
            точнее Бобби найдёт моменты.
          </p>
          <DemoApiNotice />
          <UploadVideoForm />
        </div>

        <aside className={styles.aside} aria-labelledby="after-title">
          <h2 id="after-title" className={styles.asideTitle}>
            Что будет после загрузки
          </h2>
          <ol className={styles.after}>
            {AFTER.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
          <RecentProjects />
        </aside>
      </main>
    </>
  );
}
