import type { ReactNode } from 'react';

export type TabItem = {
  id: string;
  label: ReactNode;
  domId?: string;
  panelId?: string;
  className?: string;
  disabled?: boolean;
};
export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
  tabClassName?: string;
  vim?: boolean;
};
export function Tabs(props: TabsProps): JSX.Element;
