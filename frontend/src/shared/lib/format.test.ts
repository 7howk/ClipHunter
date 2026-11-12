import { describe, expect, it } from 'vitest';

import { formatBytes, formatSpan, formatTimecode, plural } from './format';

describe('formatTimecode', () => {
  it('форматирует минуты и часы', () => {
    expect(formatTimecode(0)).toBe('0:00');
    expect(formatTimecode(75.9)).toBe('1:15');
    expect(formatTimecode(3725)).toBe('1:02:05');
  });

  it('не уходит в отрицательные значения', () => {
    expect(formatTimecode(-5)).toBe('0:00');
  });
});

describe('formatSpan', () => {
  it('пишет длину фрагмента по-русски', () => {
    expect(formatSpan(38)).toBe('38 с');
    expect(formatSpan(72)).toBe('1 мин 12 с');
    expect(formatSpan(120)).toBe('2 мин');
  });
});

describe('formatBytes', () => {
  it('выбирает единицу и запятую как разделитель', () => {
    expect(formatBytes(512)).toBe('512 Б');
    expect(formatBytes(1536)).toBe('1,5 КБ');
    expect(formatBytes(500 * 1024 * 1024)).toBe('500 МБ');
  });
});

describe('plural', () => {
  const forms = ['клип', 'клипа', 'клипов'] as const;

  it.each([
    [1, 'клип'],
    [3, 'клипа'],
    [5, 'клипов'],
    [11, 'клипов'],
    [21, 'клип'],
    [24, 'клипа'],
  ])('%i → %s', (count, expected) => {
    expect(plural(count, forms)).toBe(expected);
  });
});
