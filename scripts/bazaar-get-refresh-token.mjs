/**
 * One-time helper: turns the one-time "code" from Cafe Bazaar's authorization page into a refresh token for the server.
 *   node scripts/bazaar-get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET> <CODE> <REDIRECT_URI>
 * Put the printed refresh_token into Vercel as BAZAAR_REFRESH_TOKEN. (See راهنما.md, section 3.)
 */
const [clientId, clientSecret, code, redirectUri] = process.argv.slice(2);
if (!clientId || !clientSecret || !code || !redirectUri) {
  console.error('Usage: node scripts/bazaar-get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET> <CODE> <REDIRECT_URI>');
  process.exit(1);
}
const res = await fetch('https://pardakht.cafebazaar.ir/devapi/v2/auth/token/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }).toString(),
});
const data = await res.json().catch(() => ({}));
if (!res.ok || !data.refresh_token) {
  console.error('Failed:', res.status, JSON.stringify(data));
  process.exit(1);
}
console.log('refresh_token:', data.refresh_token);
