'use strict';
// What the engine can tell from the artwork, plus the six things it cannot.
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
    const out = H.ask(body);
    // artwork the audit refuses is a refusal, not a success carrying bad news:
    // the same finding thrown from asSvg already comes back as a 400, and two
    // status codes for one answer is something for the next caller to get wrong
    return res.status(out.ok === false ? 400 : 200).json(out);
  } catch (e) { return fail(res, e); }
};
