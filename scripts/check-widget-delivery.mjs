import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(await readFile('delivery/widgets.json', 'utf8'));
const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const entry = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
const files = new Set(entry.files.map(file => file.path));
for (const [path, expected] of Object.entries(manifest.files)) {
  if (!files.has(path)) throw Error(`Shared widget file is missing from npm delivery: ${path}`);
  const actual = createHash('sha256').update(await readFile(path)).digest('hex');
  if (actual !== expected) throw Error(`Shared widget file no longer matches delivery manifest: ${path}`);
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
console.log(`Verified ${Object.keys(manifest.files).length} shared widget files in npm delivery at ${commit}`);
