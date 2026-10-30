import { DurableObject } from 'cloudflare:workers';
import { executeCommand } from './redis-lite.js';

/**
 * The app's database on Cloudflare: one Durable Object holds every account, credit balance and payment marker.
 * A Durable Object handles one request at a time and its storage is transactional, so counters like "spend 1 credit"
 * cannot be raced. api/_lib/redis.js talks to it through the "STORE" binding (see wrangler.jsonc).
 */
export class Store extends DurableObject {
  async cmd(args) {
    return executeCommand(this.ctx.storage, args);
  }
}
