// A stand-in for Cloudflare D1 on top of Node's built-in SQLite, with the same calls the app uses.
import { DatabaseSync } from 'node:sqlite';
export function makeD1() {
  const sqlite = new DatabaseSync(':memory:');
  return {
    prepare(sql) {
      let params = [];
      const st = { bind(...p) { params = p; return st; },
        async first() { return sqlite.prepare(sql).get(...params) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...params) }; },
        async run() { const info = sqlite.prepare(sql).run(...params); return { meta: { changes: Number(info.changes) } }; } };
      return st;
    },
  };
}
