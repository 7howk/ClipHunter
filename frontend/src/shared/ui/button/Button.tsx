import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'text';
type Size = 'md' | 'sm';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
}

function classes(variant: Variant, size: Size, className?: string) {
  return [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ');
}

function Content({
  children,
  icon,
  iconPosition = 'start',
}: CommonProps & { children: ReactNode }) {
  return (
    <>
      {icon && iconPosition === 'start' && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
      {icon && iconPosition === 'end' && <span className={styles.icon}>{icon}</span>}
    </>
  );
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon} iconPosition={iconPosition}>
        {children}
      </Content>
    </button>
  );
}

type ButtonLinkProps = CommonProps & LinkProps;

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes(variant, size, className)} {...rest}>
      <Content icon={icon} iconPosition={iconPosition}>
        {children as ReactNode}
      </Content>
    </Link>
  );
}
