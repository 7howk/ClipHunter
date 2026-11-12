/**
 * Раскладка маскота в кадре. Одна непрерывная формула без порогов по
 * пропорциям: на любой ширине и высоте фигура целиком помещается в кадр и
 * плавно меняет масштаб, а не «перескакивает» при смене брейкпоинта.
 */

/** Габариты фигуры в единицах сцены: объектив, хвост, бобины, лапки и тень. */
export const MASCOT_BOUNDS = { left: -235, right: 255, top: -240, bottom: 176 } as const;

const FILL_HEIGHT = 0.8;
const FILL_WIDTH = 0.84;
const EDGE_PADDING = 0.03;

export interface MascotPlacement {
  scale: number;
  /** Положение начала координат сцены на холсте, пиксели. */
  x: number;
  y: number;
}

export function placeMascot(width: number, height: number, anchorX: number): MascotPlacement {
  const { left, right, top, bottom } = MASCOT_BOUNDS;
  const boundsWidth = right - left;
  const boundsHeight = bottom - top;
  const scale = Math.min((height * FILL_HEIGHT) / boundsHeight, (width * FILL_WIDTH) / boundsWidth);

  // Центр фигуры тянется к anchorX, но целиком остаётся внутри кадра
  const half = (boundsWidth * scale) / 2;
  const pad = width * EDGE_PADDING;
  const minCenter = pad + half;
  const maxCenter = width - pad - half;
  const wanted = width * anchorX;
  const center =
    minCenter > maxCenter ? width / 2 : Math.min(Math.max(wanted, minCenter), maxCenter);

  return {
    scale,
    x: center - ((left + right) / 2) * scale,
    y: height / 2 - ((top + bottom) / 2) * scale,
  };
}
