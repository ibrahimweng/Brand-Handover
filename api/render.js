'use strict';
// The manual with the edits applied, for the screen where they are made.
//
// This existed on the local server and not here, which meant the hosted app
// broke at the first thing anybody does with it: client.html posts the artwork
// to /api/ask, Vercel had no function at that path, and the 404 page came back
// as HTML. The client called .json() on it and the upload failed with
// "Unexpected token 'T', \"The page c\"... is not valid JSON".
const { H, readBody, fail, only } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return only('POST', res);
  try {
    const body = await readBody(req);
    return res.status(200).json(H.render(body));
  } catch (e) { return fail(res, e); }
};
