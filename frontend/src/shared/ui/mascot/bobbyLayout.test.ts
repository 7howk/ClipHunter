import { describe, expect, it } from 'vitest';

import { MASCOT_BOUNDS, placeMascot } from './bobbyLayout';

const WIDTHS = [240, 320, 358, 480, 700, 827, 861, 1100, 1370, 1700, 2400];
const HEIGHTS = [200, 269, 352, 500, 696, 796, 808, 1080];

function bounds(width: number, height: number, anchorX = 0.56) {
  const { scale, x, y } = placeMascot(width, height, anchorX);
  return {
    scale,
    left: x + MASCOT_BOUNDS.left * scale,
    right: x + MASCOT_BOUNDS.right * scale,
    top: y + MASCOT_BOUNDS.top * scale,
    bottom: y + MASCOT_BOUNDS.bottom * scale,
  };
}

describe('placeMascot', () => {
  it('держит фигуру целиком в кадре на любой сетке размеров', () => {
    for (const w of WIDTHS) {
      for (const h of HEIGHTS) {
        const b = bounds(w, h);
        expect(b.left, `${w}x${h}`).toBeGreaterThanOrEqual(-0.5);
        expect(b.right, `${w}x${h}`).toBeLessThanOrEqual(w + 0.5);
        expect(b.top, `${w}x${h}`).toBeGreaterThanOrEqual(-0.5);
        expect(b.bottom, `${w}x${h}`).toBeLessThanOrEqual(h + 0.5);
      }
    }
  });

  it('меняет масштаб непрерывно: соседние размеры дают близкий результат', () => {
    for (const h of [500, 800, 1080]) {
      for (let w = 320; w < 2560; w += 1) {
        const a = bounds(w, h);
        const b = bounds(w + 1, h);
        expect(Math.abs(b.scale - a.scale) / a.scale).toBeLessThan(0.01);
        expect(Math.abs(b.left - a.left)).toBeLessThan(3);
      }
    }
  });

  it('ставит центр фигуры в anchorX, пока хватает места', () => {
    const b = bounds(2000, 800, 0.56);
    expect((b.left + b.right) / 2).toBeCloseTo(2000 * 0.56, 0);
  });
});
