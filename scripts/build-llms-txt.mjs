#!/usr/bin/env node
// Generate llms.txt from a content manifest.
//
//   node scripts/build-llms-txt.mjs --manifest site.json --out public/llms.txt
//   node scripts/build-llms-txt.mjs --check site.json          # CI: fail on drift
//
// The manifest is JSON so a build script, a Worker route and a hand-written
// file all produce the same bytes. `--check` is the point: a hand-maintained
// llms.txt drifts, and CI is cheaper than an agent following a dead link.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import { renderLlmsTxt, validateManifest } from '../src/content/index.js';

function parseArgs(argv) {
  const args = { check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.manifest) throw new Error('usage: build-llms-txt.mjs --manifest <file> [--out <file>] [--check]');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = resolve(args.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  const problems = validateManifest(manifest);
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`invalid manifest: ${problem}\n`);
    process.exitCode = 1;
    return;
  }

  const text = renderLlmsTxt(manifest);

  if (!args.out) {
    process.stdout.write(text);
    return;
  }

  const outPath = resolve(args.out);
  if (args.check) {
    let existing = '';
    try {
      existing = await readFile(outPath, 'utf8');
    } catch {
      existing = '';
    }
    if (existing !== text) {
      process.stderr.write(`llms.txt is out of date: ${outPath}\nRegenerate with --out ${outPath}\n`);
      process.exitCode = 1;
      return;
    }
    process.stderr.write(`llms.txt is current: ${outPath}\n`);
    return;
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, text, 'utf8');
  process.stderr.write(`wrote ${outPath} (${Buffer.byteLength(text)} bytes)\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
