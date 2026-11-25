import React from 'react';
import { WEB_BINDINGS } from './keyboard-contract.js';

export function KeyboardLegend({ shortcuts = false }: { shortcuts?: boolean }) {
  return <div className="ragbaz-keyboard-legend"><dl>{WEB_BINDINGS.map(binding => <React.Fragment key={binding.action}>
    <dt>{binding.keys.map(key => <kbd key={key}>{key}</kbd>)}</dt><dd>{binding.description}{binding.scope === 'tabs' ? ' · while a tab is focused' : binding.scope === 'records' ? ' · while a record control is focused; no wrap at boundaries' : binding.scope === 'shortcut' ? ` · ${shortcuts ? 'enabled outside text fields' : 'optional, currently off'}` : ''}</dd>
  </React.Fragment>)}</dl><p>Vim keys h/j/k/l/0/$ and /, r, ? shortcuts are {shortcuts ? 'enabled' : 'off; opt in using View settings'}. Browser and assistive-technology commands remain yours. Letter shortcuts never submit decisions or change access.</p></div>;
}
