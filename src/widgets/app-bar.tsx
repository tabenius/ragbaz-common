import React, { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MenuGroupContext, type MenuGroupContextValue, PopoverMenu } from './popover-menu';
import { WidgetIcon, type WidgetIconName } from './visual-language';

export type AppBarContextValue = MenuGroupContextValue;
export const AppBarContext = MenuGroupContext;

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
  align?: 'start' | 'end';
  panelClassName?: string;
  menuClassName?: string;
  onOpenChange?: (open: boolean) => void;
}

/** A right-aligned disclosure panel coordinated with the parent AppBar for auto-hide. Content stays in normal Tab order. */
export function AppBarMenu({ label, children, icon = 'menu', width, shortcut, closeOnSelect = true, align = 'end', panelClassName = '', menuClassName = '', onOpenChange }: AppBarMenuProps) {
  const context = React.useContext(AppBarContext);
  const id = useId();
  return <div className={`ragbaz-appbar__menu ${menuClassName}`.trim()}>
    <PopoverMenu
      id={id}
      label={label}
      icon={icon}
      width={width}
      shortcut={shortcut}
      closeOnSelect={closeOnSelect}
      align={align}
      triggerClassName="ragbaz-appbar__button"
      panelClassName={`ragbaz-appbar__panel ${panelClassName}`.trim()}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        if (next) context?.openMenu(id);
        else context?.closeMenu(id);
      }}
    >{children}</PopoverMenu>
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
