#!/usr/bin/env node
// Produce a table-prefixed migration from schema.sql.
//
// Two deployments that share a database must not share table names, and a
// deployment that adopts this package later should be able to diff the result
// against what it already has. Substituting an explicit prefix at migration time
// keeps one reviewed baseline instead of a fork per deployment.
//
//   node scripts/prefix-migration.mjs gift schema.sql out.sql
//   node scripts/prefix-migration.mjs gift schema.sql > migrations/0001.sql

import { readFile, writeFile } from 'node:fs/promises';
import { argv } from 'node:process';

const PREFIX = /^[a-z][a-z0-9_]{0,15}$/;

export function prefixSchema(sql, prefix) {
  if (!PREFIX.test(prefix)) throw new Error('Prefix must be a short lowercase identifier');
  const output = sql.replace(/\{P\}([a-z0-9_]+)/g, `${prefix}_$1`).replace(/idx_\{P\}/g, `idx_${prefix}_`);
  if (output.includes('{P}')) throw new Error('Unsubstituted placeholder remains');
  return output;
}

async function main() {
  const [prefix, schemaPath, outPath] = argv.slice(2);
  if (!prefix || !schemaPath) {
    process.stderr.write('Usage: node scripts/prefix-migration.mjs <prefix> <schema.sql> [out.sql]\n');
    process.exit(1);
  }
  const sql = prefixSchema(await readFile(schemaPath, 'utf8'), prefix);
  if (outPath) await writeFile(outPath, sql);
  else process.stdout.write(sql);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) await main();
