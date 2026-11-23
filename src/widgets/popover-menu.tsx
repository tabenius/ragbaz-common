import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { WidgetIcon, type WidgetIconName } from './visual-language';

type MenuContextValue = { openMenu: (id: string) => void; closeMenu: (id: string) => void };
const MenuContext = createContext<MenuContextValue | null>(null);
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Wrap popovers so only one is open at a time. */
export function PopoverMenuProvider({ children }: { children: ReactNode }) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set());
  const openMenu = useCallback((id: string) => setOpenMenus((before) => new Set(before).add(id)), []);
  const closeMenu = useCallback((id: string) => setOpenMenus((before) => { const next = new Set(before); next.delete(id); return next; }), []);
  const context = useMemo(() => ({ openMenu, closeMenu }), [openMenu, closeMenu]);
  return <MenuContext.Provider value={context}>{children}</MenuContext.Provider>;
}

/** A right-aligned disclosure panel shared by product chrome and other surfaces. */
export function PopoverMenu({ label, children, icon, triggerClassName = '', panelClassName = '', width, shortcut, closeOnSelect = true, id: idProp, renderTrigger, onOpenChange }: {
  /** Accessible name of the trigger and its panel. */
  label: string;
  children: ReactNode;
  /** A built-in WidgetIcon name or a custom icon node. */
  icon?: WidgetIconName | ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  width?: number | string;
  shortcut?: string;
  /** Close after an ordinary link/button activation unless the target opts out with data-appbar-keep-open or data-menu-keep-open. */
  closeOnSelect?: boolean;
  id?: string;
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
    <div ref={panel} id={id} className={`ragbaz-popover-panel ${panelClassName}`} role="dialog" aria-label={label} tabIndex={-1} hidden={!open} style={panelStyle} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) change(false); }} onClick={(event) => {
      const target = event.target as HTMLElement;
      if (closeOnSelect && target.closest('a,button,[data-appbar-close],[data-menu-close]') && !target.closest('[data-appbar-keep-open],[data-menu-keep-open]')) change(false);
    }}>
      {children}
    </div>
  </div>;
}
