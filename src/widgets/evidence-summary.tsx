import React from 'react';
import { WidgetIcon } from './visual-language';

/** Current receipts are not the same as passing tests or reviewed readiness. */
export function EvidenceSummary({ current, total }: { current: number | null | undefined; total: number | null | undefined }) {
  const valid = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  const measurable = valid(current) && valid(total) && total > 0 && current <= total;
  return <span className="ragbaz-evidence-summary"><WidgetIcon name="evidence" /><span>{valid(total) ? `${valid(current) ? current : '—'} / ${total}` : 'Unknown'}</span>
    {measurable && <meter min={0} max={total} value={current} aria-label={`${current} of ${total} receipts current; not a pass rate`} />}
  </span>;
}
