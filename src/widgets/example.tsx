import React, { type ReactNode } from 'react';

/** A demonstration is a structured widget, not an unlabelled pile of cards. */
export function WidgetExample({ id, heading, description, children, note }: {
  id: string; heading: string; description: string; children: ReactNode; note?: string;
}) {
  return <section id={id} className="ragbaz-example" aria-labelledby={`${id}-heading`}>
    <header className="ragbaz-example-header"><span className="ragbaz-example-label">Widget example · DEMO</span>
      <h2 id={`${id}-heading`}>{heading}</h2><p>{description}</p></header>
    <div className="ragbaz-example-stage" aria-label={`Example: ${heading}`}>{children}</div>
    {note && <footer className="ragbaz-example-note">{note}</footer>}
  </section>;
}
