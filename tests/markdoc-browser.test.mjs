import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { buildStandalone, collectBundleNotices } from '../scripts/build-markdoc-ragbaz.mjs';
import { escapeHTML } from '../src/content/markdoc-ragbaz.js';
import worker, { serveBuiltHTML } from '../demo/markdoc-ragbaz/worker.mjs';
import { buildMetaDocument, META_MOUNT } from '../scripts/build-markdoc-ragbaz-sci-tufte.mjs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { ILLUSTRATIONS } from '../demo/markdoc-ragbaz/figures.js';
import { AETHER_VARIANTS } from '../demo/markdoc-ragbaz/aether.js';
import { temporaryDirectory } from './helpers/temp.mjs';

if (process.env.CI && !['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].some(path => spawnSync('test', ['-x', path]).status === 0)) {
  throw new Error('CI requires Chromium; browser coverage must not silently skip');
}

test('content-neutral meta-document loads only explicit permitted parameters, refuses mismatches and remains offline-readable', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('markdoc-meta-browser-'); let browser, server;
  try {
    const { directory, manifest } = await buildMetaDocument({ output: dir });
    const files = new Map();
    for (const path of Object.keys(manifest.files)) files.set(`${META_MOUNT}/${path}`, await readFile(join(directory, path)));
    const markdown = '# Own paper\n\nAuthored elsewhere. <script>window.bad=true</script>';
    const digest = createHash('sha256').update(markdown).digest('hex');
    files.set(`${META_MOUNT}/own.md`, Buffer.from(markdown));
    files.set(`${META_MOUNT}/refused.md`, Buffer.from('---\nschema: unsupported/1\n---\n# Refused'));
    const requests = [];
    server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost'); requests.push(url.pathname);
      if (url.pathname === META_MOUNT) { res.writeHead(308, { Location: META_MOUNT + '/' + url.search }); res.end(); return; }
      const path = url.pathname === META_MOUNT + '/' ? META_MOUNT + '/index.html' : url.pathname;
      const body = files.get(path);
      res.writeHead(body ? 200 : 404, { 'Content-Type': path.endsWith('.md') ? 'text/markdown' : path.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
      res.end(body || 'Not found');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}${META_MOUNT}`;
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    await browser.call('Page.enable', {}, sessionId);
    const ev = async expression => {
      const result = await browser.call('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression }, sessionId);
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    const navigate = async url => {
      const navigated = await browser.call('Page.navigate', { url }, sessionId);
      assert.equal(navigated.errorText, undefined, navigated.errorText);
      await new Promise(r => setTimeout(r, 250));
      assert(await ev("!!document.getElementById('paper')"), await ev('document.body.innerText'));
    };
    await navigate(base);
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'markdoc-ragbaz-sci-tufte');
    assert(await ev("!document.getElementById('heart-ornaments') && !document.querySelector('.heart-frame')"), 'sci does not acquire botanical controls');
    assert(!requests.some(path => path.endsWith('.md')), 'no document request without a parameter');
    assert.equal(await ev("document.getElementById('theme-fonts').value"), 'system');
    assert(await ev("!document.querySelector('link[href*=\"fonts.googleapis.com\"]') && !performance.getEntriesByType('resource').some(r=>r.name.includes('fonts.google'))"), 'curated fonts are opt-in, not automatic network requests');
    await ev("const f=document.getElementById('theme-fonts');f.value='theme';f.dispatchEvent(new Event('change'))");
    const fontFallback = await ev("(async()=>{for(let i=0;i<40&&!document.getElementById('theme-font-status').textContent.includes('unavailable');i++)await new Promise(r=>setTimeout(r,50));return document.getElementById('theme-font-status').textContent})()");
    assert(fontFallback.includes('unavailable'), 'network-disabled font loading falls back visibly');
    assert.equal(await ev('document.documentElement.dataset.fonts'), 'system');
    await ev("document.getElementById('theme-fonts').value='system';document.getElementById('theme-fonts').dispatchEvent(new Event('change'))");
    const appearance = async choice => ev(`(() => { const s=document.getElementById('appearance');s.value=${JSON.stringify(choice)};s.dispatchEvent(new Event('change'));return getComputedStyle(document.body).backgroundColor })()`);
    await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }, sessionId);
    assert.equal(await appearance('system'), 'rgb(25, 30, 32)', 'system follows OS dark without a stored override');
    assert.equal(await appearance('light'), 'rgb(248, 245, 237)', 'explicit light wins over dark OS');
    await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, sessionId);
    assert.equal(await appearance('dark'), 'rgb(25, 30, 32)', 'explicit dark wins over light OS');
    await navigate(base);
    assert.equal(await ev("document.getElementById('appearance').value"), 'dark', 'appearance persists across reloads');
    assert.equal(await ev("getComputedStyle(document.getElementById('reader-drawer')).backgroundColor"), 'rgb(25, 30, 32)');
    assert.equal(await ev("getComputedStyle(document.getElementById('inspector')).backgroundColor"), 'rgb(25, 30, 32)');
    await ev(`document.getElementById('source-preview').innerHTML=${JSON.stringify('<figure class="project-card"><div class="project-illustration">' + ILLUSTRATIONS.weftmark + '</div><figcaption>Workflow above storage</figcaption></figure><pre>Inert source</pre>')}`);
    assert.equal(await ev("getComputedStyle(document.querySelector('#source-preview svg text:not([class])')).fill"), 'rgb(214, 232, 233)', 'trusted SVG text uses the dark palette');
    assert.equal(await ev("getComputedStyle(document.querySelector('#source-preview svg .box')).fill"), 'rgb(38, 56, 60)');
    assert.equal(await ev("getComputedStyle(document.querySelector('#source-preview pre')).backgroundColor"), 'rgb(32, 40, 42)');
    await browser.call('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
    assert.equal(await ev('getComputedStyle(document.body).backgroundColor'), 'rgb(255, 255, 255)', 'dark preference prints on white paper');
    assert.equal(await ev('getComputedStyle(document.body).color'), 'rgb(0, 0, 0)');
    assert.equal(await ev("getComputedStyle(document.querySelector('#source-preview svg text:not([class])')).fill"), 'rgb(35, 61, 67)', 'illustrations print in the light palette');
    await browser.call('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: 'light' }] }, sessionId);
    assert.equal(await ev('getComputedStyle(document.body).backgroundColor'), 'rgb(25, 30, 32)', 'printing does not mutate the preference');
    assert.equal(await appearance('system'), 'rgb(248, 245, 237)');
    assert.equal(await ev("localStorage.getItem('ragbaz.sci.appearance')"), null);
    await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
    assert(await ev('document.documentElement.scrollWidth <= innerWidth'), 'neutral opening fits a narrow screen');
    await browser.call('Emulation.clearDeviceMetricsOverride', {}, sessionId);
    await ev("document.getElementById('contract-link').click()"); await new Promise(r => setTimeout(r, 100));
    assert(await ev("document.getElementById('source-provenance').textContent.includes('digest matched')"));
    await navigate(base + '?document=starter.md');
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'Your paper title');
    await navigate(base + '?document=own.md&sha256=' + digest);
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'Own paper');
    assert.equal(await ev("document.getElementById('document-digest').textContent"), 'Current Markdown SHA-256: ' + digest);
    assert(await ev("!window.bad && !document.querySelector('#paper script') && document.getElementById('notice').textContent.includes('requested digest matched')"));
    await ev("document.getElementById('contract-link').click()"); await new Promise(r => setTimeout(r, 100));
    assert(await ev("document.getElementById('source-provenance').textContent.includes('digest matched')"), 'template contract survives document replacement');
    await navigate(base + '?document=refused.md');
    assert(await ev("document.getElementById('paper').textContent.includes('Document refused')"));
    assert(await ev("document.getElementById('inspect-document').disabled && document.getElementById('document-digest').textContent === ''"));
    await ev("document.getElementById('contract-link').click()"); await new Promise(r => setTimeout(r, 100));
    assert(await ev("!document.getElementById('inspector').hidden && document.getElementById('source-provenance').textContent.includes('digest matched')"), 'offline contract remains inspectable after render refusal');
    await navigate(base + '?document=own.md&sha256=' + '0'.repeat(64));
    assert(await ev("document.getElementById('paper').textContent.includes('Document unavailable/refused') && !document.getElementById('paper').textContent.includes('Own paper')"));
    assert(await ev("document.getElementById('inspect-document').disabled && document.getElementById('document-check-status').textContent.includes('No rendered document')"));
    const before = requests.filter(p => p.endsWith('.md')).length;
    await navigate(base + '?document=javascript%3Aalert(1)');
    assert(await ev("document.getElementById('paper').textContent.includes('Document unavailable/refused')"));
    assert.equal(requests.filter(p => p.endsWith('.md')).length, before);
    await navigate(base + '?document=own.md&document=starter.md');
    assert(await ev("document.getElementById('paper').textContent.includes('Document parameter refused')"));
    await navigate(pathToFileURL(join(directory, 'index.html')).href);
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'markdoc-ragbaz-sci-tufte');
    await ev("document.getElementById('contract-link').click()"); await new Promise(r => setTimeout(r, 100));
    assert(await ev("document.getElementById('source-provenance').textContent.includes('digest matched')"));
    const { identifier } = await browser.call('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage denied','SecurityError')}})" }, sessionId);
    await navigate(base);
    assert.equal(await appearance('dark'), 'rgb(25, 30, 32)', 'denied storage does not break appearance or document reading');
    assert.equal(await ev("const f=document.getElementById('theme-fonts');f.value='theme';f.dispatchEvent(new Event('change'));f.value"), 'theme', 'font selection remains usable with storage denied');
    await ev("document.getElementById('theme-fonts').value='system';document.getElementById('theme-fonts').dispatchEvent(new Event('change'))");
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'markdoc-ragbaz-sci-tufte');
    await browser.call('Page.removeScriptToEvaluateOnNewDocument', { identifier }, sessionId);
  } finally { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});

test('Heartfulness renders original optional botanicals, grain, dark paper and loaded prose without changing sci', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('heartfulness-browser-test-'); let browser, server;
  try {
    const { directory, manifest } = await buildMetaDocument({ output: dir, template: 'heartfulness' });
    const files = new Map();
    for (const path of Object.keys(manifest.files)) files.set('/heartfulness/' + path, await readFile(join(directory, path)));
    server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname === '/heartfulness/' ? '/heartfulness/index.html' : url.pathname;
      const body = files.get(path);
      res.writeHead(body ? 200 : 404, { 'Content-Type': path.endsWith('.md') ? 'text/markdown' : 'text/html' }); res.end(body || 'Not found');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/heartfulness/`;
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params = {}) => browser.call(method, params, sessionId);
    const ev = async expression => {
      const r = await call('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression });
      assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails)); return r.result.value;
    };
    const navigate = async url => { const r = await call('Page.navigate', { url }); assert.equal(r.errorText, undefined); await new Promise(r => setTimeout(r, 300)); };
    await call('Page.enable');
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate(base);
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'Heartfulness');
    assert.equal(await ev('getComputedStyle(document.body).backgroundColor'), 'rgb(245, 237, 207)');
    assert.equal(await ev("document.querySelectorAll('.heart-corner svg').length"), 4);
    assert.equal(await ev("document.querySelectorAll('#paper .heart-flourish').length"), 2);
    assert(await ev("document.querySelector('.heart-frame').getAttribute('aria-hidden') === 'true' && getComputedStyle(document.querySelector('.heart-frame')).pointerEvents === 'none'"));
    await ev("document.getElementById('heart-ornaments').value='plain';document.getElementById('heart-ornaments').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('heart-texture').click()");
    assert.equal(await ev("getComputedStyle(document.querySelector('.heart-frame')).display"), 'none');
    assert.equal(await ev("getComputedStyle(document.querySelector('.heart-flourish')).display"), 'none');
    assert.equal(await ev("getComputedStyle(document.querySelector('.heart-grain')).display"), 'none');
    await navigate(base + '?document=starter.md');
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'A little more time');
    assert.equal(await ev("document.getElementById('heart-ornaments').value"), 'plain');
    assert.equal(await ev("document.querySelectorAll('#paper .heart-flourish').length"), 2, 'decoration is reapplied to replacement prose');
    await ev("document.getElementById('heart-ornaments').value='bloom';document.getElementById('heart-ornaments').dispatchEvent(new Event('change',{bubbles:true}));const a=document.getElementById('appearance');a.value='dark';a.dispatchEvent(new Event('change'))");
    assert.equal(await ev('getComputedStyle(document.body).backgroundColor'), 'rgb(36, 35, 30)');
    await ev("document.getElementById('paper').focus();document.getElementById('paper').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))");
    assert.equal(await ev("getComputedStyle(document.getElementById('paper')).columnCount"), '2');
    assert.equal(await ev("getComputedStyle(document.querySelector('.heart-frame')).display"), 'none', 'flow frame does not cross paper columns');
    await ev("document.getElementById('paper').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))");
    assert.notEqual(await ev("getComputedStyle(document.querySelector('.heart-frame')).display"), 'none');
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert(await ev('document.documentElement.scrollWidth <= innerWidth'), 'mobile frame must fit');
    await call('Emulation.setEmulatedMedia', { media: 'print' });
    assert.equal(await ev('getComputedStyle(document.body).backgroundColor'), 'rgb(255, 255, 255)');
    assert.equal(await ev("getComputedStyle(document.querySelector('.heart-frame')).display"), 'none');
    await call('Emulation.setEmulatedMedia', { media: '' });
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
    assert.equal(await ev("getComputedStyle(document.querySelector('.heart-frame')).display"), 'none');
    assert.equal(await ev("getComputedStyle(document.querySelector('.heart-grain')).display"), 'none');
    await call('Emulation.setEmulatedMedia', { features: [] });
    await navigate(pathToFileURL(join(directory, 'index.html')).href);
    assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'Heartfulness');
    assert.equal(await ev("document.querySelectorAll('.heart-corner').length"), 4, 'offline file mode renders ornaments');
    await call('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage denied','SecurityError')}})" });
    await navigate(base);
    await ev("const s=document.getElementById('heart-ornaments');s.value='quiet';s.dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await ev('document.documentElement.dataset.heartOrnaments'), 'quiet', 'denied storage retains session controls');
  } finally { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});

