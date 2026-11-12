import styles from './Logo.module.css';

/** Пиксельная голова Бобби: две бобины, корпус с глазами и объектив. */
const MARK = [
  '...###....####..',
  '..#...#..#....#.',
  '..#.#.#..#.##.#.',
  '..#...#..#....#.',
  '...###....####..',
  '....#......#....',
  '...############.',
  '####..#..######.',
  '####..#..######.',
  '...############.',
  '....##.##.##.##.',
];

const PIXELS = MARK.flatMap((row, y) =>
  [...row].flatMap((cell, x) => (cell === '#' ? [{ x, y }] : [])),
);

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 16 ${MARK.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {PIXELS.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark className={styles.mark} />
      <span className={styles.word}>ClipHunter</span>
    </span>
  );
}
