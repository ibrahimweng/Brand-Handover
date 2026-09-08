/* Does the hosted app hand back a package anybody can open?

   Hosted, there is no filesystem between one request and the next, so the
   answer to /api/build carries the package as bytes instead of pointing at
   files. api/build.js has sent them since the app was first hosted. The page
   rewritten after it read only `j.base`, which hosted is undefined — so the
   last screen, the one the whole product is for, offered five cards and every
   one of them pointed at "undefinedguidelines.html".

   Nothing in `npm test` can see that: it is a page, a static host and two
   serverless functions, and the fault is in how the three fit together. This
   stands the three up — site/out served as files, api/* behind /api, no
   filesystem shared — and walks the door from an SVG to the package.

   Kept out of `npm test` because it needs a browser.

     node test/hosted-check.mjs
     PW_PATH=/where/playwright/lives node test/hosted-check.mjs
*/
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const require = createRequire(import.meta.url);
let chromium;
try {
  const paths = [import.meta.dirname, process.cwd()].concat(process.env.PW_PATH ? [process.env.PW_PATH] : []);
  ({ chromium } = require(require.resolve('playwright', { paths })));
} catch {
  console.log('playwright is not installed, so nothing was measured.'
    + ' Install it, or point PW_PATH at a node_modules that has it.');
  process.exit(0);
}

const SRV = require(path.join(HERE, '..', 'src', 'app', 'server.js'));
const MARK = fs.readFileSync(path.join(HERE, '..', 'projects', 'meridian', 'mark.svg'));

let failed = 0;
const ok = (cond, what) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}`); if (!cond) failed += 1; };

// ---- the host, as the deployment is: static files, and api/* as functions ---
const statics = {
  '/': ['text/html; charset=utf-8', Buffer.from(SRV.page())],
  '/jszip.min.js': ['text/javascript', fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'))],
  '/favicon.svg': ['image/svg+xml', Buffer.from(SRV.FAVICON)],
};
const fn = (name) => require(path.join(HERE, '..', '..', 'api', `${name}.js`));
const host = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (statics[u.pathname]) {
    const [type, body] = statics[u.pathname];
    res.writeHead(200, { 'Content-Type': type });
    return res.end(body);
  }
  if (u.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let code = 200; let sent = null;
    const shim = { setHeader() {}, status(c) { code = c; return shim; }, json(o) { sent = o; return shim; } };
    await fn(u.pathname.slice(5))({ method: req.method, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }, shim);
    res.writeHead(code, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(sent));
  }
  // whatever sits in front of a static host answers in HTML when it goes wrong
  res.writeHead(404, { 'Content-Type': 'text/html' });
  return res.end('<!doctype html><title>404: NOT_FOUND</title>The page could not be found');
});
await new Promise((r) => host.listen(0, '127.0.0.1', r));
const at = `http://127.0.0.1:${host.address().port}`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });

console.log('\nthe hosted front door');
await page.goto(at + '/', { waitUntil: 'networkidle' });

// the page it serves is the page it was written as
ok(await page.evaluate(() => document.fonts.size) >= 10, 'it is set in its own type, not the visitor’s');
ok(await page.evaluate(() => typeof JSZip !== 'undefined'), 'it can open a zip');
ok(await page.evaluate(() => typeof HandoverNaming !== 'undefined'), 'it holds the engine’s naming rule');

// and it walks
await page.setInputFiles('#file', { name: 'mark.svg', mimeType: 'image/svg+xml', buffer: MARK });
await page.waitForFunction(() => !document.getElementById('seen').hidden, { timeout: 60000 });
await page.click('#go');
await page.fill('.q input[type=text]', 'Hosted');
await page.click('#go');
await page.waitForTimeout(9000);
const style = await page.$('#styles [data-style], #styles button, #styles label');
if (style) await style.click();
await page.click('#go');
await page.waitForTimeout(9000);
await page.click('#go');
await page.waitForFunction(() => document.getElementById('p-done').classList.contains('on')
  && document.querySelectorAll('#out a, #out .err').length > 0, { timeout: 420000 });
await page.waitForTimeout(2000);

const cards = await page.$$eval('#out a', (ns) => ns.map((n) => ({
  label: (n.querySelector('b') || {}).textContent, href: n.href })));
ok(cards.length >= 5, `the last screen offers ${cards.length} cards`);
ok(cards.every((c) => c.href && !/undefined/.test(c.href)),
  'every card points at something: ' + (cards.filter((c) => /undefined/.test(c.href)).map((c) => c.label).join(', ') || 'none broken'));
ok(cards.every((c) => /^blob:/.test(c.href)), 'they are opened out of the answer rather than fetched');

// and one of them opens — a blob URL belongs to the page that made it, so it
// is clicked there rather than fetched from a new context
const [opened] = await Promise.all([page.context().waitForEvent('page'), page.click('#out a:first-child')]);
await opened.waitForLoadState('load');
ok(/manual/i.test(await opened.title()), `the manual opens: ${await opened.title()}`);
ok((await opened.$$('h1, h2')).length > 2, 'and it has the document in it');
await opened.close();

ok(errs.length === 0, 'nothing failed to load: ' + (errs.slice(0, 3).join(' | ') || 'clean'));

await browser.close();
host.close();
console.log(`\n${failed ? `${failed} failed` : 'all good'}\n`);
process.exit(failed ? 1 : 0);
