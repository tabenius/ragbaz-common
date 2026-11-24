import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { WidgetIcon, type WidgetIconName } from './visual-language';

export type MenuGroupContextValue = { openMenu: (id: string) => void; closeMenu: (id: string) => void };
const MenuContext = createContext<MenuGroupContextValue | null>(null);
export const MenuGroupContext = MenuContext;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Wrap popovers so a group can coordinate open state (e.g. auto-hide). */
export function PopoverMenuProvider({ children, value }: { children: ReactNode; value?: MenuGroupContextValue | null }) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set());
  const openMenu = useCallback((id: string) => setOpenMenus((before) => new Set(before).add(id)), []);
  const closeMenu = useCallback((id: string) => setOpenMenus((before) => { const next = new Set(before); next.delete(id); return next; }), []);
  const context = useMemo(() => value ?? ({ openMenu, closeMenu }), [value, openMenu, closeMenu]);
  return <MenuContext.Provider value={context}>{children}</MenuContext.Provider>;
}

/** Access the menu-group coordination context (open/close ids) when present. */
export function usePopoverMenuGroup() {
  return useContext(MenuContext);
}

/** A right-aligned disclosure panel shared by product chrome and other surfaces. */
export function PopoverMenu({ label, children, icon, triggerClassName = '', panelClassName = '', width, shortcut, closeOnSelect = true, id: idProp, align = 'end', renderTrigger, onOpenChange }: {
  /** Accessible name of the trigger and its panel. */
  label: string;
  children: ReactNode;
  /** A built-in WidgetIcon name or a custom icon node. */
  icon?: WidgetIconName | ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  width?: number | string;
  shortcut?: string;
  /** Close after link/button activation. `links` (default true behavior) closes on a/link/button clicks unless opting out via data-menu-keep-open/data-appbar-keep-open. */
  closeOnSelect?: boolean | 'links' | ((el: HTMLElement) => boolean);
  id?: string;
  align?: 'start' | 'end';
  /** Replace the default icon button trigger (must forward ref/aria externally). */
  renderTrigger?: (args: { open: boolean; toggle: () => void; triggerProps: { ref: React.RefObject<HTMLButtonElement | null>; id: string; 'aria-haspopup': 'dialog'; 'aria-expanded': boolean; 'aria-controls': string; 'aria-keyshortcuts'?: string; className: string; type: 'button'; onClick: () => void } }) => ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const context = useContext(MenuContext);
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
  const panelStyle = width === undefined ? undefined : { '--ragbaz-popover-width': typeof width === 'number' ? `${width}px` : width } as CSSProperties;
  const triggerProps = {
    ref: trigger,
    id,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': open,
    'aria-controls': id,
    'aria-keyshortcuts': shortcut,
    className: triggerClassName,
    type: 'button' as const,
    onClick: () => change(!open),
  };
  return <div className="ragbaz-popover" onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); change(false); trigger.current?.focus(); } }}>
    {renderTrigger ? renderTrigger({ open, toggle: () => change(!open), triggerProps }) : (
      <button {...triggerProps} aria-label={label} title={label}>
        {icon === undefined || typeof icon === 'string' ? <WidgetIcon name={(icon ?? 'menu') as WidgetIconName} /> : icon}
      </button>
    )}
    <div ref={panel} id={id} className={`ragbaz-popover-panel ${panelClassName}`} role="dialog" aria-label={label} tabIndex={-1} hidden={!open} style={panelStyle} data-align={align === 'start' ? 'start' : undefined} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) change(false); }} onClick={(event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-appbar-keep-open],[data-menu-keep-open]')) return;
      if (closeOnSelect === false) return;
      if (typeof closeOnSelect === 'function') { if (closeOnSelect(target)) change(false); return; }
      if (target.closest('a,button,[data-appbar-close],[data-menu-close]')) change(false);
    }}>
      {children}
    </div>
  </div>;
}
