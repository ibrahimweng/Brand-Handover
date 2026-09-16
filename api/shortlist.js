'use strict';
// Which six patterns the package will write, ranked against the mark itself.
//
// Its own route rather than part of /api/pattern because it costs a draw of
// every generator — six seconds on the artwork it was measured against — and
// the pattern screen has to appear at once. The rail opens on a reasonable six
// and settles onto these when they land. See `shortlist` in app/handlers.js for
// why a cheaper ranking was tried and abandoned.
const { H, readBody, fail, only } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return only('POST', res);
  try {
    const body = await readBody(req);
    return res.status(200).json(H.shortlist(body));
  } catch (e) { return fail(res, e); }
};
