'use strict';
// A local server, because brand artwork under an NDA should not have to leave
// the machine it was drawn on to be measured. Nothing is uploaded anywhere:
// this listens on localhost, builds into a temporary directory and serves the
// result back to the browser that asked for it.
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const H = require('./handlers');

const MAX_BODY = 24 * 1024 * 1024;
const KEEP = 8;                        // recent builds still reachable by URL

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.ai': 'application/pdf',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
};
const typeOf = (p) => TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream';

const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
  + '<g fill="none" stroke="#15181b" stroke-width="10">'
  + '<circle cx="60" cy="60" r="48"/><path d="M16 68 C36 54, 84 54, 104 68" stroke-linecap="round"/>'
  + '</g></svg>';

// Builds live for the session. A designer clicks back and forth between the
// manual and the canvas, so the last few stay reachable; older ones go, because
// a package is megabytes and a temporary directory is not a store.
const builds = new Map();
function remember(id, dir) {
  builds.set(id, { dir, at: Date.now() });
  for (const [k, v] of [...builds.entries()].slice(0, Math.max(0, builds.size - KEEP))) {
    builds.delete(k);
    fs.rmSync(v.dir, { recursive: true, force: true });
  }
}
function sweep() {
  for (const { dir } of builds.values()) fs.rmSync(dir, { recursive: true, force: true });
  builds.clear();
}

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, Object.assign({ 'Cache-Control': 'no-store' }, headers));
  res.end(body);
};
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { 'Content-Type': TYPES['.json'] });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_BODY) { reject(new Error('that is more than this will take in one go')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('the request was not readable JSON')); }
    });
    req.on('error', reject);
  });
}

// A failure a designer caused reads like the rest of the engine: what, why,
// how. A failure the engine caused says so plainly rather than dressing it up.
function fail(res, e) {
  if (e && e.expected && e.finding) return json(res, 400, { ok: false, findings: [e.finding] });
  const what = (e && e.message) || 'something went wrong';
  return json(res, 500, { ok: false, findings: [{ level: 'blocker', code: 'engine', what,
    why: 'The engine stopped here rather than writing something it could not stand behind.',
    how: 'If the artwork opens in a browser and still does this, it is worth reporting with the file.' }] });
}

function serveFile(res, file, { download = null } = {}) {
  let st;
  try { st = fs.statSync(file); } catch (e) { return send(res, 404, 'not found', { 'Content-Type': 'text/plain' }); }
  if (!st.isFile()) return send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
  const head = { 'Content-Type': typeOf(file), 'Content-Length': st.size };
  if (download) head['Content-Disposition'] = `attachment; filename="${download.replace(/"/g, '')}"`;
  res.writeHead(200, head);
  fs.createReadStream(file).pipe(res);
}

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    return serveFile(res, path.join(__dirname, 'client.html'));
  }

  // A tab icon, because a 404 in the console on every load is a defect even
  // when nothing depends on it.
  if (req.method === 'GET' && (p === '/favicon.svg' || p === '/favicon.ico')) {
    return send(res, 200, FAVICON, { 'Content-Type': 'image/svg+xml' });
  }

  // The same contrast arithmetic the engine uses, served rather than copied.
  // The palette screen reports ratios live, and a second implementation in the
  // page would be a second answer to disagree with the manual it writes.
  if (req.method === 'GET' && p === '/contrast.js') {
    return serveFile(res, path.join(__dirname, '..', 'contrast.js'));
  }

  // a build's own files, at real URLs, so the manual and the canvas open in a
  // tab that can be reloaded, bookmarked and sent to somebody
  if (req.method === 'GET' && p.startsWith('/b/')) {
    const [, , id, ...rest] = p.split('/');
    const entry = builds.get(id);
    if (!entry) return send(res, 404, 'that build is no longer here. Build again.', { 'Content-Type': 'text/plain; charset=utf-8' });
    const want = path.join(entry.dir, ...rest);
    // a path that climbs out of the build directory is not a file in it
    if (path.relative(entry.dir, want).startsWith('..')) return send(res, 403, 'no', { 'Content-Type': 'text/plain' });
    return serveFile(res, want, { download: url.searchParams.has('download') ? path.basename(want) : null });
  }

  if (req.method === 'POST' && p === '/api/inspect') {
    return readBody(req).then((body) => json(res, 200, H.inspect(body))).catch((e) => fail(res, e));
  }

  if (req.method === 'POST' && p === '/api/build') {
    return readBody(req).then(async (body) => {
      const id = Math.random().toString(36).slice(2, 10);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-build-'));
      try {
        const r = await H.make(body, dir);
        remember(id, dir);
        json(res, 200, Object.assign({ id, base: `/b/${id}/` }, r));
      } catch (e) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw e;
      }
    }).catch((e) => fail(res, e));
  }

  return send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
}

function serve({ port = 3000, host = '127.0.0.1', log = console.log } = {}) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const got = server.address().port;
      log(`  handover is running at http://localhost:${got}`);
      log('  Drop your logo on it. Nothing leaves this machine.');
      resolve({ server, port: got, close: () => { sweep(); server.close(); } });
    });
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { sweep(); process.exit(0); });
process.on('exit', sweep);

module.exports = { serve, handler, builds };

if (require.main === module) {
  const i = process.argv.indexOf('--port');
  serve({ port: Number(i > -1 ? process.argv[i + 1] : 0) || 3000 }).catch((e) => {
    console.error(`  could not start: ${e.message}`);
    process.exit(1);
  });
}
