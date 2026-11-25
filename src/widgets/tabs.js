// @ts-check
import React from 'react';
import { webTabIndex } from './keyboard-contract.js';

const h = React.createElement;

/**
 * Roving-tabindex tab strip shared by React and plain-JS hosts. Arrow/Home/End
 * use the documented web bindings; Tab always remains native.
 * @param {{ items: Array<{ id: string, label: React.ReactNode, domId?: string, panelId?: string, className?: string, disabled?: boolean }>, value: string, onChange: (id: string) => void, label?: string, className?: string, tabClassName?: string, vim?: boolean }} props
 */
export function Tabs({ items, value, onChange, label, className = '', tabClassName = '', vim = false }) {
  /** @type {React.MutableRefObject<Array<HTMLButtonElement | null>>} */
  const buttons = React.useRef([]);
  const selectedIndex = Math.max(0, items.findIndex(item => item.id === value));

  /** @param {React.KeyboardEvent<HTMLElement>} event @param {number} index */
  function onKeyDown(event, index) {
    const next = webTabIndex(event.key, index, items.length, vim);
    if (next === null || !items[next] || items[next].disabled) return;
    event.preventDefault();
    onChange(items[next].id);
    buttons.current[next]?.focus();
  }

  return h('div', { className: ['ragbaz-tabs', className].filter(Boolean).join(' '), role: 'tablist', 'aria-label': label },
    items.map((item, index) => {
      const selected = item.id === value;
      return h('button', {
        key: item.id,
        id: item.domId,
        ref: node => { buttons.current[index] = /** @type {HTMLButtonElement | null} */ (node); },
        type: 'button',
        role: 'tab',
        'aria-controls': item.panelId,
        'aria-selected': selected,
        tabIndex: index === selectedIndex ? 0 : -1,
        disabled: item.disabled,
        className: ['ragbaz-tab', tabClassName, item.className, selected ? 'is-active' : ''].filter(Boolean).join(' '),
        onClick: () => { if (!item.disabled) onChange(item.id); },
        onKeyDown: event => onKeyDown(event, index),
      }, item.label);
    }),
  );
}