test('Aether variants render native palettes, family navigation, optional plates and bounded replacement prose', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('aether-browser-test-'); let browser, server;
  try {
    const files = new Map();
    for (const template of Object.keys(AETHER_VARIANTS)) {
      const { directory, manifest } = await buildMetaDocument({ output: dir, template });
      for (const path of Object.keys(manifest.files)) files.set(manifest.mount + '/' + path, await readFile(join(directory, path)));
    }
    const requests = [];
    server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost'); requests.push(url.pathname);
      const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      const body = files.get(path);
      res.writeHead(body ? 200 : 404, { 'Content-Type': path.endsWith('.md') ? 'text/markdown' : 'text/html' }); res.end(body || 'Not found');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params = {}) => browser.call(method, params, sessionId);
    const ev = async expression => {
      const r = await call('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression });
      assert.equal(r.exceptionDetails, undefined, JSON.stringify(r.exceptionDetails)); return r.result.value;
    };
    const navigate = async url => { const r = await call('Page.navigate', { url }); assert.equal(r.errorText, undefined); await new Promise(r => setTimeout(r, 250)); };
    await call('Page.enable');
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    for (const [template, variant] of Object.entries(AETHER_VARIANTS)) {
      const base = origin + '/aether/' + variant.slug + '/';
      await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      await navigate(base);
      await ev("const a=document.getElementById('appearance');a.value='system';a.dispatchEvent(new Event('change'))");
      assert.equal(await ev("document.querySelector('#paper h1').textContent"), variant.title);
      assert.equal(await ev('document.documentElement.dataset.template'), template);
      assert.equal(await ev("getComputedStyle(document.querySelector('#paper h1')).fontStyle"), template === 'aether-sun-and-moon' ? 'normal' : 'italic');
      assert.equal(await ev("document.querySelectorAll('.aether-plate').length"), 1);
      assert(await ev("!!document.querySelector('.aether-plate[aria-label] desc')"));
      assert.equal(await ev("document.querySelectorAll('.aether-tail nav a').length"), 3);
      assert(!requests.some(path => path.endsWith('.md')), 'no automatic manuscript request before explicit loading');
      const expected = template === 'aether-blackening' ? 'rgb(29, 26, 32)' : template === 'aether-sun-and-moon' ? 'rgb(240, 238, 229)' : 'rgb(238, 230, 209)';
      assert.equal(await ev('getComputedStyle(document.body).backgroundColor'), expected);
      await ev("document.getElementById('aether-plates').checked=false;document.getElementById('aether-plates').dispatchEvent(new Event('change'))");
      assert.equal(await ev("getComputedStyle(document.querySelector('.aether-art')).display"), 'none');
      requests.length = 0;
      await navigate(base + '?document=starter.md');
      assert.equal(await ev("document.querySelector('#paper h1').textContent"), 'An observation, offered gently');
      assert(await ev("Array.from(document.querySelectorAll('.aether-tail nav a')).every(a=>!a.search)"), 'variant links never carry manuscript URLs');
      assert.equal(await ev("getComputedStyle(document.querySelector('.aether-art')).display"), 'none', 'plate preference survives replacement');
      await ev("document.getElementById('aether-plates').click();document.getElementById('contract-link').click()");
      await new Promise(r => setTimeout(r, 70));
      assert(await ev("document.getElementById('source-provenance').textContent.includes('digest matched')"));
      await ev("document.getElementById('close-inspector').click()");
      await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      assert(await ev('document.documentElement.scrollWidth <= innerWidth'), variant.title + ' narrow viewport');
      await call('Emulation.setEmulatedMedia', { media: 'print' });
      assert.equal(await ev('getComputedStyle(document.body).backgroundColor'), 'rgb(255, 255, 255)');
      await call('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
      await navigate(pathToFileURL(join(dir, 'aether', variant.slug, 'index.html')).href);
      assert.equal(await ev("document.querySelector('#paper h1').textContent"), variant.title, 'standalone file opens offline');
      requests.length = 0;
    }
  } finally { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});

test('keyboard navigation offers flow, desktop spreads, narrow pages, legend and guarded fullscreen', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('markdoc-navigation-'); let browser;
  try {
    const input = join(dir, 'paper.md'), output = join(dir, 'paper.html');
    await writeFile(input, '# Navigation paper\n\n' + Array.from({ length: 70 }, (_, i) => `## Passage ${i + 1}\n\n` + 'Records, evidence and review have separate responsibilities. '.repeat(12)).join('\n\n'));
    await writeFile(output, (await buildStandalone({ input })).html);
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    await browser.call('Page.enable', {}, sessionId);
    await browser.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
    await browser.call('Page.navigate', { url: pathToFileURL(output).href }, sessionId);
    await new Promise(resolve => setTimeout(resolve, 200));
    const run = await browser.call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const $ = id => document.getElementById(id), checks = {}, paper = $('paper');
      const key = (k, more = {}) => paper.dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true, cancelable:true, ...more }));
      paper.focus();
      checks.initialFlow = document.body.dataset.readingMode === 'flow';
      key('ArrowRight');
      checks.paper = document.body.dataset.readingMode === 'paper' && getComputedStyle(paper).columnCount === '2';
      const sheet = document.querySelector('.reading-layout'), sheetStyle = getComputedStyle(sheet);
      checks.continuousPaper = Math.abs(sheet.getBoundingClientRect().top) < 1 && Math.abs(sheet.getBoundingClientRect().height - innerHeight) < 1 && sheetStyle.paddingTop === '0px' && sheetStyle.paddingBottom === '0px';
      checks.paperAtBinding = sheetStyle.backgroundColor === getComputedStyle(document.body).backgroundColor && sheetStyle.filter === 'none';
      checks.noTopBarMask = getComputedStyle($('reading-bar')).backgroundColor === 'rgba(0, 0, 0, 0)';
      checks.a4Measure = Math.abs(sheet.clientWidth / 2 - Math.min(innerWidth / 2, innerHeight * 210 / 297)) < 2;
      checks.realHorizontalMargins = parseFloat(sheetStyle.paddingLeft) >= 24 && parseFloat(getComputedStyle(paper).columnGap) >= 48;
      checks.clippedViewport = getComputedStyle(document.querySelector('.reading-layout')).overflow === 'hidden';
      key('ArrowRight'); checks.next = paper.style.transform !== 'translateX(0px)';
      const second = paper.style.transform;
      key('h'); checks.previous = paper.style.transform === 'translateX(0px)';
      key('L'); checks.vimNext = paper.style.transform === second;
      key('End'); const end = paper.style.transform;
      checks.end = end !== second && $('next-spread').disabled;
      key('Home'); checks.home = paper.style.transform === 'translateX(0px)';
      key('PageDown'); checks.pageNext = paper.style.transform === second;
      key('PageUp'); checks.pagePrevious = paper.style.transform === 'translateX(0px)';
      key('l'); checks.legend = !$('shortcut-legend').hidden && $('legend-shortcuts').textContent.includes('Shift+L');
      key('l'); checks.legendOff = $('shortcut-legend').hidden;
      key('ArrowRight'); key('j'); checks.verticalReturnsFlow = document.body.dataset.readingMode === 'flow' && scrollY > 0 && !paper.style.transform;
      key('Home'); checks.flowHome = scrollY === 0;
      key('PageDown'); checks.flowPageDown = scrollY > 500;
      key('k'); checks.flowUp = document.body.dataset.readingMode === 'flow';
      key('End'); checks.flowEnd = scrollY > 5000;
      key('Home');
      const input = $('url'); input.focus(); input.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowRight', bubbles:true, cancelable:true }));
      checks.typingGuard = document.body.dataset.readingMode === 'flow';
      paper.focus(); key('ArrowRight', {ctrlKey:true}); checks.modifierGuard = document.body.dataset.readingMode === 'flow';
      $('reader-menu').click(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'j',bubbles:true,cancelable:true}));
      checks.modalGuard = document.body.dataset.readingMode === 'flow';
      $('paper-mode').click(); checks.menuMode = document.body.dataset.readingMode === 'paper' && !$('reader-drawer').open;
      checks.menuHelp = $('menu-shortcuts').textContent.includes('PgDn') && $('menu-shortcuts').textContent.includes('fullscreen');
      return checks;
    })()` }, sessionId);
    assert.equal(run.exceptionDetails, undefined, JSON.stringify(run.exceptionDetails));
    for (const [name, value] of Object.entries(run.result.value)) assert.equal(value, true, name);
    await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
    await new Promise(resolve => setTimeout(resolve, 100));
    const narrow = await browser.call('Runtime.evaluate', { returnByValue: true, expression: "getComputedStyle(document.getElementById('paper')).columnCount === '1' && document.documentElement.scrollWidth === innerWidth" }, sessionId);
    assert.equal(narrow.result.value, true, 'single page fits narrow screen');
    await browser.call('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
    const print = await browser.call('Runtime.evaluate', { returnByValue: true, expression: "getComputedStyle(document.getElementById('paper')).columnCount === 'auto' && getComputedStyle(document.getElementById('spread-controls')).display === 'none'" }, sessionId);
    assert.equal(print.result.value, true, 'printing restores continuous document');
    await browser.call('Emulation.setEmulatedMedia', { media: '' }, sessionId);
    await browser.call('Page.bringToFront', {}, sessionId);
    const fullscreen = await browser.call('Runtime.evaluate', { awaitPromise: true, returnByValue: true, userGesture: true, expression: `(async()=>{
      document.getElementById('paper').focus();
      document.getElementById('paper').dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true,cancelable:true}));
      await new Promise(r=>setTimeout(r,150));
      const entered=!!document.fullscreenElement;
      document.getElementById('paper').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      await new Promise(r=>setTimeout(r,150));
      return { entered, exited: !document.fullscreenElement };
    })()` }, sessionId);
    assert.equal(fullscreen.result.value.entered, true, 'f enters actual Fullscreen API with user activation');
    assert.equal(fullscreen.result.value.exited, true, 'Escape exits fullscreen');
    const reflow = await browser.call('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: `(async()=>{
      document.getElementById('paper-mode').click();
      const paper=document.getElementById('paper');paper.focus();
      paper.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
      const wasBeyondFirst=!document.getElementById('previous-spread').disabled;
      paper.innerHTML='<article><h1>Reflow</h1><p>A short passage.</p></article>';
      document.dispatchEvent(new Event('reader-typography-change'));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return {wasBeyondFirst,clamped:document.getElementById('previous-spread').disabled&&paper.style.transform==='translateX(0px)'};
    })()` }, sessionId);
    assert.equal(reflow.exceptionDetails, undefined);
    assert.deepEqual(reflow.result.value, { wasBeyondFirst: true, clamped: true }, 'typography changes remeasure and clamp paper spreads');
  } finally { if (browser) await browser.close(); await rm(dir, { recursive: true, force: true }); }
});

test('introductions retain meaningful links and host-owned SVG figures without granting authored SVG execution', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('markdoc-context-'); let browser;
  try {
    const input = join(dir, 'paper.md'), output = join(dir, 'paper.html');
    const url = 'https://github.com/owner/repo/commit/' + 'a'.repeat(40);
    await writeFile(input, `---\ndocument:\n  entities:\n    - name: WeftMark\n      description: "Engineering evidence, not a SQLite engine. <img onerror=bad>"\n      url: https://github.com/owner/repo\n  figures:\n    - title: "Figure 1: WeftMark"\n      illustration: weftmark\n    - title: "Figure 2: Nostoi"\n      illustration: nostoi\n    - title: "Untrusted"\n      illustration: "<svg onload=bad>"\n---\n# Paper\n\nWeftMark is described here. WeftMark appears again. [SQLite-backed model](${url}).\n\n{% figure title="Figure 1: WeftMark" %}\nThe model is above storage.\n{% /figure %}\n\n{% figure title="Figure 2: Nostoi" %}\nThe checkpoint is not approval.\n{% /figure %}`);
    const built = await buildStandalone({ input }); await writeFile(output, built.html);
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    await browser.call('Page.enable', {}, sessionId);
    await browser.call('Page.navigate', { url: pathToFileURL(output).href }, sessionId);
    await new Promise(resolve => setTimeout(resolve, 250));
    const result = await browser.call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const root = document.getElementById('paper'), entity = root.querySelector('[data-entity]');
      entity.nextElementSibling.querySelector('button').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      const card = document.getElementById('citation-card');
      return {
        firstMentionOnly: root.querySelectorAll('[data-entity]').length === 1,
        explanation: !card.hidden && card.textContent.includes('Engineering evidence, not a SQLite engine.'),
        inert: !card.querySelector('img,script'),
        meaningfulLink: [...root.querySelectorAll('a')].some(a => a.textContent === 'SQLite-backed model' && a.href.includes('/commit/')),
        classified: root.querySelector('.bibliography').textContent.includes('GitHub · Commit aaaaaaa…aaa'),
        figures: root.querySelectorAll('figure.project-card svg[role=img]').length === 2,
        captions: root.querySelectorAll('figure figcaption').length === 2,
        accessible: [...root.querySelectorAll('figure svg')].every(s => s.getAttribute('aria-label').length > 80),
        noScript: !root.querySelector('svg script,svg foreignObject,svg image'),
      };
    })()` }, sessionId);
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    for (const [name, value] of Object.entries(result.result.value)) assert.equal(value, true, name);
  } finally { if (browser) await browser.close(); await rm(dir, { recursive: true, force: true }); }
});

// CDP pipe keeps FileReader on real time (dump-dom virtual time can outrun file
// I/O). This owns one headless process and closes it through its own protocol.
test('all five templates print the whole manuscript without controls, source panes or spread clipping', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('markdoc-print-');
  const browser = headless(executable, join(dir, 'profile'));
  try {
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    const ev = async expression => {
      const result = await browser.call('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression }, sessionId);
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    const source = '# Print specimen\n\n' + Array.from({ length: 100 }, (_, i) => `Paragraph ${i + 1}. A letter has room for a thought to unfold. Keep every word, not just the current screen. A quiet page should remain legible on paper.`).join('\n\n') + '\n\n## Last page\n\nFINAL-MANUSCRIPT-SENTENCE.\n';
    for (const template of ['markdoc-ragbaz-sci-tufte', 'heartfulness', ...Object.keys(AETHER_VARIANTS)]) {
      const { directory } = await buildMetaDocument({ output: dir, template });
      await browser.call('Page.navigate', { url: pathToFileURL(join(directory, 'index.html')).href }, sessionId);
      await ev(`(async()=>{const input=document.getElementById('file'), transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(source)}],'print.md',{type:'text/markdown'}));input.files=transfer.files;input.dispatchEvent(new Event('change'));for(let i=0;i<100;i++){if(document.querySelector('#paper h1')?.textContent==='Print specimen'&&document.getElementById('notice').textContent.startsWith('Locally selected'))return;await new Promise(r=>setTimeout(r,50));}throw Error('Manuscript did not load');})()`);
      await ev("document.documentElement.dataset.appearance='dark';document.getElementById('reader-drawer').showModal();document.getElementById('inspector').hidden=false;document.getElementById('source-raw').textContent='PRIVATE-SOURCE-INSPECTION-ONLY';document.getElementById('source-preview').textContent='PRIVATE-SOURCE-INSPECTION-ONLY';document.body.dataset.readingMode='paper';document.getElementById('paper').style.transform='translateX(-4000px)'");
      await browser.call('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
      const state = await ev(`(()=>{const style=id=>getComputedStyle(document.getElementById(id));return {body:getComputedStyle(document.body).backgroundColor, drawer:style('reader-drawer').display,inspector:style('inspector').display,bar:style('reading-bar').display,transform:style('paper').transform,columns:style('paper').columnCount,overflow:getComputedStyle(document.body).overflow,height:document.getElementById('paper').scrollHeight,screen:innerHeight,text:document.getElementById('paper').textContent}})()`);
      assert.equal(state.body, 'rgb(255, 255, 255)', template);
      for (const key of ['drawer', 'inspector', 'bar']) assert.equal(state[key], 'none', `${template}: ${key}`);
      assert.equal(state.transform, 'none', template); assert.equal(state.columns, 'auto', template); assert.equal(state.overflow, 'visible', template);
      assert(state.height > state.screen * 3, `${template}: long manuscript remains in flow`);
      assert(state.text.includes('FINAL-MANUSCRIPT-SENTENCE.'));
      const { data } = await browser.call('Page.printToPDF', { printBackground: false, displayHeaderFooter: false, preferCSSPageSize: true }, sessionId);
      const pdf = Buffer.from(data, 'base64'), pages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
      assert(pages >= 4 && pages < 30, `${template}: sensible pagination (${pages} pages)`);
      const path = join(dir, `${template}.pdf`); await writeFile(path, pdf);
      const text = spawnSync('pdftotext', [path, '-'], { encoding: 'utf8' });
      if (text.status === 0) {
        assert(text.stdout.includes('FINAL-MANUSCRIPT-SENTENCE.'), `${template}: final page survives PDF output`);
        assert(!text.stdout.includes('PRIVATE-SOURCE-INSPECTION-ONLY'), `${template}: source inspection must not leak to paper`);
        assert(!text.stdout.includes('Document tools'), `${template}: no editor chrome in print`);
      }
      await browser.call('Emulation.setEmulatedMedia', { media: '' }, sessionId);
      assert.equal(await ev('document.documentElement.dataset.appearance'), 'dark', 'print does not change the screen preference');
    }
  } finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }
});

function headless(executable, profile) {
  const child = spawn(executable, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-extensions', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-startup-window', '--password-store=basic', '--host-resolver-rules=EXCLUDE 127.0.0.1, MAP * ~NOTFOUND', `--user-data-dir=${profile}`, '--remote-debugging-pipe'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let id = 0; let buffer = ''; let stderr = '';
  const pending = new Map();
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-8000); });
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.stdio[4].on('data', data => {
    buffer += data;
    let index;
    while ((index = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1);
      const task = pending.get(message.id);
      if (task) { pending.delete(message.id); clearTimeout(task.timer); message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result); }
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const next = ++id;
      const timer = setTimeout(() => { pending.delete(next); reject(new Error(`CDP timeout: ${method} ${stderr}`)); }, process.env.CI ? 60000 : 20000);
      pending.set(next, { resolve, reject, timer });
      child.stdio[3].write(JSON.stringify({ id: next, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  async function call(method, params = {}, sessionId) {
    const result = await send(method, params, sessionId);
    if (method === 'Page.navigate' && !result.errorText) {
      // Await actual bootstrap/render completion, not a fixed fast-host sleep.
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        try {
          const state = await send('Runtime.evaluate', { returnByValue: true, expression: "document.readyState==='complete' && !!document.getElementById('paper') && !!document.getElementById('notice')?.textContent && !document.getElementById('notice').textContent.startsWith('Loading')" }, sessionId);
          if (state.result?.value) return result;
        } catch (error) { if (Date.now() >= deadline) throw error; }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('Reader navigation did not become ready: ' + params.url);
    }
    return result;
  }
  return { call, async close() {
    // Bound cleanup even when Chrome stops answering CDP. Only our exact child
    // may be signalled, after inspecting its PID; never sweep peer browsers.
    void send('Browser.close').catch(() => {});
    const closed = await Promise.race([exited.then(() => true), new Promise(resolve => { const timer = setTimeout(() => resolve(false), 5000); timer.unref(); })]);
    if (!closed && child.exitCode === null && child.signalCode === null) {
      const owned = spawnSync('ps', ['-p', String(child.pid), '-o', 'pid=,args='], { encoding: 'utf8' });
      if (owned.status === 0 && Number(owned.stdout.trim().split(/\s+/)[0]) === child.pid && owned.stdout.includes(`--user-data-dir=${profile}`)) child.kill('SIGKILL');
    }
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('Browser closed')); }
    pending.clear();
  } };
}

const fixture = `---
schema: ragbaz.document/1
document:
  title: Offline paper
