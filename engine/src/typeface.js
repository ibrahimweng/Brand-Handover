'use strict';
// How a typeface reaches a document, decided once.
//
// For sixteen rounds every fixture declared `google: true`, so the only path
// that had ever run was a link to a font somebody else hosts. An identity built
// on a licensed face — which is most of them — reached no document at all: the
// family was named in the CSS, no @font-face was ever written, and every page
// fell through to its fallback while the manual's specimen carried the licensed
// name above type set in Georgia. A specimen showing the wrong face is worse
// than no specimen, because it is offered as proof.
//
// Four documents used to answer this question in two places and now answer it
// here, so the manual, the deck, the published page and the canvas cannot
// disagree about what the identity is set in.

// A font shipped with the project, inlined. The documents are meant to survive
// being emailed, so a relative href to a font file would break the moment one
// was moved — which is the same reason images are inlined.
function faces(fonts) {
  const out = [];
  for (const fam of fonts || []) {
    for (const f of fam.files) {
      out.push(`@font-face{font-family:'${fam.family.replace(/'/g, '')}';`
        + `font-style:${f.style};font-weight:${f.weight};font-display:swap;`
        + `src:url(${f.src}) format('${f.format}')}`);
    }
  }
  return out.join('\n');
}

// A font somebody else hosts, linked.
function googleLink(type) {
  const fams = Object.values((type && type.families) || {})
    .filter((f) => f.google && f.family)
    .map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${(f.weights || [400]).join(';')}`);
  return fams.length
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n`
      + `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap">`
    : '';
}

// Everything the head of a document needs to set the identity in its own face.
function head(type, fonts) {
  const css = faces(fonts);
  return googleLink(type) + (css ? `\n<style>\n${css}\n</style>` : '');
}

// Which families are named but cannot arrive. A face that is neither hosted by
// Google nor shipped with the project will be asked for by name and silently
// replaced by the fallback, and the document will go on saying it is the face.
function unreachable(type, fonts) {
  const shipped = new Set((fonts || []).map((f) => f.role));
  const out = [];
  for (const [role, f] of Object.entries((type && type.families) || {})) {
    if (f.google || shipped.has(role)) continue;
    out.push({ role, family: f.family, fallback: f.fallback || '' });
  }
  return out;
}

module.exports = { faces, googleLink, head, unreachable };
