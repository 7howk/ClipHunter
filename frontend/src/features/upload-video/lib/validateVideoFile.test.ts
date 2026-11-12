import { describe, expect, it } from 'vitest';

import { titleFromFileName, validateVideoFile } from './validateVideoFile';

const makeFile = (name: string, type: string, size = 1024) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('validateVideoFile', () => {
  it('пропускает поддерживаемое видео', () => {
    expect(validateVideoFile(makeFile('stream.mp4', 'video/mp4'))).toBeNull();
  });

  it('пропускает mkv без MIME-типа — решает расширение', () => {
    expect(validateVideoFile(makeFile('stream.mkv', ''))).toBeNull();
  });

  it('отклоняет чужое расширение', () => {
    expect(validateVideoFile(makeFile('notes.txt', 'text/plain'))).toMatch(
      /\.txt не поддерживается/,
    );
  });

  it('отклоняет подменённый MIME-тип', () => {
    expect(validateVideoFile(makeFile('fake.mp4', 'application/pdf'))).toMatch(/не похож на видео/);
  });

  it('отклоняет пустой файл', () => {
    expect(validateVideoFile(makeFile('empty.mp4', 'video/mp4', 0))).toMatch(/пустой/);
  });

  it('отклоняет файл больше лимита', () => {
    const big = makeFile('big.mp4', 'video/mp4', 11 * 1024 * 1024);
    expect(validateVideoFile(big, { maxSizeMb: 10 })).toMatch(/лимит — 10 МБ/);
  });
});

describe('titleFromFileName', () => {
  it('убирает расширение и разделители', () => {
    expect(titleFromFileName('stream_2026-11-08.mkv')).toBe('stream 2026 11 08');
  });
});
