// The Android app is a shell around the website: its config only needs SITE_URL.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
let ts;
try { ts = createRequire(import.meta.url)('/home/claude/.npm-global/lib/node_modules/typescript'); } catch { try { ts = createRequire(import.meta.url)('typescript'); } catch { /* none */ } }
if (!ts) { console.log('capacitor SKIPPED (no TypeScript to read capacitor.config.ts)'); process.exit(0); }
const src = fs.readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const load = async (env) => { for (const k of ['SITE_URL', 'APP_ID', 'APP_NAME']) delete process.env[k]; Object.assign(process.env, env);
  return (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`)).default; };

const c = await load({ SITE_URL: 'https://mr-judge.vercel.app/' });
assert.equal(c.server.url, 'https://mr-judge.vercel.app/', 'the app opens the website'); assert.equal(c.server.cleartext, false); assert.deepEqual(c.server.allowNavigation, ['mr-judge.vercel.app']);
assert.equal(c.webDir, 'android-www'); assert.equal(c.server.errorPath, 'offline.html'); assert.equal(c.appId, 'com.yourname.mrjudge'); assert.equal(c.appName, 'آقای قاضی');
const c2 = await load({ SITE_URL: 'https://example.com', APP_ID: 'ir.me.judge', APP_NAME: 'Judge' }); assert.equal(c2.appId, 'ir.me.judge'); assert.equal(c2.appName, 'Judge'); assert.equal(c2.server.url, 'https://example.com/');
await assert.rejects(() => load({}), /Set SITE_URL/); await assert.rejects(() => load({ SITE_URL: 'http://insecure.test' }), /https/); await assert.rejects(() => load({ SITE_URL: 'not a url' }), /Set SITE_URL/);
for (const f of ['android-www/index.html', 'android-www/offline.html']) assert.ok(fs.existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists`);
assert.ok(!fs.existsSync(new URL('../capacitor.config.json', import.meta.url)), 'one config only');
console.log('capacitor OK');
