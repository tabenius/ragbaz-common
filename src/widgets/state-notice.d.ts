import type { ReactNode } from 'react';

export type StateNoticeProps = {
  tone?: 'empty' | 'neutral' | 'loading' | 'active' | 'stale' | 'warning' | 'error' | 'danger' | 'success' | string;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: string | null;
  as?: string;
};
export function StateNotice(props: StateNoticeProps): JSX.Element;
