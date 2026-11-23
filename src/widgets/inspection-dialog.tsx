import React, { useEffect, useId, useRef, type ReactNode } from 'react';

/** Host-owned content, native modality and focus return; no routing or records. */
export function InspectionDialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) node.showModal();
    if (!open && node?.open) node.close();
  }, [open]);
  return <dialog ref={dialog} className="ragbaz-inspector" aria-labelledby={titleId} onClose={() => { if (open) onClose(); }}>
    <header className="ragbaz-inspector-header"><h2 id={titleId}>{title}</h2><button type="button" autoFocus onClick={() => dialog.current?.close()}>Close</button></header>
    {open && children}
  </dialog>;
}
