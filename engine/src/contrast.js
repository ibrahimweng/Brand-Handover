'use strict';
// WCAG 2.2 contrast, computed rather than eyeballed. The guidelines document
// reports failures as failures, because a table that only ever says pass is a
// table nobody trusts.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

function ratio(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// What a pair is actually allowed to be used for.
function verdict(r) {
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
  return pairs.sort((a, b) => b.ratio - a.ratio);
}

// A plain conversion, good enough to put on a page and not good enough to send
// to a press. Real work soft proofs through an ICC profile; this is the number
// a designer checks against their own proof.
function cmyk(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  const f = (v) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return [f(r), f(g), f(b), Math.round(k * 100)];
}

module.exports = { ratio, verdict, luminance, matrix, rgb, cmyk };
