import { useEffect, useRef, useState } from 'react';
import { WidgetIcon } from './visual-language';
import { copyText } from './copy-text';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Icon-only copy control. It copies a literal string; it never executes it.
 * Accessible naming is supplied by the host, so a screen reader hears which
 * command or value will be copied before activating the button.
 */
export function CopyButton({ value, label, successText = 'Copied', failureText = 'Copy unavailable — select manually', className = '' }: {
  value: string;
  label: string;
  successText?: string;
  failureText?: string;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    const result = await copyText(value);
    if (timer.current) clearTimeout(timer.current);
    setState(result.ok ? 'copied' : 'failed');
    timer.current = setTimeout(() => setState('idle'), 2200);
  }

  return <span className={`ragbaz-copy-control ${className}`}>
    <button className="ragbaz-copy-button" type="button" aria-label={label} title={label} onClick={() => void copy()}>
      <WidgetIcon name={state === 'copied' ? 'check' : state === 'failed' ? 'close' : 'copy'} />
    </button>
    {state === 'idle' ? null : <span className="ragbaz-copy-status" role="status" aria-live="polite">{state === 'copied' ? successText : failureText}</span>}
  </span>;
}
