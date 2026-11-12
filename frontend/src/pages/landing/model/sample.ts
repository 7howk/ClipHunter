import type { HighlightDto } from '@/shared/api';

/** Пример ответа API для трёхчасового стрима. Только для иллюстрации на лендинге. */
export const SAMPLE_FILE = { name: 'stream-2026-11-08.mkv', duration: 11_560 };

const base = { project_id: 'sample' } as const;

export const SAMPLE_HIGHLIGHTS: HighlightDto[] = [
  {
    ...base,
    id: 's1',
    start_time: 10_268,
    end_time: 10_312,
    score: 94,
    category: 'climax',
    title: 'Финальный раунд',
    description: 'Последние секунды матча: один против трёх, и раунд вытащен',
    reason: 'Кульминация сессии: крик, пауза и победа в одном фрагменте',
  },
  {
    ...base,
    id: 's2',
    start_time: 4_350,
    end_time: 4_385,
    score: 91,
    category: 'surprise',
    title: 'Неожиданный поворот',
    description: 'Игрок неожиданно выигрывает раунд',
    reason: 'Эмоциональная реакция и неожиданный исход',
  },
  {
    ...base,
    id: 's3',
    start_time: 1_452,
    end_time: 1_480,
    score: 86,
    category: 'funny',
    title: 'Чат угадал раньше стримера',
    description: 'Стример читает подсказку из чата и хохочет над собой',
    reason: 'Шутка и реакция укладываются в полминуты',
  },
  {
    ...base,
    id: 's4',
    start_time: 7_541,
    end_time: 7_570,
    score: 78,
    category: 'reaction',
    title: 'Реакция на донат',
    description: 'Стример замолкает, а потом благодарит зрителя',
    reason: 'Яркая реакция, понятная без контекста',
  },
  {
    ...base,
    id: 's5',
    start_time: 6_422,
    end_time: 6_460,
    score: 71,
    category: 'tension',
    title: 'Один на один в последней зоне',
    description: 'Долгая пауза, шёпот и решающий выстрел',
    reason: 'Нарастающее напряжение с чёткой развязкой',
  },
];
