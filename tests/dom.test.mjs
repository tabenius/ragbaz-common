import test from 'node:test';
import assert from 'node:assert/strict';
import { copyText, stateTone, restoreFocus, focusAndReveal, shouldAutoHideChrome, createTabs } from '../src/widgets/dom.js';

test('framework-neutral copyText keeps the exact value and reports failure', async () => {
  const written = [];
  assert.deepEqual(await copyText('frog --json task info FRG-42', { writeText: async value => { written.push(value); } }), { ok: true });
  assert.deepEqual(written, ['frog --json task info FRG-42']);
  assert.deepEqual(await copyText('anything', null), { ok: false, reason: 'unavailable' });
  assert.deepEqual(await copyText('anything', { writeText: async () => { throw new Error('denied'); } }), { ok: false, reason: 'denied' });
});

test('stateTone stays neutral for unknown states', () => {
  assert.equal(stateTone('blocked'), 'danger');
  assert.equal(stateTone('stale'), 'warning');
  assert.equal(stateTone('approved'), 'success');
  assert.equal(stateTone('running'), 'active');
  assert.equal(stateTone('new_domain_state'), 'neutral');
});

test('restoreFocus accepts elements, refs and fallbacks', () => {
  const focused = [];
  const element = { focus: () => focused.push('element') };
  const fallback = { focus: () => focused.push('fallback') };
  assert.equal(restoreFocus({ current: element }), true);
  assert.equal(restoreFocus(null, fallback), true);
  assert.equal(restoreFocus(false), false);
  assert.deepEqual(focused, ['element', 'fallback']);
});

test('focusAndReveal scrolls then focuses without stealing a missing target', () => {
  const calls = [];
  const node = { scrollIntoView: options => calls.push(['scroll', options]), focus: options => calls.push(['focus', options]) };
  const root = { querySelector: selector => { assert.equal(selector, '[data-task="FRG-42"]'); return node; } };
  assert.equal(focusAndReveal('[data-task="FRG-42"]', root), true);
  assert.deepEqual(calls[0], ['scroll', { block: 'nearest' }]);
  assert.equal(calls[1][0], 'focus');
  assert.equal(focusAndReveal('[missing]', { querySelector: () => null }), false);
  assert.equal(focusAndReveal('[missing]', null), false);
});

test('shouldAutoHideChrome ignores jitter and respects pointer, focus and open menus', () => {
  assert.equal(shouldAutoHideChrome({ current: 140, previous: 100 }), true);
  assert.equal(shouldAutoHideChrome({ current: 104, previous: 100 }), undefined);
  assert.equal(shouldAutoHideChrome({ current: 140, previous: 100, pointerInside: true }), false);
  assert.equal(shouldAutoHideChrome({ current: 140, previous: 100, focusInside: true }), false);
  assert.equal(shouldAutoHideChrome({ current: 140, previous: 100, menusOpen: 1 }), false);
  assert.equal(shouldAutoHideChrome({ current: 50, previous: 40 }), false);
});

test('createTabs keeps native Tab order and uses the shared web arrow contract', () => {
  const makeTab = (id) => ({
    id,
    attributes: {},
    listeners: {},
    focused: [],
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    removeEventListener(name) { delete this.listeners[name]; },
    focus() { this.focused.push(id); },
  });
  const items = ['a', 'b', 'c'].map(id => ({ id, tab: makeTab(id), panel: { hidden: true } }));
  const selected = [];
  const tabs = createTabs({ items, initial: 'a', onSelect: id => selected.push(id) });
  assert.equal(items[0].tab.attributes['aria-selected'], 'true');
  assert.equal(items[0].tab.tabIndex, 0);
  assert.equal(items[1].tab.tabIndex, -1);
  assert.equal(items[1].panel.hidden, true);

  const event = { key: 'ArrowRight', preventDefault() { event.prevented = true; } };
  items[0].tab.listeners.keydown(event);
  assert.equal(event.prevented, true);
  assert.equal(tabs.value, 'b');
  assert.equal(items[1].tab.focused.length, 1);
  assert.equal(items[0].tab.attributes['aria-selected'], 'false');
  assert.equal(items[1].tab.attributes['aria-selected'], 'true');

  const letter = { key: 'l', preventDefault() { letter.prevented = true; } };
  items[1].tab.listeners.keydown(letter);
  assert.equal(letter.prevented, undefined);
  assert.equal(tabs.value, 'b');

  const end = { key: 'End', preventDefault() {} };
  items[1].tab.listeners.keydown(end);
  assert.equal(tabs.value, 'c');

  tabs.destroy();
  assert.equal(items[1].tab.listeners.keydown, undefined);
});
