import { createHmac } from 'node:crypto';

/**
 * Email helpers. Emails are only ever stored as an HMAC hash (plus a masked form like "a***@gmail.com" for display),
 * so the database does not contain anyone's email address.
 */
export const emailConfigured = () =>
  !!(process.env.EMAIL_HASH_SECRET && (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) && process.env.EMAIL_FROM);

/** Lower-case, strip "+tag" and (for Gmail) dots, so one mailbox cannot be turned into many "different" emails. */
export function normalizeEmail(input) {
  const e = String(input || '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null;
  let [local, domain] = e.split('@');
  local = local.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  if (!local) return null;
  return `${local}@${domain}`;
}

export const emailHash = (normalized) =>
  createHmac('sha256', process.env.EMAIL_HASH_SECRET || '').update(normalized).digest('hex');

export const maskEmail = (normalized) => {
  const [local, domain] = normalized.split('@');
  return `${local[0]}***@${domain}`;
};

/** Sends the login code with Brevo or Resend (whichever key is set). Throws on failure. */
export async function sendCodeEmail(to, code) {
  const from = process.env.EMAIL_FROM;
  const subject = `Mr Judge code: ${code} / کد آقای قاضی: ${code}`;
  const text =
    `Your Mr Judge verification code is ${code}. It is valid for 10 minutes. If you did not ask for it, ignore this email.\n\n` +
    `کد تأیید شما در «آقای قاضی»: ${code}\nاین کد ۱۰ دقیقه اعتبار دارد. اگر شما درخواست نکرده‌اید، این ایمیل را نادیده بگیرید.`;
  let res;
  if (process.env.BREVO_API_KEY) {
    res = await fetch(`${process.env.BREVO_API_BASE || 'https://api.brevo.com'}/v3/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { name: 'Mr Judge', email: from }, to: [{ email: to }], subject, textContent: text }),
    });
  } else {
    res = await fetch(`${process.env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
  }
  if (!res.ok) throw new Error(`Email provider error ${res.status}`);
}
