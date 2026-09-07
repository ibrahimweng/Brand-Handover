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

// A face the engine holds, inlined the same way as one the project ships.
//
// This used to be a <link> to fonts.googleapis.com. Three things were wrong with
// it and only one of them is about privacy: the document did not work without a
// network, so a manual opened on a plane was set in Georgia; the package was not
// self contained, which is the one promise the whole engine is built on; and the
// build was not reproducible, because the bytes came from somebody else's server
// and could change. The faces are vendored now. See src/typefaces.js.
function ours(type, text) {
  return require('./typefaces').embed(type, text).css;
}

// Everything the head of a document needs to set the identity in its own face.
// `text` is the document's own words, so only the character subsets it actually
// contains are carried: an English manual takes four faces and a French one
// eight, because French needs Latin Extended and English does not.
function head(type, fonts, text) {
  const css = [ours(type, text), faces(fonts)].filter(Boolean).join('\n');
  return css ? `<style>\n${css}\n</style>` : '';
}

// Which families are named but cannot arrive. A face that is neither one of ours
// nor shipped with the project will be asked for by name and silently replaced
// by the fallback, and the document will go on saying it is the face.
function unreachable(type, fonts) {
  return require('./typefaces').missing(type, fonts);
}

module.exports = { faces, ours, head, unreachable };
