import { landingAnchors } from '@/shared/config';
import { PixelHeading } from '@/shared/ui';

import styles from './HowItWorks.module.css';

const STEPS = [
  {
    title: 'Загружаешь запись',
    text: 'Стрим, игровая сессия или подкаст: mp4, mov, mkv или webm до 500 МБ и 30 минут',
  },
  {
    title: 'Бобби слушает',
    text: 'FFmpeg достаёт звук, а Whisper превращает речь в текст с точными таймкодами',
  },
  {
    title: 'Бобби оценивает',
    text: 'Языковая модель читает расшифровку и ставит каждому фрагменту оценку: юмор, эмоции, неожиданность, конфликт, кульминация',
  },
  {
    title: 'Ты выбираешь',
    text: 'Отмечаешь понравившиеся моменты, а ClipHunter нарезает клипы и даёт ссылки на скачивание',
  },
] as const;

export function HowItWorks() {
  return (
    <section id={landingAnchors.how} className={styles.section} aria-labelledby="how-title">
      <div className={styles.intro}>
        <PixelHeading id="how-title" size="lg">
          Как это работает
        </PixelHeading>
        <p className={styles.lead}>
          Вместо трёх часов перемотки — четыре шага. Ищет ClipHunter, а решаешь всё равно ты.
        </p>
      </div>

      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <h3 className={styles.title}>{step.title}</h3>
            <p className={styles.text}>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
