'use strict';
// Build the package and send it back as the zip it already writes. /tmp is the
// only writable place here and it is not shared with the next invocation, so
// the directory is read once and thrown away in the same breath.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { H, LIMIT, readBody, fail, only } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return only('POST', res);
  let dir = null;
  try {
    const body = await readBody(req);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-fn-'));
    const r = await H.make(body, dir);
    if (!r.zip) throw new Error('the package was built and no zip came out of it');
    const zip = fs.readFileSync(path.join(dir, r.zip));
    if (zip.length > LIMIT) {
      return res.status(413).json({ ok: false, findings: [{ level: 'blocker',
        what: `That package is ${(zip.length / 1048576).toFixed(1)} MB, which is more than this can send back in one piece.`,
        why: 'A hosted function answers with one response and there is a ceiling on how large it may be.',
        how: 'Build fewer lockups, or run it on your own machine with `handover serve`, where there is no ceiling and nothing is uploaded.' }] });
    }
    // The summary, and the package itself, in one answer. The payload is not
    // called `zip`: the handler already uses that for the file's name, and
    // Object.assign put the name over the bytes — a 412 KB response arrived as
    // 562 bytes with nothing to say it had. Two different things under one key
    // is the defect; the name is the fix.
    return res.status(200).json(Object.assign({}, r, {
      zipName: r.zip, zipBytes: zip.length, zipBase64: zip.toString('base64'),
    }));
  } catch (e) {
    return fail(res, e);
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
};
