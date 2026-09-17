'use strict';
// The icon set, for the ninth screen.
//
// Cheap next to /api/pattern: one rule resolved and twenty-four glyphs drawn,
// rather than every generator derived and measured. Its own route for the same
// reason every other screen has one — the hosted app publishes api/*.js and
// nothing else, so a screen without a file here is a screen that answers with
// somebody else's 404 page. See `icons` in app/handlers.js.
const { H, readBody, fail, only } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return only('POST', res);
  try {
    const body = await readBody(req);
    return res.status(200).json(H.icons(body));
  } catch (e) { return fail(res, e); }
};
