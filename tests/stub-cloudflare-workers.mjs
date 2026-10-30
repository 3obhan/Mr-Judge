// Stands in for Cloudflare's runtime module in Node tests.
export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
