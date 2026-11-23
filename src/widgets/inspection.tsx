import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AdminNodeData } from './node-types';
import { safeInspectionHref } from './presentation';
import { WidgetIcon } from './visual-language';

export type InspectionMode = 'modal' | 'tab';
interface InspectionContextValue {
  mode: InspectionMode;
  open: (record: AdminNodeData) => void;
  href: (record: AdminNodeData) => string | undefined;
}
const InspectionContext = createContext<InspectionContextValue | null>(null);

/** Inspection is navigation, not a mutation or a grant of work authority. */
export function WidgetInspectionProvider({ children, mode = 'modal', resolveHref, renderDetail }: {
  children: ReactNode;
  mode?: InspectionMode;
  resolveHref?: (record: AdminNodeData) => string | undefined;
  renderDetail: (record: AdminNodeData) => ReactNode;
}) {
  const [selected, setSelected] = useState<AdminNodeData | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);
  const href = (record: AdminNodeData) => safeInspectionHref(resolveHref?.(record) ?? record.inspectHref);
  return <InspectionContext.Provider value={{ mode, open: setSelected, href }}>
    {children}
    <dialog ref={dialog} className="ragbaz-inspector" aria-labelledby="widget-inspector-title" onClose={() => setSelected(null)}>
      {selected && <><header className="ragbaz-inspector-header"><h2 id="widget-inspector-title">Inspect {selected.label}</h2>
        <button type="button" onClick={() => dialog.current?.close()} autoFocus>Close</button></header>
        {renderDetail(selected)}
        {href(selected) && <a href={href(selected)} target="_blank" rel="noopener noreferrer">Open this record in a new tab ↗</a>}
      </>}
    </dialog>
  </InspectionContext.Provider>;
}

export function WidgetInspectAction({ data }: { data: AdminNodeData }) {
  const context = useContext(InspectionContext);
  const href = context ? context.href(data) : safeInspectionHref(data.inspectHref);
  if (context?.mode === 'modal') return <button className="ragbaz-inspect nodrag nopan" type="button" aria-haspopup="dialog" onClick={() => context.open(data)}><WidgetIcon name="inspect" /> Inspect {data.type === 'oversight' ? 'hold' : data.type}</button>;
  if (href) return <a className="ragbaz-inspect nodrag nopan" href={href} target="_blank" rel="noopener noreferrer"><WidgetIcon name="external" /> Inspect in new tab</a>;
  return <span className="ragbaz-action-unavailable">Inspection link not supplied</span>;
}