sources:
  - id: background
    title: Background snapshot
    url: https://github.com/owner/repo/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/background.md
  - id: missing
    url: ./relative.md
  - id: slow
    url: https://raw.githubusercontent.com/owner/repo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/slow.md
  - id: fast
    url: https://raw.githubusercontent.com/owner/repo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/fast.md
  - id: cors
    url: https://raw.githubusercontent.com/owner/repo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/cors.md
  - id: mismatch
    url: https://raw.githubusercontent.com/owner/repo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/mismatch.md
    integrity:
      algorithm: sha256
      digest: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
      onMismatch: warn-preview
  - id: arxiv
    url: https://arxiv.org/abs/2401.12345v1
---
# Offline paper

{% callout kind="warning" title="Boundary" %}
Proposal, not runtime observation.
{% /callout %}

{% source ref="background" /%}

{% source ref="missing" /%}

{% source ref="slow" /%}

{% source ref="fast" /%}

{% source ref="cors" /%}

{% source ref="mismatch" /%}

{% source ref="arxiv" /%}

<script>window.documentExecuted=true</script>
`;

test('standalone bundle contains complete offline runtime, escaped payload and externally mapped snapshots', async () => {
  const dir = await temporaryDirectory('markdoc-build-');
  try {
    const input = join(dir, 'paper.md'); const output = join(dir, 'paper.html');
    await writeFile(input, fixture);
    await writeFile(join(dir, 'background.md'), '# Background\n\nSnapshot prose.\n\n</script><script>evil()</script>');
    await writeFile(join(dir, 'mapping.json'), JSON.stringify({ background: join(dir, 'background.md') }));
    const built = await buildStandalone({ input, output, snapshots: join(dir, 'mapping.json') });
    assert.equal(await readFile(output, 'utf8'), built.html);
    assert.match(built.html, /<h1 id="section-1">Offline paper/);
    assert.match(built.html, /FileReader/);
    assert.equal(built.html.includes('\\u003c'), true);
    assert.doesNotMatch(built.html, /<script[^>]+src=/);
    assert.doesNotMatch(built.html, /<link[^>]+(?:stylesheet|fonts)/);
    assert.equal(built.payload.snapshots.background.text.includes('Snapshot prose'), true);
    assert.equal(built.payload.snapshots.background.sha256.length, 64);
    assert.equal(built.payload.runtimeSHA256.length, 64);
    assert.equal(built.payload.tuple.noticesSHA256.length, 64);
    assert.match(built.html, /id="software-credits"/);
    for (const name of ['@markdoc/markdoc', 'yaml']) {
      assert.equal(built.html.includes(escapeHTML(await readFile(`node_modules/${name}/LICENSE`, 'utf8'))), true, `Full ${name} LICENSE retained`);
    }
    for (const name of ['markdown-it', 'entities', 'uc.micro', 'mdurl', 'linkify-it', 'punycode']) assert.equal(built.html.includes(`${name} (vendored in Markdoc)`), true);
    assert.match(built.html, /Copyright Joyent, Inc\./);
    assert.match(built.html, /Copyright \(c\) Felix Böhm/);
    assert.match(built.html, /2017\+ Futago-za Ryuu/);
    assert.match(built.html, /yaml 2\.9\.1 \(ISC\)/);
    assert.match(built.html, /No repository\/package redistribution license is declared/);
    assert.match(built.html, /@media print/);
    assert.equal(built.result.usedDialects.length, 1);
    const response = await worker.fetch(new Request('https://surface.example/paper.html'), { ASSETS: { fetch: () => new Response(built.html, { headers: { 'Content-Type': 'text/html' } }) } });
    assert.equal(await response.text(), built.html);
    assert.equal((await worker.fetch(new Request('https://surface.example/'), {})).status, 503);
    assert.equal((await worker.fetch(new Request('https://surface.example/', { method: 'POST' }), {})).status, 405);
    const server = await serveBuiltHTML(output, 0);
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      assert.equal(await (await fetch(origin)).text(), built.html);
      assert.equal((await fetch(origin + '/not-a-proxy')).status, 404);
      assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
      assert.equal((await fetch(origin, { method: 'HEAD' })).headers.get('content-type'), 'text/html; charset=utf-8');
    } finally { await new Promise(resolve => server.close(resolve)); }
    await writeFile(join(dir, 'bad.md'), fixture.replace('title: Offline paper', 'title: Offline paper\n  script: evil()'));
    await assert.rejects(() => buildStandalone({ input: join(dir, 'bad.md') }), /Unsafe data key/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('license inventory refuses missing notices, unreviewed dependencies and declared-but-absent common terms', async () => {
  const inventory = { inputs: { 'node_modules/@markdoc/markdoc/dist/index.mjs': {}, 'node_modules/yaml/browser/index.js': {} } };
  const actual = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const notices = await collectBundleNotices(inventory);
  assert.equal(notices.length, 10);
  await assert.rejects(() => collectBundleNotices({ inputs: { 'node_modules/new-dependency/index.js': {} } }), /Unreviewed bundled license/);
  await assert.rejects(() => collectBundleNotices(inventory, { readText: path => path === 'node_modules/yaml/LICENSE' ? Promise.reject(new Error('missing')) : actual(path) }), /Required bundled LICENSE unavailable/);
  await assert.rejects(() => collectBundleNotices(inventory, { readText: path => path === 'node_modules/yaml/LICENSE' ? Promise.resolve('ISC') : actual(path) }), /Incomplete bundled LICENSE/);
  await assert.rejects(() => collectBundleNotices(inventory, { readText: async path => {
    const text = await actual(path);
    if (!path.endsWith('index.mjs.map')) return text;
    const map = JSON.parse(text); map.sources.push('../node_modules/new-vendored-library/index.js');
    return JSON.stringify(map);
  } }), /vendored license inventory/);
  await assert.rejects(() => collectBundleNotices(inventory, { readText: async path => {
    if (path === 'package.json') return JSON.stringify({ name: '@ragbaz/common', license: 'MIT' });
    return actual(path);
  } }), /Declared common license text unavailable/);
});

test('builder enforces source integrity and only embeds explicitly inert mismatch warnings', async () => {
  const dir = await temporaryDirectory('markdoc-integrity-');
  try {
    const input = join(dir, 'paper.md'); const snapshots = join(dir, 'mapping.json');
    await writeFile(join(dir, 'snapshot.md'), '# Mismatched source');
    await writeFile(snapshots, JSON.stringify({ s: 'snapshot.md' }));
    const source = onMismatch => `---\nsources:\n  - id: s\n    integrity:\n      algorithm: sha256\n      digest: ${'b'.repeat(64)}\n      onMismatch: ${onMismatch}\n---\n# Trusted paper\n\n{% source ref="s" /%}`;
    await writeFile(input, source('refuse'));
    await assert.rejects(() => buildStandalone({ input, snapshots }), /mismatch/);
    await writeFile(input, source('use-verified-cache'));
    await assert.rejects(() => buildStandalone({ input, snapshots }), /cache unavailable/);
    await writeFile(input, source('warn-preview'));
    const built = await buildStandalone({ input, snapshots });
    assert.equal(built.payload.snapshots.s.state, 'unverified');
    assert.equal(built.payload.snapshots.s.expectedSHA256, 'b'.repeat(64));
    assert.doesNotMatch(built.result.html, /Mismatched source/);
    assert.match(built.html, /https:\/\/api.github.com https:\/\/export.arxiv.org/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('cold file:// Chromium: embedded document, snapshot preview, file picker, unsafe source and missing relative assets', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('markdoc-chromium-');
  let browser;
  try {
    const input = join(dir, 'paper.md'); const output = join(dir, 'paper.html');
    await writeFile(input, fixture);
    await writeFile(join(dir, 'background.md'), '# Background\n\nSnapshot prose.');
    await writeFile(join(dir, 'mapping.json'), JSON.stringify({ background: 'background.md' }));
    const built = await buildStandalone({ input, snapshots: join(dir, 'mapping.json') });
    // Test-only host instrumentation; document source cannot add executable script.
    const instrumentation = `<script>
window.networkCalls=0; window.fetch=()=>{window.networkCalls++;return Promise.reject(new Error('offline test'))};
</script>`;
    const smoke = `<script>
(async()=>{
 const wait=()=>new Promise(r=>setTimeout(r,50)); const checks=[];
 await wait();
 checks.push(document.getElementById('paper').textContent.includes('Offline paper'));
 checks.push(!window.documentExecuted);
 document.querySelector('[data-source="background"]').click(); await wait();
 checks.push(document.getElementById('source-preview').textContent.includes('Snapshot prose'));
 checks.push(document.getElementById('source-provenance').textContent.includes('Embedded source snapshot'));
 document.getElementById('close-inspector').click();
 document.querySelector('[data-source="missing"]').click(); await wait();
 checks.push(document.getElementById('source-provenance').textContent.includes('Relative resources are unavailable'));
 document.getElementById('load-source').click(); await wait();
 checks.push(document.getElementById('source-provenance').textContent.includes('unavailable/refused'));
 checks.push(window.networkCalls===0);
 let mockRequests=0;window.fetch=async url=>{
   mockRequests++;
   if(url.endsWith('/cors.md'))throw new TypeError('Mock CORS refusal');
   if(url.endsWith('/slow.md'))await new Promise(r=>setTimeout(r,150));
   return new Response(url.endsWith('/slow.md')?'# Stale old source':'# Current fast source',{headers:{'content-type':'text/markdown'}});
 };
 document.querySelector('[data-source="slow"]').click();document.getElementById('load-source').click();
 document.querySelector('[data-source="fast"]').click();document.getElementById('load-source').click();
 await new Promise(r=>setTimeout(r,250));
 checks.push(document.getElementById('source-preview').textContent.includes('Current fast source')&&!document.getElementById('source-preview').textContent.includes('Stale old source'));
 document.querySelector('[data-source="cors"]').click();document.getElementById('load-source').click();await wait();
 checks.push(document.getElementById('source-provenance').textContent.includes('Mock CORS refusal'));
  checks.push(mockRequests===3);
  window.fetch=async()=>new Response('# Untrusted **not rendered** <script>window.mismatchExecuted=true<'+ '/script>',{headers:{'content-type':'text/markdown'}});
  document.querySelector('[data-source="mismatch"]').click();document.getElementById('load-source').click();await wait();
  checks.push(document.getElementById('source-provenance').textContent.includes('UNVERIFIED'));
  checks.push(!document.querySelector('#source-preview h1')&&!window.mismatchExecuted);
  checks.push(document.getElementById('paper').textContent.includes('Offline paper'));
  window.fetch=async url=>{
    if(url.startsWith('https://api.github.com/')){
      await new Promise(r=>setTimeout(r,80));const base='a'.repeat(40),candidate='b'.repeat(40);
      const value=url.includes('/compare/')?{base_commit:{sha:base},merge_base_commit:{sha:candidate},url:'https://api.github.com/repos/owner/repo/compare/'+base+'...'+candidate,status:'behind',ahead_by:0,behind_by:2}:url.includes('?')?[{sha:candidate}]:{default_branch:'main'};
      return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
    }
    return new Response('<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2401.12345v3</id></entry></feed>',{headers:{'content-type':'application/atom+xml'}});
  };
  document.querySelector('[data-source="background"]').click();await wait();
  checks.push(!document.getElementById('check-updates').hidden);
  document.getElementById('check-updates').click();await new Promise(r=>setTimeout(r,350));
  checks.push(document.getElementById('source-updates').textContent.includes('"status": "unknown"')&&document.getElementById('source-updates').textContent.includes('"kind": "ancestor"'));
  document.getElementById('check-updates').click();
  document.querySelector('[data-source="arxiv"]').click();document.getElementById('check-updates').click();await wait();
  checks.push(document.getElementById('source-updates').textContent.includes('"status": "latest"'));
  await new Promise(r=>setTimeout(r,350));
  checks.push(document.getElementById('source-updates').textContent.includes('"provider": "arxiv"')&&document.getElementById('source-revision').textContent.includes('2401.12345v1'));
  document.querySelector('[data-source="missing"]').click();
  checks.push(document.getElementById('check-updates').hidden);
 const dt=new DataTransfer();dt.items.add(new File(['# Selected local\\n\\n<script>window.fileExecuted=true<'+ '/script>\\n\\n![tracker](https://evil.example/t)'], 'selected.md',{type:'text/markdown'}));
 const input=document.getElementById('file');input.files=dt.files;input.dispatchEvent(new Event('change'));
 for(let i=0;i<60&&!document.getElementById('paper').textContent.includes('Selected local');i++)await wait();
 checks.push(document.getElementById('paper').textContent.includes('Selected local'));
 checks.push(document.getElementById('notice').textContent.includes('Locally selected / unpublished'));
 checks.push(!window.fileExecuted);
 checks.push(!document.querySelector('#paper img'));
 checks.push(window.networkCalls===0);
 const done=document.createElement('div');done.id='smoke-result';done.textContent=checks.every(Boolean)?'PASS '+checks.length:'FAIL '+JSON.stringify(checks)+' '+document.getElementById('notice').textContent+' '+document.getElementById('paper').textContent;document.body.appendChild(done);
})().catch(e=>{document.body.insertAdjacentText('beforeend','SMOKE ERROR '+e.message)});
</script>`;
    await writeFile(output, built.html.replace('<script id="payload"', instrumentation + '<script id="payload"'));
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    await browser.call('Page.enable', {}, sessionId);
    await browser.call('Page.navigate', { url: pathToFileURL(output).href }, sessionId);
    await new Promise(resolve => setTimeout(resolve, 150));
    const run = await browser.call('Runtime.evaluate', { expression: smoke.replace(/^<script>/, '').replace(/<\/script>$/, ''), awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(run.exceptionDetails, undefined, JSON.stringify(run.exceptionDetails));
    const result = await browser.call('Runtime.evaluate', { expression: "document.getElementById('smoke-result')?.textContent", returnByValue: true }, sessionId);
    assert.equal(result.result.value, 'PASS 23');
  } finally { if (browser) await browser.close(); await rm(dir, { recursive: true, force: true }); }
});

test('document checks follow active UTF-8 bytes, expose inert source and retain the document on invalid file input', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('markdoc-document-checks-'); let browser;
  try {
    const input = join(dir, 'paper.md'), output = join(dir, 'paper.html');
    const source = '# Check me\n\n{% source ref="missing" /%}\n\n<script>window.inspectedScript=true</script>';
    await writeFile(input, source);
    const built = await buildStandalone({ input, output });
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    await browser.call('Page.enable', {}, sessionId);
    await browser.call('Emulation.setDeviceMetricsOverride', { width: 320, height: 700, deviceScaleFactor: 1, mobile: true }, sessionId);
    const ev = async expression => {
      const result = await browser.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    await browser.call('Page.navigate', { url: pathToFileURL(output).href }, sessionId);
    assert(await ev("(async()=>{for(let i=0;i<100&&document.getElementById('inspect-document')?.disabled;i++)await new Promise(r=>setTimeout(r,25));return !document.getElementById('inspect-document')?.disabled})()"));
    assert.match(await ev("document.getElementById('document-check-status').textContent"), /Partial \/ refused markup/);
    assert.match(await ev("document.getElementById('document-diagnostics').textContent"), /Unknown source/);
    assert.equal(await ev("document.getElementById('document-digest').textContent"), 'Current Markdown SHA-256: ' + built.payload.sha256);
    await ev("document.getElementById('reader-menu').click();document.getElementById('document-checks').open=true");
    assert(await ev("document.getElementById('reader-drawer').scrollWidth <= document.getElementById('reader-drawer').clientWidth"), 'digest fits a 320px drawer');
    await ev("document.getElementById('inspect-document').click()");
    assert.equal(await ev("document.getElementById('source-preview').textContent"), source);
    assert(await ev("!window.inspectedScript && !document.querySelector('#source-preview script') && document.getElementById('load-source').hidden && document.getElementById('check-updates').hidden"));
    assert(await ev("document.activeElement.id === 'close-inspector'"));
    const local = '\ufeff# Local åäö\r\n\r\nExact bytes.\r\n';
    await ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(local)}],'local.md'));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'))})()`);
    assert(await ev("(async()=>{for(let i=0;i<100&&!document.getElementById('paper').textContent.includes('Local åäö');i++)await new Promise(r=>setTimeout(r,25));return document.getElementById('paper').textContent.includes('Local åäö')})()"));
    const digest = createHash('sha256').update(local).digest('hex');
    assert.equal(await ev("document.getElementById('document-digest').textContent"), 'Current Markdown SHA-256: ' + digest, 'BOM and CRLF contribute to the exact digest');
    assert.match(await ev("document.getElementById('document-check-status').textContent"), /No rendering diagnostics/);
    assert.equal(await ev("document.getElementById('document-diagnostics').childElementCount"), 0);
    await ev("(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([255,254,65])],'bad.md'));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'))})()");
    assert(await ev("(async()=>{for(let i=0;i<100&&!document.getElementById('notice').textContent.includes('invalid UTF-8');i++)await new Promise(r=>setTimeout(r,25));return document.getElementById('notice').textContent.includes('invalid UTF-8')})()"));
    assert(await ev("document.getElementById('paper').textContent.includes('Local åäö')"));
    assert.equal(await ev("document.getElementById('document-digest').textContent"), 'Current Markdown SHA-256: ' + digest);
    await ev("document.getElementById('original').click()");
    assert(await ev("(async()=>{for(let i=0;i<100&&!document.getElementById('paper').textContent.includes('Check me');i++)await new Promise(r=>setTimeout(r,25));return document.getElementById('paper').textContent.includes('Check me')})()"));
    assert.equal(await ev("document.getElementById('document-digest').textContent"), 'Current Markdown SHA-256: ' + built.payload.sha256);
  } finally { if (browser) await browser.close(); await rm(dir, { recursive: true, force: true }); }
});

