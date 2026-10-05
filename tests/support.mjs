// A minimal D1-shaped wrapper over real SQLite.
//
// Tests use this instead of a stub so triggers, foreign keys, CHECK constraints
// and json_valid() are genuinely exercised. A stub would let the invariant tests
// pass without proving anything.
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function loadSchema(prefix = 'gift') {
  const url = new URL('../schema.sql', import.meta.url);
  const { prefixSchema } = await import('../scripts/prefix-migration.mjs');
  return prefixSchema(await readFile(fileURLToPath(url), 'utf8'), prefix);
}

export class SqliteD1 {
  constructor(sql) {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(sql);
  }
  prepare(sql) {
    const db = this.db;
    let values = [];
    const statement = {
      bind(...args) { values = args; return statement; },
      async first() { return db.prepare(sql).get(...values) ?? null; },
      async all() { return { results: db.prepare(sql).all(...values) }; },
      async run() {
        const result = db.prepare(sql).run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return statement;
  }
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  /** Direct access for assertions about triggers and constraints. */
  get raw() { return this.db; }
}
