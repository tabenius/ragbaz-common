#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildStandalone } from './build-markdoc-ragbaz.mjs';
import { ILLUSTRATIONS } from '../demo/markdoc-ragbaz/figures.js';
import { BOTANICALS } from '../demo/markdoc-ragbaz/heartfulness.js';
import { AETHER_VARIANTS, AETHER_PLATES } from '../demo/markdoc-ragbaz/aether.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const META_MOUNT = '/markdoc-ragbaz-sci-tufte';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Build a static, content-neutral package. No network, secrets or deployment. */
export async function buildMetaDocument({ output = resolve(root, 'dist-meta'), template = 'markdoc-ragbaz-sci-tufte' } = {}) {
  if (!['markdoc-ragbaz-sci-tufte', 'heartfulness', ...Object.keys(AETHER_VARIANTS)].includes(template)) throw new Error('Unsupported installed meta-template');
  const heart = template === 'heartfulness';
  const aether = AETHER_VARIANTS[template];
  const mount = aether ? `/aether/${aether.slug}` : heart ? '/heartfulness' : META_MOUNT;
  const companion = aether ? 'aether' : heart ? 'heartfulness' : 'meta';
  const title = aether ? aether.title : heart ? 'Heartfulness' : template;
  const directory = resolve(output, mount.slice(1));
  await mkdir(resolve(directory, 'assets'), { recursive: true });
  const contract = await readFile(resolve(root, 'docs/MARKDOC-RAGBAZ.md'));
  const config = JSON.parse(await readFile(resolve(root, 'demo/markdoc-ragbaz/registry.json'), 'utf8'));
  config.metaDocument = { id: template, version: 1 };
  config.fontAlternatives = 'google-curated/1';
  const introduction = aether ? (await readFile(resolve(root, `demo/markdoc-ragbaz/aether/${aether.slug}.md`), 'utf8')).trim() : heart
    ? '*A small press for tender things.*\n\nAn ornamental reading room, waiting for your words.\n\nA little romance; a little weathering. Cream paper, climbing stems, and room to breathe.\n\n## A place to begin\n\nBring a letter, an essay, a memory, a recipe. Open your Markdown from the menu, or try `?document=starter.md`. The words remain yours; the flowers are optional.\n\n## The garden gate\n\nChoose **Plain**, **A little**, or **Full bloom** in Document tools. Keep the paper grain, or smooth it away. This is a first proof, not a period reconstruction.\n\n*Mix, knead, bake, taste. Repeat.*'
    : 'A publication surface, ready for your document.\n\nOpen a Markdown file from the menu, or supply a permitted Markdown URL with\n`?document=…`. A source can also be pinned with `&sha256=…`.';
  const templateSource = `---\nschema: ragbaz.document/1\ndocument:\n  title: ${title}\ndialects: [paper@1, plan@1, models@1]\nsettings:\n  theme: paper@1\nsources:\n  - id: rendering-contract\n    title: markdoc-ragbaz rendering contract\n    url: '${mount}/markdoc-ragbaz.md'\n    sha256: '${hash(contract)}'\n---\n\n# ${title}\n\n${introduction}\n`;
  const files = {
    'template.md': templateSource,
    'surface.json': JSON.stringify(config, null, 2) + '\n',
    'snapshots.json': JSON.stringify({ 'rendering-contract': 'markdoc-ragbaz.md' }, null, 2) + '\n',
    'markdoc-ragbaz.md': contract,
    'starter.md': await readFile(resolve(root, `demo/markdoc-ragbaz/${companion}/starter.md`)),
    'README.md': await readFile(resolve(root, `demo/markdoc-ragbaz/${companion}/README.md`)),
  };
  for (const [name, content] of Object.entries(files)) await writeFile(resolve(directory, name), content);
  const built = await buildStandalone({ input: resolve(directory, 'template.md'), output: resolve(directory, 'index.html'), config: resolve(directory, 'surface.json'), snapshots: resolve(directory, 'snapshots.json') });
  if (built.result.diagnostics.length) throw new Error(`Template refused: ${built.result.diagnostics.join('; ')}`);
  files['index.html'] = built.html;
  files['assets/reader.js'] = built.assets.runtime;
  files['assets/reader.css'] = built.assets.styles;
  files['LICENSES.txt'] = built.assets.credits;
  for (const [name, svg] of Object.entries(ILLUSTRATIONS)) files[`assets/${name}.svg`] = svg;
  if (heart) for (const [name, svg] of Object.entries(BOTANICALS)) files[`assets/${name}.svg`] = svg;
  if (aether) files['assets/symbolic-plate.svg'] = AETHER_PLATES[template];
  for (const [name, content] of Object.entries(files)) await writeFile(resolve(directory, name), content);
  const manifest = { schema: 'ragbaz.meta-document/1', id: template, mount, runtimeSHA256: built.payload.runtimeSHA256, renderSHA256: built.payload.renderSHA256, files: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, { sha256: hash(content), bytes: Buffer.byteLength(content) }])) };
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { directory, manifest, built };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--output': 'output', '--template': 'template' }[args[i]];
    if (!key || !args[i + 1] || options[key]) throw new Error('Usage: node scripts/build-markdoc-ragbaz-sci-tufte.mjs [--output directory] [--template installed-template-id]');
    options[key] = args[i + 1];
  }
  const { directory } = await buildMetaDocument(options);
  console.log(`Built content-neutral meta-document: ${directory}`);
}
