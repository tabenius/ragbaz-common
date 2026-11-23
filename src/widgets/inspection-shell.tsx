import React, { useEffect, useRef, type ReactNode } from 'react';
import { InspectionDialog } from './inspection-dialog';

export type InspectionMode = 'inline' | 'modal' | 'tab';

/**
 * Render a selected record inline or as a modal dialog. `tab` mode is
 * intentionally a no-op here so callers can render a real link to a new tab.
 */
export function InspectionShell({ open, title, onClose, mode, children, inlineClassName = '', inlineStyle, focusRestoreSelector }: {
  open: boolean;
  title: string;
  onClose: () => void;
  mode: InspectionMode;
  children: ReactNode;
  inlineClassName?: string;
  inlineStyle?: React.CSSProperties;
  /** CSS selector focused after the inline/modal view closes. */
  focusRestoreSelector?: string;
}) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open && focusRestoreSelector) {
      const el = document.querySelector<HTMLElement>(focusRestoreSelector);
      el?.focus();
    }
    wasOpen.current = open;
  }, [open, focusRestoreSelector]);
  if (!open || mode === 'tab') return null;
  if (mode === 'modal') {
    return <InspectionDialog open={open} title={title} onClose={onClose}>{children}</InspectionDialog>;
  }
  return <section
    className={inlineClassName}
    aria-label={title}
    tabIndex={-1}
    style={inlineStyle}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}
  >{children}</section>;
}
