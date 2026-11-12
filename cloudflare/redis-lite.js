/**
 * The few Redis commands this app uses, on top of a key-value storage with async get / put / delete
 * (a Cloudflare Durable Object's storage). Pure JavaScript, so it is tested in Node (tests/redis-lite.test.mjs).
 * Supported: GET, SET (EX, NX), DEL, INCR, DECR, INCRBY, DECRBY, EXPIRE, SADD, SREM, SMEMBERS.
 * Each value is stored as { v: <string | array>, e: <expiry in ms, 0 = never> }; expired values are removed when touched.
 */
async function load(storage, key, now) {
  const entry = await storage.get(key);
  if (!entry) return null;
  if (entry.e && entry.e <= now) { await storage.delete(key); return null; }
  return entry;
}

export async function executeCommand(storage, args, now = Date.now()) {
  const [name, key, ...rest] = args.map(String);
  const cmd = name.toUpperCase();

  switch (cmd) {
    case 'GET': {
      const e = await load(storage, key, now);
      return typeof e?.v === 'string' ? e.v : null;
    }
    case 'SET': {
      const [value, ...opts] = rest;
      let ex = 0; let nx = false;
      for (let i = 0; i < opts.length; i += 1) {
        const o = opts[i].toUpperCase();
        if (o === 'NX') nx = true;
        else if (o === 'EX') { ex = Number(opts[i + 1]); i += 1; }
      }
      if (nx && (await load(storage, key, now))) return null;
      await storage.put(key, { v: value, e: ex > 0 ? now + ex * 1000 : 0 });
      return 'OK';
    }
    case 'DEL': {
      const had = await load(storage, key, now);
      if (had) await storage.delete(key);
      return had ? 1 : 0;
    }
    case 'INCR': case 'DECR': case 'INCRBY': case 'DECRBY': {
      const step = cmd === 'INCR' ? 1 : cmd === 'DECR' ? -1 : cmd === 'INCRBY' ? Number(rest[0]) : -Number(rest[0]);
      const cur = await load(storage, key, now);
      const n = cur ? Number(cur.v) : 0;
      if (!Number.isInteger(n) || !Number.isInteger(step)) throw new Error('ERR value is not an integer or out of range');
      const next = n + step;
      await storage.put(key, { v: String(next), e: cur?.e || 0 });
      return next;
    }
    case 'EXPIRE': {
      const cur = await load(storage, key, now);
      if (!cur) return 0;
      await storage.put(key, { ...cur, e: now + Number(rest[0]) * 1000 });
      return 1;
    }
    case 'SADD': {
      const cur = await load(storage, key, now);
      const set = Array.isArray(cur?.v) ? [...cur.v] : [];
      let added = 0;
      for (const m of rest) if (!set.includes(m)) { set.push(m); added += 1; }
      await storage.put(key, { v: set, e: cur?.e || 0 });
      return added;
    }
    case 'SREM': {
      const cur = await load(storage, key, now);
      if (!Array.isArray(cur?.v)) return 0;
      const set = cur.v.filter((m) => !rest.includes(m));
      const removed = cur.v.length - set.length;
      if (removed) await storage.put(key, { v: set, e: cur.e || 0 });
      return removed;
    }
    case 'SMEMBERS': {
      const cur = await load(storage, key, now);
      return Array.isArray(cur?.v) ? [...cur.v] : [];
    }
    default:
      throw new Error(`ERR unknown command '${cmd}'`);
  }
}
