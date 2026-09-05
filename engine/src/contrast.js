// WCAG 2.2 contrast, computed rather than eyeballed. The guidelines document
// reports failures as failures, because a table that only ever says pass is a
// table nobody trusts.
//
// UMD, because the editor checks a mark against the pixels of a photograph and
// there must not be a second copy of this arithmetic to disagree with.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HandoverContrast = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';
// Colour arrives written however the tool that wrote it felt like writing it.
// Three modules here each had their own six-digit-hex reader, so a palette
// given as rgb(), hsl() or #123 produced NaN — and a NaN ratio compares false
// against every threshold, so brand.json told the client that every pair in
// their identity was "Never for text" and the whole pattern set was refused
// for measuring "NaN:1". One reader, and an honest null when it cannot tell.
const NAMED = {
  black: '#000000', silver: '#C0C0C0', gray: '#808080', grey: '#808080',
  white: '#FFFFFF', maroon: '#800000', red: '#FF0000', purple: '#800080',
  fuchsia: '#FF00FF', magenta: '#FF00FF', green: '#008000', lime: '#00FF00',
  olive: '#808000', yellow: '#FFFF00', navy: '#000080', blue: '#0000FF',
  teal: '#008080', aqua: '#00FFFF', cyan: '#00FFFF', orange: '#FFA500',
  transparent: null, none: null,
};

const hh = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();

function toHex(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  const named = NAMED[v.toLowerCase()];
  if (named !== undefined) return named;
  let m = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return ('#' + h.slice(0, 3).split('').map((c) => c + c).join('')).toUpperCase();
    if (h.length === 6 || h.length === 8) return ('#' + h.slice(0, 6)).toUpperCase();
    return null;
  }
  m = /^rgba?\(([^)]*)\)$/i.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3)
      .map((n) => (n.endsWith('%') ? (parseFloat(n) * 255) / 100 : parseFloat(n)));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) return '#' + parts.map(hh).join('');
    return null;
  }
  m = /^hsla?\(([^)]*)\)$/i.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    const h = parseFloat(parts[0]), sat = parseFloat(parts[1]) / 100, l = parseFloat(parts[2]) / 100;
    if (![h, sat, l].every((n) => Number.isFinite(n))) return null;
    const c = (1 - Math.abs(2 * l - 1)) * sat;
    const hp = (((h % 360) + 360) % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hp) % 6];
    const mm = l - c / 2;
    return '#' + seg.map((n) => hh((n + mm) * 255)).join('');
  }
  return null;
}

const rgb = (value) => {
  const hex = toHex(value);
  return hex ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : null;
};

const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (value) => {
  const c = rgb(value);
  if (!c) return null;
  const [r, g, b] = c.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// null, never NaN: a number that compares false against every threshold is how
// "unknown" gets reported to a designer as "fails".
function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// What a pair is actually allowed to be used for.
function verdict(r) {
  // a colour nobody could read is not the same as a pair that fails, and
  // saying "Never for text" about a number we never worked out is a lie
  if (r == null) return { level: 'unknown', use: 'Not measured', note: 'this colour is not written in a form the checker can read' };
  if (r >= 7)   return { level: 'AAA', use: 'Pass AAA',        note: 'any size, any weight' };
  if (r >= 4.5) return { level: 'AA',  use: 'Pass AA',         note: 'body text and above' };
  if (r >= 3)   return { level: 'AA-large', use: 'Large text only', note: 'headings at 24px and above, and shapes' };
  return { level: 'fail', use: 'Never for text', note: 'a shape colour only, never words' };
}

// Every pair in a palette, worst first, so the problems are at the top.
function matrix(colours) {
  const names = Object.keys(colours);
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [fg, bg] = [names[i], names[j]];
      const r = ratio(colours[fg].hex, colours[bg].hex);
      pairs.push({ fg, bg, fgHex: colours[fg].hex, bgHex: colours[bg].hex, ratio: r, ...verdict(r) });
    }
  }
  // unknown pairs sort last rather than throwing the order away
  return pairs.sort((a, b) => (b.ratio == null ? -1 : b.ratio) - (a.ratio == null ? -1 : a.ratio));
}

// A plain conversion, good enough to put on a page and not good enough to send
// to a press. Real work soft proofs through an ICC profile; this is the number
// a designer checks against their own proof.
function cmyk(hex) {
  const c = rgb(hex);
  if (!c) return null;
  const [r, g, b] = c.map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  const f = (v) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return [f(r), f(g), f(b), Math.round(k * 100)];
}

// Luminance straight off pixels, for the case where the background is a
// photograph rather than a swatch. Channels are sRGB, 0 to 1.
const luminanceOf = (r, g, b) => 0.2126 * channel(r * 255) + 0.7152 * channel(g * 255) + 0.0722 * channel(b * 255);

// The same weights without the transfer curve. This is what an SVG saturate(0)
// does, and a duotone is built on top of it, so the two have to agree.
const greyOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const unit = (hex) => rgb(hex).map((v) => v / 255);

function ratioOfLuminance(la, lb) {
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
const channelOf = channel;

return { ratio, verdict, luminance, matrix, rgb, cmyk, toHex, ratioOfLuminance,
  channel: channelOf, luminanceOf, greyOf, unit };
}));
