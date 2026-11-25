import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);

const require = createRequire(import.meta.url);

async function playwrightChromium() {
  for (const name of [process.env.PLAYWRIGHT_MODULE, 'playwright-core', 'playwright'].filter(Boolean)) {
    try {
      const module = await import(pathToFileURL(require.resolve(name)).href);
      return module.chromium ?? module.default?.chromium ?? null;
    } catch { /* try the next module */ }
  }
  return null;
}

test('popover menu restores focus on dismissal but respects outside focus and opt-out', async t => {
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const chromium = await playwrightChromium();
  if (!chromium) { t.skip('No Playwright module installed'); return; }

  const bundle = await build({
    entryPoints: [join(root, 'tests/fixtures/popover-menu-browser.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    jsx: 'automatic',
  });
  const script = bundle.outputFiles.find(file => file.path.endsWith('.js')) ?? bundle.outputFiles[0];
  const css = await readFile(join(root, 'src/widgets/primitives.css'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/app.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(script.contents); return; }
    if (path === '/app.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); res.end(css); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  let browser;
  try {
    browser = await chromium.launch({ executablePath: executable, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const trigger = page.getByRole('button', { name: 'Actions' });
    const panel = page.getByRole('dialog', { name: 'Actions' });
    await trigger.waitFor({ state: 'visible' });

    await trigger.click();
    await panel.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'action', 'opening a menu focuses its first item');

    await page.locator('#action').click();
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'preferred', 'item activation restores the supplied focus target');

    await trigger.click();
    await panel.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'preferred', 'Escape restores the supplied focus target');

    await trigger.click();
    await page.locator('#keep').click();
    assert.equal(await panel.isVisible(), true, 'data-menu-keep-open leaves the panel open');
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });

    await trigger.click();
    await page.locator('#after').click();
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'after', 'outside clicks keep the user’s focus');

    const noRestore = page.getByRole('button', { name: 'No restore' });
    await noRestore.click();
    await page.locator('#other-action').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'No restore' }).waitFor({ state: 'hidden' });
    assert.equal(await noRestore.evaluate(element => element === document.activeElement), false, 'restoreFocusOnClose=false does not refocus the trigger');

    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('framework-neutral popover controller matches the React contract', async t => {
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const chromium = await playwrightChromium();
  if (!chromium) { t.skip('No Playwright module installed'); return; }

  const bundle = await build({
    entryPoints: [join(root, 'tests/fixtures/popover-controller-browser.js')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
  });
  const script = bundle.outputFiles[0];
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><button data-trigger type="button">Plain actions</button><div data-panel hidden><button id="plain-action" type="button">Run</button></div><button id="after" type="button">After</button><script src="/app.js"></script></body></html>';
  const server = createServer((req, res) => {
    if (new URL(req.url, 'http://localhost').pathname === '/app.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(script.contents); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  let browser;
  try {
    browser = await chromium.launch({ executablePath: executable, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const trigger = page.locator('[data-trigger]');
    const panel = page.locator('[data-panel]');
    const ids = await page.evaluate(() => {
      const button = document.querySelector('[data-trigger]');
      const dialog = document.querySelector('[data-panel]');
      return { trigger: button.id, panel: dialog.id, controls: button.getAttribute('aria-controls') };
    });
    assert.notEqual(ids.trigger, ids.panel, 'trigger and panel must not share an id');
    assert.equal(ids.controls, ids.panel);
    assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');

    await trigger.click();
    await panel.waitFor({ state: 'visible' });
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'plain-action');

    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    assert.ok(await trigger.evaluate(element => element === document.activeElement), 'Escape restores trigger focus');

    await trigger.click();
    await page.locator('#after').click();
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'after', 'outside clicks keep the user’s focus');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('tabs move selection with the shared web key bindings', async t => {
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const chromium = await playwrightChromium();
  if (!chromium) { t.skip('No Playwright module installed'); return; }

  const bundle = await build({
    entryPoints: [join(root, 'tests/fixtures/tabs-browser.js')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    jsx: 'automatic',
  });
  const script = bundle.outputFiles[0];
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div><script src="/app.js"></script></body></html>';
  const server = createServer((req, res) => {
    if (new URL(req.url, 'http://localhost').pathname === '/app.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(script.contents); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  let browser;
  try {
    browser = await chromium.launch({ executablePath: executable, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const tabs = page.getByRole('tab');
    assert.equal(await tabs.count(), 3);
    assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');

    await tabs.nth(0).press('ArrowRight');
    await page.waitForFunction(() => window.__tabValue === 'smb');
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'tab');

    await tabs.nth(1).press('End');
    await page.waitForFunction(() => window.__tabValue === 'lab');
    assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true');

    await tabs.nth(2).press('Home');
    await page.waitForFunction(() => window.__tabValue === 'all');
    assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
