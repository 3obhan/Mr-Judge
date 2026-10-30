/**
 * Credit balance and spending (always on the server, so it cannot be edited on the phone).
 *   { action: 'balance' }               -> { credits }
 *   { action: 'spend' }                 -> { ticket, credits }   takes 1 credit, returns a one-time analysis ticket
 *                                          or 402 { error: 'NO_CREDITS' }
 *   { action: 'refund', ticket }        -> { credits }           gives the credit back if the analysis never succeeded
 */
import { cmd } from './_lib/redis.js';
import { guard, body } from './_lib/http.js';
import { authUser, creditsKey } from './_lib/auth.js';

export const TICKET_TTL_SECONDS = 900;

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
    const { action, ticket } = body(req);
    const ck = creditsKey(user.uid);

    if (action === 'balance') {
      return res.status(200).json({ credits: Number(await cmd('GET', ck)) || 0 });
    }

    if (action === 'spend') {
      const left = Number(await cmd('DECR', ck));
      if (left < 0) {
        await cmd('INCR', ck); // undo: balance never goes below zero
        return res.status(402).json({ error: 'NO_CREDITS', credits: 0 });
      }
      const t = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      await cmd('SET', `t:${t}`, user.uid, 'EX', TICKET_TTL_SECONDS);
      return res.status(200).json({ ticket: t, credits: left });
    }

    if (action === 'refund') {
      if (!/^[a-f0-9]{32}$/.test(String(ticket || ''))) return res.status(400).json({ error: 'Bad ticket' });
      const owner = await cmd('GET', `t:${ticket}`);
      if (owner !== user.uid) return res.status(404).json({ error: 'UNKNOWN_TICKET' });
      const used = Number(await cmd('GET', `tc:${ticket}`)) || 0;
      if (used > 0) return res.status(409).json({ error: 'ALREADY_USED' }); // the AI answered: the credit is spent
      if ((await cmd('DEL', `t:${ticket}`)) !== 1) return res.status(404).json({ error: 'UNKNOWN_TICKET' });
      const credits = Number(await cmd('INCR', ck));
      return res.status(200).json({ credits });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('credits error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
