// @ts-check
import React from 'react';
import { stateTone } from './dom.js';

const h = React.createElement;
/** @type {Record<string, string>} */
const TONES = {
  error: 'danger', danger: 'danger', bad: 'danger', blocked: 'danger', failed: 'danger',
  warn: 'warning', warning: 'warning', stale: 'warning', pending: 'warning',
  ok: 'success', success: 'success', passed: 'success', done: 'success',
  active: 'active', loading: 'active', running: 'active',
  empty: 'neutral', neutral: 'neutral',
};

/** @param {{ tone?: string, title?: React.ReactNode, children?: React.ReactNode, className?: string, role?: string | null, as?: string }} props */
export function StateNotice({ tone = 'neutral', title, children, className = '', role, as = 'div' }) {
  const resolved = TONES[tone] ?? stateTone(tone);
  const defaultRole = resolved === 'danger' ? 'alert' : 'status';
  return h(as, {
    className: ['ragbaz-state-notice', `ragbaz-state-notice--${resolved}`, className].filter(Boolean).join(' '),
    'data-tone': resolved,
    role: role === null ? undefined : role ?? defaultRole,
  }, title == null ? null : h('strong', { className: 'ragbaz-state-notice-title' }, title), children == null ? null : children);
}
