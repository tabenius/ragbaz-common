const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
(async () => {
  const file = process.argv[2];
  assert.ok(file, 'Expected standalone HTML path');
  assert.ok(readFileSync(file, 'utf8').includes('OrbitControls'), 'Missing bundled orbit controls');
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort('internetdisconnected'));
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      svg: document.querySelectorAll('svg').length,
      text: document.body.innerText,
      interactive: document.querySelectorAll('[data-visualization], .visualization-interactive').length
    }));
    assert.ok(result.text.includes('torus') && result.text.includes('platform'), 'Missing scene or CAD content');
    assert.ok(result.svg >= 2, 'Missing static SVG fallback');
    assert.ok(result.canvas >= 2, 'Interactive geometry canvases did not mount: ' + JSON.stringify(result));
    assert.deepEqual(errors, [], 'Browser page errors');
    console.log('Offline Chromium geometry smoke test passed', JSON.stringify({ canvas: result.canvas, svg: result.svg, interactive: result.interactive }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
