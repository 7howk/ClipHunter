import { landingAnchors } from '@/shared/config';
import { PixelHeading } from '@/shared/ui';

import styles from './Principles.module.css';

const PRINCIPLES = [
  {
    figure: '00:00',
    title: 'Таймкоды из расшифровки',
    text: 'Границы фрагмента берутся из распознанной речи. Модель не придумывает время сама, поэтому клип начинается там, где начинается момент',
  },
  {
    figure: '60',
    title: 'Порог интересности',
    text: 'Каждый фрагмент получает оценку от 0 до 100. Всё, что ниже порога, в список не попадает, и тебе не придётся листать проходные куски',
  },
  {
    figure: '0',
    title: 'Пусто — значит пусто',
    text: 'Если в записи нет ничего яркого, ClipHunter так и скажет. Никаких искусственных хайлайтов ради красивого списка',
  },
] as const;

export function Principles() {
  return (
    <section
      id={landingAnchors.principles}
      className={styles.section}
      aria-labelledby="principles-title"
    >
      <PixelHeading id="principles-title" size="lg">
        Честные хайлайты
      </PixelHeading>
      <ul className={styles.list}>
        {PRINCIPLES.map((item) => (
          <li key={item.title} className={styles.item}>
            <span className={styles.figure} aria-hidden="true">
              {item.figure}
            </span>
            <h3 className={styles.title}>{item.title}</h3>
            <p className={styles.text}>{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
