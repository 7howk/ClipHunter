/**
 * Бобби — маскот ClipHunter: кинокамера на ножках, бобины вместо ушей,
 * объектив вместо носа и плёнка вместо хвоста. Рисуется в градациях серого:
 * шейдер превращает яркость в толщину сканлайнов (светлое — тонкие линии,
 * чёрное — сплошные блоки), поэтому вся форма передаётся тоном.
 *
 * Почему сцена собирается из закешированных слоёв. Толщина сканлайна —
 * пороговая функция яркости, и даже колебание на 1–2 уровня из 255 заставляет
 * тонкие линии то появляться, то пропадать: картинка «скачет». Поэтому всё
 * неподвижное (фон, корпус, лапки, объектив) рисуется один раз, а каждый кадр
 * копируется побайтно. Заново рисуется только то, что действительно движется:
 * бобины, хвост, моргание и лампочка записи.
 */

import { placeMascot } from './bobbyLayout';

export interface SceneOptions {
  /** Горизонтальная позиция центра маскота, доля ширины. */
  anchorX: number;
  /** Тёмное «небо» в правом верхнем углу, как фон в референсе. */
  backdrop: boolean;
}

export interface BobbyScene {
  /** Рисует кадр сцены в момент t (секунды) на холст того же размера. */
  draw(ctx: CanvasRenderingContext2D, t: number): void;
}

const TAU = Math.PI * 2;

type Ctx = CanvasRenderingContext2D;

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function reelFace(ctx: Ctx, cx: number, cy: number, r: number) {
  const face = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  face.addColorStop(0, '#d8d8d8');
  face.addColorStop(1, '#8e8e8e');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();
}

function reelHoles(ctx: Ctx, cx: number, cy: number, r: number, angle: number) {
  ctx.fillStyle = '#0a0a0a';
  for (let i = 0; i < 3; i++) {
    const a = angle + (i / 3) * TAU;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52, r * 0.22, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, TAU);
  ctx.fill();
}

function leg(ctx: Ctx, x: number) {
  ctx.fillStyle = '#7c7c7c';
  roundedRect(ctx, x - 13, 70, 26, 70, 10);
  ctx.fill();
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.ellipse(x - 4, 140, 30, 14, 0, 0, TAU);
  ctx.fill();
}

const REELS = [
  { x: -64, y: -150, r: 58, speed: 0.45 },
  { x: 62, y: -170, r: 68, speed: -0.38 },
] as const;

const EYES = [-104, -44] as const;

/** Фон: белый лист, тёмное «небо» и тень на полу. */
function paintBackground(ctx: Ctx, width: number, height: number, options: SceneOptions) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  if (!options.backdrop) return;
  const sky = ctx.createLinearGradient(width, 0, width * 0.45, height * 0.75);
  // Плотные строки без шумных полутонов; рваный край только у границы
  sky.addColorStop(0, 'rgb(100,100,100)');
  sky.addColorStop(0.4, 'rgb(132,132,132)');
  sky.addColorStop(0.62, 'rgba(255,255,255,0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function paintShadow(ctx: Ctx) {
  const shadow = ctx.createRadialGradient(0, 150, 10, 0, 150, 210);
  shadow.addColorStop(0, 'rgba(0,0,0,0.35)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(10, 150, 210, 26, 0, 0, TAU);
  ctx.fill();
}

/** Всё неподвижное позади хвоста и бобин: лапки и стойки бобин. */
function paintStaticBack(ctx: Ctx) {
  for (const x of [-96, -40, 52, 106]) leg(ctx, x);
  ctx.fillStyle = '#5a5a5a';
  roundedRect(ctx, -72, -120, 16, 60, 6);
  ctx.fill();
  roundedRect(ctx, 54, -132, 16, 72, 6);
  ctx.fill();
  for (const reel of REELS) reelFace(ctx, reel.x, reel.y, reel.r);
}

/** Всё неподвижное впереди: корпус, полоса, объектив. */
function paintStaticFront(ctx: Ctx) {
  const body = ctx.createLinearGradient(-150, -70, 120, 110);
  body.addColorStop(0, '#b4b4b4');
  body.addColorStop(0.6, '#8e8e8e');
  body.addColorStop(1, '#5e5e5e');
  ctx.fillStyle = body;
  roundedRect(ctx, -150, -72, 300, 160, 34);
  ctx.fill();
  // Контур: светлые тона шейдер оставляет пустыми, форму держит он
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#1c1c1c';
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundedRect(ctx, -136, 52, 272, 22, 11);
  ctx.fill();

  const lens = ctx.createLinearGradient(-230, -40, -150, 40);
  lens.addColorStop(0, '#3e3e3e');
  lens.addColorStop(1, '#8a8a8a');
  ctx.fillStyle = lens;
  roundedRect(ctx, -214, -34, 74, 70, 14);
  ctx.fill();
  ctx.fillStyle = '#060606';
  ctx.beginPath();
  ctx.ellipse(-214, 1, 18, 44, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-218, -16, 4, 9, 0, 0, TAU);
  ctx.fill();
}

/** Хвост из плёнки виляет медленно, перфорация бежит по нему. */
function paintTail(ctx: Ctx, t: number) {
  const wag = Math.sin(t * TAU * 0.35) * 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(140, 10);
  ctx.bezierCurveTo(220, 0, 230 + wag, -90, 200 + wag * 1.6, -150);
  ctx.stroke();
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 8;
  ctx.setLineDash([7, 12]);
  ctx.lineDashOffset = -t * 60;
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintFace(ctx: Ctx, t: number) {
  const cycle = t % 4.2;
  const open = cycle <= 3.95;
  for (const x of EYES) {
    ctx.fillStyle = '#030303';
    ctx.beginPath();
    ctx.ellipse(x, -18, 15, open ? 19 : 2.5, 0, 0, TAU);
    ctx.fill();
    if (open) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 5, -26, 5, 0, TAU);
      ctx.fill();
    }
  }
  // Лампочка записи: в сканлайнах читается как тёмная точка, мигает раз в секунду
  ctx.fillStyle = cycle % 1 < 0.6 ? '#2b2b2b' : '#9a9a9a';
  ctx.beginPath();
  ctx.arc(104, -40, 10, 0, TAU);
  ctx.fill();
}

function layer(width: number, height: number, paint: (ctx: Ctx) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx);
  return canvas;
}

/** Готовит слои сцены под размер холста. Пересоздаётся только при ресайзе. */
export function createBobbyScene(width: number, height: number, options: SceneOptions): BobbyScene {
  const { scale, x, y } = placeMascot(width, height, options.anchorX);
  const toMascot = (ctx: Ctx) => {
    ctx.setTransform(scale, 0, 0, scale, x, y);
  };

  const back = layer(width, height, (ctx) => {
    paintBackground(ctx, width, height, options);
    toMascot(ctx);
    paintShadow(ctx);
    paintStaticBack(ctx);
  });
  const front = layer(width, height, (ctx) => {
    toMascot(ctx);
    paintStaticFront(ctx);
  });

  return {
    draw(ctx, t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(back, 0, 0);
      toMascot(ctx);
      paintTail(ctx, t);
      for (const reel of REELS) reelHoles(ctx, reel.x, reel.y, reel.r, t * TAU * reel.speed);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(front, 0, 0);
      toMascot(ctx);
      paintFace(ctx, t);
    },
  };
}
