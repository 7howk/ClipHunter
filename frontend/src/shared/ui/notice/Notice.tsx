import type { ReactNode } from 'react';

import styles from './Notice.module.css';

interface NoticeProps {
  tone?: 'info' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function Notice({ tone = 'info', title, children, action }: NoticeProps) {
  return (
    <div className={styles.notice} data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
