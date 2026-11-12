import { describe, expect, it } from 'vitest';

import { placeMascot } from '@/shared/ui';

// Чтение CSS как текста: vitest отдаёт пустую строку для ?raw/?inline, а @types/node в проекте нет.
// Тесты запускаются из frontend/, поэтому путь считается от корня проекта.
const nodeFs = 'node:fs';
const { readFileSync } = (await import(/* @vite-ignore */ nodeFs)) as {
  readFileSync: (path: string, encoding: string) => string;
};
const css = readFileSync('src/pages/landing/ui/Hero.module.css', 'utf8');

/**
 * Кадр маскота считается из самого Hero.module.css, поэтому тест ловит скачок
 * размера фигуры на границах медиазапросов (860/861 и 1100/1101 px).
 */

/** Высота hero, которую задаёт контент на 861px и шире (замер в браузере при окне 600px: hero 575). */
const CONTENT_HEIGHT = 575;
const FRAME = 16;

function number(match: RegExpMatchArray | null, index = 1) {
  if (!match?.[index]) throw new Error('Hero.module.css изменился: тест нужно обновить');
  return Number(match[index]);
}

const baseLeft = number(css.match(/inset:\s*72px 0 0 (\d+)%/)) / 100;
const midLeft = css.match(/max-width: 1100px\)\s*{[^}]*left:\s*calc\((\d+)% \+ (\d+)px\)/);
const mobile = css.match(
  /max-width: 860px\)\s*{[\s\S]*?aspect-ratio:\s*(\d+) \/ (\d+)[\s\S]*?max-height:\s*(\d+)px/,
);

function frame(vw: number, vh: number) {
  const heroWidth = vw - FRAME * 2;
  if (vw <= 860) {
    const width = heroWidth;
    const height = Math.min((width * number(mobile, 2)) / number(mobile, 1), number(mobile, 3));
    return { width, height };
  }
  const heroHeight = Math.max(Math.min(vh - FRAME * 2, 880), CONTENT_HEIGHT);
  const left =
    vw <= 1100 ? (number(midLeft) / 100) * heroWidth + number(midLeft, 2) : baseLeft * heroWidth;
  return { width: heroWidth - left, height: heroHeight - 72 };
}

function scale(vw: number, vh: number) {
  const { width, height } = frame(vw, vh);
  return placeMascot(width, height, 0.56).scale;
}

describe('масштаб маскота на границах медиазапросов', () => {
  for (const vh of [600, 800, 1080]) {
    it(`860/861px при высоте окна ${vh}`, () => {
      expect(Math.abs(scale(861, vh) / scale(860, vh) - 1)).toBeLessThan(0.05);
    });

    it(`1100/1101px при высоте окна ${vh}`, () => {
      expect(Math.abs(scale(1101, vh) / scale(1100, vh) - 1)).toBeLessThan(0.05);
    });
  }
});
