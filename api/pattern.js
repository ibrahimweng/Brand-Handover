'use strict';
// The shape read out of the drawing, and what every generator derives from it,
// for the screen where the pattern is pushed around.
//
// The screen draws in the browser with the engine's own generator files, so
// this hands over the recipe and no pictures: the motif's moves, the
// measurements taken off the mark, and the parameters each generator derives.
// What a person pushes a slider to here is what the build writes.
const { H, readBody, fail, only } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return only('POST', res);
  try {
    const body = await readBody(req);
    return res.status(200).json(H.pattern(body));
  } catch (e) { return fail(res, e); }
};
