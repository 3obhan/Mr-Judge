/**
 * Card payments through Stripe Checkout (hosted by Stripe). Apple Pay and Google Pay appear automatically on the
 * Stripe page for visitors whose device supports them (turn them on in the Stripe Dashboard → Settings → Payment methods).
 *   { action: 'create', returnUrl, cancelUrl, locale } -> { url }          (send the user to url; the page opens in `locale` if Stripe has it)
 *   { action: 'verify', sessionId }            -> { credits, granted }   (call after Stripe sends the user back)
 * The webhook (api/stripe-webhook.js) does the same job if the user closes the page before coming back.
 *
 * Vercel env: STRIPE_SECRET_KEY (sk_live_… or sk_test_… for testing), STRIPE_WEBHOOK_SECRET (whsec_…, for the webhook),
 *             optional PACK_PRICE_USD (default 1.00).
 */
import { guard, body, originAllowed, PACK_CREDITS } from './_lib/http.js';
import { authUser } from './_lib/auth.js';
import { stripeConfigured, stripeBase, priceCents, stripeGet, isPaidPack, redeemSession } from './_lib/stripe.js';

// Languages Stripe's payment page can speak (others, like Persian and Arabic, use the browser's language)
const STRIPE_LOCALES = new Set(['bg', 'cs', 'da', 'de', 'el', 'en', 'en-GB', 'es', 'es-419', 'et', 'fi', 'fil', 'fr', 'fr-CA', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'mt', 'nb', 'nl', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sk', 'sl', 'sv', 'th', 'tr', 'vi', 'zh', 'zh-HK', 'zh-TW']);

const safeUrl = (req, u) => {
  try { const o = new URL(u).origin; return originAllowed(req, o) ? u : null; } catch { return null; }
};

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
    if (!stripeConfigured()) return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
    const { action, sessionId } = body(req);

    if (action === 'create') {
      const b = body(req);
      const returnUrl = safeUrl(req, b.returnUrl);
      const cancelUrl = safeUrl(req, b.cancelUrl);
      if (!returnUrl || !cancelUrl) return res.status(400).json({ error: 'Bad return URL' });
      const form = new URLSearchParams({
        mode: 'payment',
        locale: STRIPE_LOCALES.has(b.locale) ? b.locale : 'auto',
        success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        client_reference_id: user.uid,
        'metadata[uid]': user.uid,
        'metadata[credits]': String(PACK_CREDITS),
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(priceCents()),
        'line_items[0][price_data][product_data][name]': `Mr Judge - ${PACK_CREDITS} dispute analyses`,
      });
      const r = await fetch(`${stripeBase()}/v1/checkout/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const s = await r.json().catch(() => ({}));
      if (!r.ok || !s.url) {
        console.error('stripe create failed:', JSON.stringify(s.error || s));
        return res.status(502).json({ error: 'STRIPE_CREATE_FAILED' });
      }
      return res.status(200).json({ url: s.url });
    }

    if (action === 'verify') {
      if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(String(sessionId || ''))) return res.status(400).json({ error: 'Bad session' });
      const { ok, data: session } = await stripeGet(`/v1/checkout/sessions/${sessionId}`);
      if (!ok || session.metadata?.uid !== user.uid) return res.status(404).json({ error: 'UNKNOWN_PAYMENT' });
      if (!isPaidPack(session)) return res.status(402).json({ error: 'NOT_PAID' });
      return res.status(200).json(await redeemSession(user.uid, session));
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('stripe error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