test('quiet reader hides tools by default, retains accessible controls and requires drop opt-in', async t => {
  const executable = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(path => spawnSync('test', ['-x', path]).status === 0);
  if (!executable) { t.skip('No headless Chromium installed'); return; }
  const dir = await temporaryDirectory('markdoc-quiet-');
  let browser;
  try {
    const input = join(dir, 'paper.md'); const output = join(dir, 'paper.html');
    await writeFile(input, '---\ndocument:\n  title: Quiet paper\n  authorSummary: Tobias Abenius, ChatGPT et al.\n  authors:\n    - name: Tobias Abenius\n    - name: OpenAI GPT-6.1 Sol\n  manuscript:\n    received: "2026-10-15"\nsources:\n  - id: evidence\n    title: Test evidence\n    url: https://github.com/owner/repo/blob/' + 'a'.repeat(40) + '/README.md\nassets:\n  - id: repo\n    role: repository\n    url: https://github.com/owner/repo\n---\n# Quiet paper\n\nReading comes first. {% source ref="evidence" /%} Again {% source ref="evidence" /%}\n\n`' + 'a'.repeat(240) + '`');
    const built = await buildStandalone({ input });
    await writeFile(output, built.html);
    browser = headless(executable, join(dir, 'profile'));
    const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
    await browser.call('Page.enable', {}, sessionId);
    await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
    await browser.call('Page.navigate', { url: pathToFileURL(output).href }, sessionId);
    await new Promise(resolve => setTimeout(resolve, 150));
    const run = await browser.call('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const $ = id => document.getElementById(id), checks = {};
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const drawer = $('reader-drawer'), bar = $('reading-bar'), menu = $('reader-menu');
      checks.closed = !drawer.open && menu.getAttribute('aria-expanded') === 'false';
      checks.onlyBar = !document.querySelector('.masthead,.reader-tools') && $('paper').getBoundingClientRect().top < 90;
      checks.toolsInDrawer = ['file','url-form','notice','software-credits','enable-drop'].every(id => drawer.contains($(id)));
      checks.contentsSeparate = $('toc-panel').contains($('toc')) && $('toc-panel').hidden;
      checks.menuRight = menu.getBoundingClientRect().left > innerWidth / 2;
      checks.noDivider = getComputedStyle(bar).borderBottomWidth === '0px';
      checks.assetsInDrawer = $('asset-details').textContent.includes('Repository:') && !$('paper').textContent.includes('Repository:');
      checks.dropOff = !$('enable-drop').checked;
      const marks = document.querySelectorAll('#paper sup.citation button');
      checks.numericReferences = marks.length === 2 && [...marks].every(m => m.textContent === '1');
      checks.tightCitation = marks[0].parentElement.previousSibling.textContent.endsWith('first.');
      checks.noCitationPadding = getComputedStyle(marks[0]).paddingLeft === '0px' && getComputedStyle(marks[0]).minWidth === '0px';
      checks.citationHitTarget = getComputedStyle(marks[0], '::after').minWidth === '18px';
      checks.bibliographyDeduplicated = document.querySelectorAll('.bibliography li').length === 1;
      marks[0].dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      checks.hoverReference = !$('citation-card').hidden && $('citation-body').textContent.includes('Test evidence');
      $('close-citation').click();
      checks.referenceFocusReturns = document.activeElement === marks[0];
      const authors = document.querySelector('.manuscript-authors');
      checks.compactAuthors = !authors.open && authors.querySelector('summary').textContent.includes('ChatGPT et al.');
      authors.querySelector('summary').click();
      checks.expandedAuthors = authors.open && authors.textContent.includes('OpenAI GPT-6.1 Sol');
      document.querySelector('.manuscript-dates').click();
      checks.revisionsOpen = drawer.open && $('revision-history').open && $('revision-list').textContent.includes('Publication pending');
      $('close-drawer').click(); $('paper').focus();
      $('toc-handle').click();
      checks.tocOpens = !$('toc-panel').hidden && $('toc-handle').getAttribute('aria-expanded') === 'true';
      $('close-toc').click();
      checks.tocCloses = $('toc-panel').hidden;
      await wait(1900);
      checks.idleHides = bar.classList.contains('toolbar-hidden');
      $('reveal-tools').click();
      checks.touchReveal = !bar.classList.contains('toolbar-hidden');
      menu.focus(); menu.click();
      checks.opens = drawer.open && menu.getAttribute('aria-expanded') === 'true';
      checks.focusContained = drawer.contains(document.activeElement);
      checks.mobileFits = drawer.getBoundingClientRect().width <= innerWidth;
      checks.noHorizontalOverflow = innerWidth === 390 && document.documentElement.scrollWidth <= innerWidth;
      $('paper').focus();
      checks.modalTrap = drawer.contains(document.activeElement);
      drawer.dispatchEvent(new Event('cancel', { cancelable: true }));
      checks.escapeRestores = !drawer.open && document.activeElement === menu && menu.getAttribute('aria-expanded') === 'false';
      const dt = new DataTransfer(); dt.items.add(new File(['# Dropped document'], 'drop.md', { type: 'text/markdown' }));
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true }));
      await wait(100);
      checks.disabledDropInert = $('paper').textContent.includes('Quiet paper');
      menu.click(); $('enable-drop').click();
      document.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, cancelable: true }));
      checks.enabledDropFeedback = document.body.classList.contains('dragging');
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, cancelable: true }));
      for (let n = 0; n < 40 && !$('paper').textContent.includes('Dropped document'); n++) await wait(50);
      checks.enabledDropLoads = $('paper').textContent.includes('Dropped document');
      checks.loadReturnsToPaper = !drawer.open && document.activeElement === $('paper');
      checks.feedbackClears = !document.body.classList.contains('dragging');
      await wait(1900);
      checks.hidesAfterLoad = bar.classList.contains('toolbar-hidden');
      menu.focus();
      checks.keyboardReveal = !bar.classList.contains('toolbar-hidden');
      menu.click();
      checks.controlsStayWhileOpen = drawer.open && !bar.classList.contains('toolbar-hidden');
      return checks;
    })()` }, sessionId);
    assert.equal(run.exceptionDetails, undefined, JSON.stringify(run.exceptionDetails));
    for (const [name, passed] of Object.entries(run.result.value)) assert.equal(passed, true, name);
    await browser.call('Page.bringToFront', {}, sessionId); // Test-owned headless target only.
    await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, sessionId);
    await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, sessionId);
    await new Promise(resolve => setTimeout(resolve, 100));
    const escaped = await browser.call('Runtime.evaluate', { expression: "!document.getElementById('reader-drawer').open && document.activeElement.id === 'reader-menu'", returnByValue: true }, sessionId);
    assert.equal(escaped.result.value, true, 'real Escape closes dialog and restores focus');
    await browser.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await browser.call('Page.navigate', { url: pathToFileURL(output).href }, sessionId);
    await new Promise(resolve => setTimeout(resolve, 250));
    const laptop = await browser.call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const mark = document.querySelector('[data-citation]'), card = document.getElementById('citation-card');
      mark.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      const margin = document.body.dataset.citationMode === 'margin' && !card.hidden && card.getBoundingClientRect().left > document.getElementById('paper').getBoundingClientRect().right;
      const select = document.getElementById('citation-mode'); select.value = 'wide'; select.dispatchEvent(new Event('change'));
      return { margin, wide: document.body.dataset.citationMode === 'wide', fits: card.getBoundingClientRect().right <= innerWidth, rightDrawer: getComputedStyle(document.getElementById('reader-drawer')).right === '0px' };
    })()` }, sessionId);
    for (const [name, passed] of Object.entries(laptop.result.value)) assert.equal(passed, true, name);
  } finally { if (browser) await browser.close(); await rm(dir, { recursive: true, force: true }); }
});
