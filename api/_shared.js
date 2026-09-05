'use strict';
// What the two functions have in common. They are wrappers: the work is in
// engine/src/app/handlers.js, which is also what the local server calls, so the
// hosted app and the one on your own machine cannot answer differently.
const H = require('../engine/src/app/handlers');

// Vercel gives a function no filesystem it can share with the next invocation,
// so a package cannot be built here and then served file by file from a URL.
// The zip is the smallest complete form of it — compressed, one response — and
// the browser opens the documents out of it. This is the limit that matters:
// a serverless response body is capped, and a package that will not fit says so
// rather than arriving truncated.
const LIMIT = 4 * 1024 * 1024;

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body || '{}')); } catch (e) { return Promise.reject(bad()); }
  }
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 24 * 1024 * 1024) { reject(bad()); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(bad()); } });
    req.on('error', reject);
  });
}
const bad = () => Object.assign(new Error('the request was not readable JSON'), { expected: true,
  finding: { level: 'blocker', code: 'input', what: 'The request did not arrive readable.',
    why: 'The browser and the server disagreed about what was sent.', how: 'Reload the page and try again.' } });

function fail(res, e) {
  if (e && e.expected && e.finding) return res.status(400).json({ ok: false, findings: [e.finding] });
  return res.status(500).json({ ok: false, findings: [{ level: 'blocker', code: 'engine',
    what: (e && e.message) || 'something went wrong',
    why: 'The engine stopped here rather than writing something it could not stand behind.',
    how: 'If the artwork opens in a browser and still does this, run it locally with `handover serve` — nothing is uploaded there, and the terminal says more.' }] });
}

const only = (method, res) => {
  res.setHeader('Allow', method);
  res.status(405).json({ ok: false, findings: [{ level: 'blocker', what: 'Wrong method.',
    why: `This endpoint answers ${method}.`, how: 'Use the app rather than the URL.' }] });
};

module.exports = { H, LIMIT, readBody, fail, only };
