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
