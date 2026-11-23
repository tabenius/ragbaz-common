import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { WidgetIcon, type WidgetIconName } from './visual-language';

type AppBarContextValue = { openMenu: (id: string) => void; closeMenu: (id: string) => void };
const AppBarContext = createContext<AppBarContextValue | null>(null);
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Product-neutral application bar. The host supplies the brand and all action
 * content; this widget owns only geometry, focus, aria and auto-hide behaviour.
 */
export function AppBar({ label = 'Application', brand, children, height, autoHide = false, className = '' }: {
  label?: string;
  brand?: ReactNode;
  children?: ReactNode;
  height?: number | string;
  autoHide?: boolean;
  className?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set());
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  const openMenu = useCallback((id: string) => setOpenMenus((before) => new Set(before).add(id)), []);
  const closeMenu = useCallback((id: string) => setOpenMenus((before) => { const next = new Set(before); next.delete(id); return next; }), []);
  const context = useMemo(() => ({ openMenu, closeMenu }), [openMenu, closeMenu]);
  useEffect(() => {
    if (!autoHide) { setHidden(false); return; }
    let previous = window.scrollY;
    const onScroll = () => {
      const current = Math.max(0, window.scrollY);
      if (Math.abs(current - previous) < 8 && current > 60) return;
      setHidden(current > previous && current > 100 && !pointerInside.current && !focusInside.current && openMenus.size === 0);
      previous = current;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [autoHide, openMenus.size]);
  const style = height === undefined ? undefined : { '--ragbaz-appbar-height': typeof height === 'number' ? `${height}px` : height } as CSSProperties;
  return <AppBarContext.Provider value={context}>
    {autoHide ? <div className="ragbaz-appbar__hotzone" aria-hidden="true" onPointerMove={() => setHidden(false)} /> : null}
    <header
      className={`ragbaz-appbar${hidden ? ' ragbaz-appbar--hidden' : ''} ${className}`}
      aria-label={label}
      style={style}
      onPointerEnter={() => { pointerInside.current = true; setHidden(false); }}
      onPointerLeave={() => { pointerInside.current = false; }}
      onFocusCapture={() => { focusInside.current = true; setHidden(false); }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) focusInside.current = false; }}
    >
      <div className="ragbaz-appbar__brand">{brand}</div>
      <div className="ragbaz-appbar__actions">{children}</div>
    </header>
  </AppBarContext.Provider>;
}

export interface AppBarMenuProps {
  /** Accessible name of the trigger and its panel. */
  label: string;
  children: ReactNode;
  /** A built-in WidgetIcon name or a custom icon node. Defaults to `menu`. */
  icon?: WidgetIconName | ReactNode;
  width?: number | string;
  shortcut?: string;
  /** Close after an ordinary link/button activation. Actions that show status can opt out. */
  closeOnSelect?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** A right-aligned disclosure panel. Content stays in normal Tab order. */
export function AppBarMenu({ label, children, icon = 'menu', width, shortcut, closeOnSelect = true, onOpenChange }: AppBarMenuProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const context = useContext(AppBarContext);
  useEffect(() => {
    if (!open) return;
    context?.openMenu(id);
    return () => context?.closeMenu(id);
  }, [open, id, context]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) change(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.current;
    first?.focus();
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  });
  function change(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }
  const panelStyle = width === undefined ? undefined : { '--ragbaz-appbar-panel-width': typeof width === 'number' ? `${width}px` : width } as CSSProperties;
  return <div className="ragbaz-appbar__menu" onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); change(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="ragbaz-appbar__button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} aria-keyshortcuts={shortcut} onClick={() => change(!open)}>
      {typeof icon === 'string' ? <WidgetIcon name={icon as WidgetIconName} /> : icon}
    </button>
    <div ref={panel} id={id} className="ragbaz-appbar__panel" role="dialog" aria-label={label} tabIndex={-1} hidden={!open} style={panelStyle} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) change(false); }} onClick={(event) => {
      const target = event.target as HTMLElement;
      if (closeOnSelect && target.closest('a,button,[data-appbar-close]') && !target.closest('[data-appbar-keep-open]')) change(false);
    }}>
      {children}
    </div>
  </div>;
}

/** Preset avatar trigger; identity text is presentation only, never authority. */
export function AppBarAvatarMenu({ label, name, email, initial, kind = 'person', children, ...menu }: Omit<AppBarMenuProps, 'icon'> & {
  name: string;
  email?: string;
  initial?: string;
  kind?: 'person' | 'agent' | 'unknown';
}) {
  const glyph = initial ? initial.slice(0, 2).toUpperCase() : <WidgetIcon name={kind === 'unknown' ? 'persona' : kind} />;
  return <AppBarMenu {...menu} label={label} icon={<span className="ragbaz-appbar__avatar" aria-hidden="true">{glyph}</span>}>
    <div className="ragbaz-appbar__identity"><strong>{name}</strong>{email ? <span>{email}</span> : null}<small>Display identity only · not a verification claim</small></div>
    {children}
  </AppBarMenu>;
}
