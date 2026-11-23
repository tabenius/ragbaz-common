import { CopyButton } from './copy-button';
import { WidgetIcon } from './visual-language';

/**
 * A terminal command as a presentation widget: the exact text stays in a code
 * element, an icon button copies it, and nothing here runs, validates or
 * interprets the command. `label` names the copy action for assistive tech.
 */
export function TerminalCommand({ command, label = 'terminal command', description, inline = false, className = '' }: {
  command: string;
  label?: string;
  description?: string;
  inline?: boolean;
  className?: string;
}) {
  const copy = <CopyButton value={command} label={`Copy ${label}`} />;
  if (inline) return <span className={`ragbaz-terminal-command ragbaz-terminal-command-inline ${className}`} role="group" aria-label={label}>
    <WidgetIcon name="terminal" className="ragbaz-command-glyph" />
    <code className="ragbaz-command-text">{command}</code>
    {copy}
  </span>;
  return <div className={`ragbaz-terminal-command ragbaz-terminal-command-block ${className}`} role="group" aria-label={label}>
    {description ? <p className="ragbaz-command-description">{description}</p> : null}
    <div className="ragbaz-command-line">
      <WidgetIcon name="terminal" className="ragbaz-command-glyph" />
      <pre><code className="ragbaz-command-text">{command}</code></pre>
      {copy}
    </div>
  </div>;
}
