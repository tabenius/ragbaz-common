import React from 'react';
import type { WidgetReferenceLink } from './node-types';
import { safeInspectionHref } from './presentation';
import { WidgetIcon, StatusPill } from './visual-language';

const labels: Record<WidgetReferenceLink['kind'], string> = {
  'pull-request': 'PR', 'merge-request': 'MR', issue: 'Issue', commit: 'Commit', review: 'Review', other: 'Link',
};

/** Remote navigation is separate from record inspection and local authority. */
export function WidgetReferenceLinks({ links, demo = false }: { links?: WidgetReferenceLink[]; demo?: boolean }) {
  if (!links?.length) return null;
  return <div className="ragbaz-reference-links" aria-label="Related source links">
    <ul>{links.map((link, index) => {
      const href = safeInspectionHref(link.href);
      const text = `${link.surface ? `${link.surface} · ` : ''}${labels[link.kind]} · ${link.label}`;
      const content = <><WidgetIcon name={link.kind} /><span className="ragbaz-reference-copy"><span className="ragbaz-reference-kind">{link.surface ?? 'Source'} · {labels[link.kind]}</span><span className="ragbaz-reference-title">{link.label}</span></span><WidgetIcon name="external" /></>;
      return <li key={`${link.href}-${index}`}>
        {href ? <a className="ragbaz-reference-link nodrag nopan" data-entity={link.kind} aria-label={`${text} (opens in new tab)`} href={href} target="_blank" rel="noopener noreferrer">{content}</a>
          : <span className="ragbaz-action-unavailable">{text} — unsafe or invalid link</span>}
        {link.state && <span className="ragbaz-reference-state"><span>Reported remote state</span><StatusPill state={link.state} source="Reported remote state" /></span>}
      </li>;
    })}</ul>
    {demo && <small>Illustrative links — remote records not verified.</small>}
  </div>;
}
