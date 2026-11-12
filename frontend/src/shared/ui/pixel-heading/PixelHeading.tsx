import type { ReactNode } from 'react';

import styles from './PixelHeading.module.css';

interface PixelHeadingProps {
  as?: 'h1' | 'h2' | 'h3';
  size?: 'xl' | 'lg' | 'md' | 'sm';
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Заголовок пиксельным шрифтом — голос бренда. Только для крупных заголовков. */
export function PixelHeading({
  as: Tag = 'h2',
  size = 'md',
  id,
  className,
  children,
}: PixelHeadingProps) {
  return (
    <Tag id={id} className={[styles.heading, styles[size], className].filter(Boolean).join(' ')}>
      {children}
    </Tag>
  );
}
