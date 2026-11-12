/**
 * The Redis commands this app uses, on Cloudflare D1 (Cloudflare's built-in SQL database; works with Cloudflare Pages).
 * Every command is one atomic SQL statement (or a single "upsert"), so counters like "spend 1 credit" cannot be raced.
 * Supported: GET, SET (EX, NX), DEL, INCR, DECR, INCRBY, DECRBY, EXPIRE, SADD, SREM, SMEMBERS.
 * `db` is the D1 binding (db.prepare(sql).bind(...).first() / .all() / .run()); tests use a small SQLite shim.
 * Tables are created automatically on first use.
 */
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, e INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS kvs (k TEXT NOT NULL, m TEXT NOT NULL, PRIMARY KEY (k, m))',
];
const ready = new WeakSet();

async function ensureSchema(db) {
  if (ready.has(db)) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  ready.add(db);
}

export async function executeCommandD1(db, args, now = Date.now()) {
  await ensureSchema(db);
  const [name, key, ...rest] = args.map(String);
  const cmd = name.toUpperCase();
  const first = (sql, ...p) => db.prepare(sql).bind(...p).first();
  const run = (sql, ...p) => db.prepare(sql).bind(...p).run();

  // now and then, remove expired values (they are ignored anyway when read)
  if (Math.random() < 0.01) await run('DELETE FROM kv WHERE e <> 0 AND e <= ?1', now).catch(() => {});

  switch (cmd) {
    case 'GET': {
      const row = await first('SELECT v FROM kv WHERE k = ?1 AND (e = 0 OR e > ?2)', key, now);
      return row ? String(row.v) : null;
    }
    case 'SET': {
      const [value, ...opts] = rest;
      let ex = 0; let nx = false;
      for (let i = 0; i < opts.length; i += 1) {
        const o = opts[i].toUpperCase();
        if (o === 'NX') nx = true;
        else if (o === 'EX') { ex = Number(opts[i + 1]); i += 1; }
      }
      const e = ex > 0 ? now + ex * 1000 : 0;
      if (nx) { // only if there is no live value: an expired one counts as missing
        const row = await first(
          'INSERT INTO kv (k, v, e) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = excluded.v, e = excluded.e WHERE kv.e <> 0 AND kv.e <= ?4 RETURNING k',
          key, value, e, now);
        return row ? 'OK' : null;
      }
      await run('INSERT INTO kv (k, v, e) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = excluded.v, e = excluded.e', key, value, e);
      return 'OK';
    }
    case 'DEL': {
      const row = await first('DELETE FROM kv WHERE k = ?1 RETURNING e', key);
      const live = row && (row.e === 0 || row.e > now);
      const setRows = await db.prepare('DELETE FROM kvs WHERE k = ?1').bind(key).run();
      return live || (setRows?.meta?.changes || 0) > 0 ? 1 : 0;
    }
    case 'INCR': case 'DECR': case 'INCRBY': case 'DECRBY': {
      const step = cmd === 'INCR' ? 1 : cmd === 'DECR' ? -1 : cmd === 'INCRBY' ? Number(rest[0]) : -Number(rest[0]);
      if (!Number.isInteger(step)) throw new Error('ERR value is not an integer or out of range');
      const row = await first(
        `INSERT INTO kv (k, v, e) VALUES (?1, CAST(CAST(?2 AS INTEGER) AS TEXT), 0)
         ON CONFLICT(k) DO UPDATE SET
           v = CASE WHEN kv.e <> 0 AND kv.e <= ?3 THEN CAST(CAST(?2 AS INTEGER) AS TEXT) ELSE CAST(CAST(kv.v AS INTEGER) + CAST(?2 AS INTEGER) AS TEXT) END,
           e = CASE WHEN kv.e <> 0 AND kv.e <= ?3 THEN 0 ELSE kv.e END
         RETURNING v`, key, step, now);
      return Number(row.v);
    }
    case 'EXPIRE': {
      const row = await first('UPDATE kv SET e = ?1 WHERE k = ?2 AND (e = 0 OR e > ?3) RETURNING k', now + Number(rest[0]) * 1000, key, now);
      return row ? 1 : 0;
    }
    case 'SADD': {
      let added = 0;
      for (const m of rest) added += (await run('INSERT OR IGNORE INTO kvs (k, m) VALUES (?1, ?2)', key, m))?.meta?.changes || 0;
      return added;
    }
    case 'SREM': {
      let removed = 0;
      for (const m of rest) removed += (await run('DELETE FROM kvs WHERE k = ?1 AND m = ?2', key, m))?.meta?.changes || 0;
      return removed;
    }
    case 'SMEMBERS': {
      const { results } = await db.prepare('SELECT m FROM kvs WHERE k = ?1 ORDER BY rowid').bind(key).all();
      return (results || []).map((r) => r.m);
    }
    default:
      throw new Error(`ERR unknown command '${cmd}'`);
  }
}
