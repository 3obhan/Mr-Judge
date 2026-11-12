/**
 * Cloudflare Pages Function: every address that starts with /api/ ends up here and is answered by the same API files
 * that run on Vercel (api/*.js), through cloudflare/adapter.js. Everything else is the static site in dist/.
 * Pages settings needed (see راهنما.md): compatibility flag nodejs_compat, a D1 binding named DB, and your variables/secrets.
 */
import { handleApi } from '../../cloudflare/adapter.js';

export const onRequest = (context) => handleApi(context.request, context.env);
