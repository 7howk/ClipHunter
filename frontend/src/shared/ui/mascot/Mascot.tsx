import { useEffect, useRef } from 'react';

import {
  createScanlineRenderer,
  getRowPx,
  getScanlineGrid,
} from '../../lib/scanline/scanlineRenderer';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';

import { createBobbyScene, type BobbyScene, type SceneOptions } from './bobbyScene';
import styles from './Mascot.module.css';

const FPS = 12;
const MAX_DPR = 3;

interface MascotProps extends Partial<SceneOptions> {
  className?: string;
  /** Подпись для скринридеров. */
  label?: string;
}

/**
 * Бобби, нарисованный WebGL-сканлайнами. Время дискретизировано: 12 шагов в
 * секунду на ровной сетке, независимо от частоты экрана; стоит на паузе вне экрана и при reduced motion.
 */
export function Mascot({
  className,
  label = 'Бобби, маскот ClipHunter: кинокамера на ножках с бобинами вместо ушей',
  anchorX = 0.55,
  backdrop = true,
}: MascotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const source = document.createElement('canvas');
    const maybeCtx = source.getContext('2d');
    if (!maybeCtx) return;
    const sourceCtx: CanvasRenderingContext2D = maybeCtx;

    const options: SceneOptions = { anchorX, backdrop };

    /**
     * Холст создаётся заново на каждый запуск: контекст WebGL нельзя вернуть
     * холсту, на котором он уже был потерян или заменён на 2D, а StrictMode и
     * смена пропсов перезапускают эффект на том же элементе.
     */
    const start = (useWebgl: boolean, onFatal: () => void): (() => void) => {
      const canvas = document.createElement('canvas');
      canvas.className = styles.canvas ?? '';
      canvas.setAttribute('aria-hidden', 'true');
      host.replaceChildren(canvas);

      let scene: BobbyScene | null = null;
      let width = 0;
      let height = 0;
      let frame = 0;
      let step = -1;
      let visible = true;
      let live = true;
      const startedAt = performance.now();
      const stepAt = (now: number) => Math.floor(((now - startedAt) * FPS) / 1000);

      const renderer = useWebgl
        ? createScanlineRenderer(canvas, {
            onRestored: () => paint(step),
            onFatal: () => {
              if (live) onFatal();
            },
          })
        : null;
      let fallbackCtx: CanvasRenderingContext2D | null = null;
      let target = canvas;
      if (!renderer) {
        // Если WebGL успел занять холст, 2D-контекст возможен только на новом
        fallbackCtx = canvas.getContext('2d');
        if (!fallbackCtx) {
          target = document.createElement('canvas');
          target.className = canvas.className;
          target.setAttribute('aria-hidden', 'true');
          host.replaceChildren(target);
          fallbackCtx = target.getContext('2d');
        }
      }

      function paint(index: number) {
        if (!width || !height) return;
        step = index;
        // Время кратно шагу сетки: движение не зависит от того, в какой vsync попал кадр
        const t = reducedMotion ? 1.2 : index / FPS;
        scene?.draw(sourceCtx, t);
        if (renderer) {
          renderer.render(source);
        } else if (fallbackCtx) {
          fallbackCtx.drawImage(source, 0, 0, target.width, target.height);
        }
      }

      const resize = (entry?: ResizeObserverEntry) => {
        const dpr = window.devicePixelRatio || 1;
        // Точный размер в пикселях устройства: иначе браузер растягивает холст и линии мылятся
        const rect = target.getBoundingClientRect();
        const box = entry?.devicePixelContentBoxSize?.[0];
        // Верим точному размеру, только если он согласуется с CSS-размером и dpr
        const trusted =
          box &&
          dpr <= MAX_DPR &&
          Math.abs(box.inlineSize - rect.width * dpr) <= 2 &&
          Math.abs(box.blockSize - rect.height * dpr) <= 2;
        if (box && trusted) {
          width = Math.max(1, Math.round(box.inlineSize));
          height = Math.max(1, Math.round(box.blockSize));
        } else {
          const scale = Math.min(dpr, MAX_DPR);
          width = Math.max(1, Math.round(rect.width * scale));
          height = Math.max(1, Math.round(rect.height * scale));
        }
        const rowPx = getRowPx(Math.min(dpr, MAX_DPR));
        // Источник — один тексель на ячейку сетки; без WebGL рисуем в размер холста
        const grid = renderer ? getScanlineGrid(width, height, rowPx) : { width, height };
        source.width = grid.width;
        source.height = grid.height;
        scene = createBobbyScene(source.width, source.height, options);
        if (renderer) {
          renderer.resize(width, height, rowPx);
        } else {
          target.width = width;
          target.height = height;
        }
        // Холст после ресайза пуст, поэтому кадр рисуется сразу, не дожидаясь следующего шага
        paint(reducedMotion ? 0 : Math.max(step, stepAt(performance.now())));
      };

      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        const index = stepAt(now);
        if (index !== step) paint(index);
      };

      const resizeObserver = new ResizeObserver(([entry]) => resize(entry));
      try {
        resizeObserver.observe(target, { box: 'device-pixel-content-box' });
      } catch {
        resizeObserver.observe(target);
      }
      const visibility = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true;
      });
      visibility.observe(target);

      resize();
      if (!reducedMotion) frame = requestAnimationFrame(loop);

      return () => {
        live = false;
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        visibility.disconnect();
        renderer?.destroy();
        target.remove();
      };
    };

    // WebGL не вернул контекст: перестраиваем всё на обычном 2D-холсте
    let stop = start(true, () => {
      stop();
      stop = start(false, () => {});
    });

    return () => stop();
  }, [anchorX, backdrop, reducedMotion]);

  return (
    <div
      ref={hostRef}
      className={[styles.host, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
    />
  );
}
