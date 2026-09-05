'use strict';
// Read the artwork: what is in the file, and what the mark measures. Nothing is
// committed to at this point and nothing is written anywhere.
const { H, readBody, fail, only } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return only('POST', res);
  try {
    const body = await readBody(req);
    return res.status(200).json(H.inspect(body));
  } catch (e) { return fail(res, e); }
};
