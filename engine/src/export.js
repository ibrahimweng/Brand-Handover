'use strict';
// Turning one variant into every file a client is owed.
const geo = require('./geometry');
const svgu = require('./svg');
const { toPdf } = require('./pdf');

// An icon is the mark centred on a square of brand colour, with a safe area so
// no platform's rounding can clip it.
// Paint the whole mark one colour, whatever its slots are called. Repainting a
// slot literally named "ink" worked for two projects that happened to have one
// and silently did nothing for a third, so every icon, favicon and social crop
// came out as a bare square with whatever the master was painted in.
const oneColour = (doc, hex) =>
  svgu.applyColourway(doc, Object.fromEntries(svgu.slotsUsed(doc).map((s) => [s, hex])));

function iconSquare(markSvg, { size, background, ink, safeArea = 0.68, radius = 0 }) {
  const doc = svgu.parse(markSvg);
  oneColour(doc, ink);
  const box = geo.inkBox(markSvg);
  const scale = (size * safeArea) / Math.max(box.w, box.h);
  const x = (size - box.w * scale) / 2 - box.x * scale;
  const y = (size - box.h * scale) / 2 - box.y * scale;
  const r = radius ? ` rx="${svgu.round(size * radius)}"` : '';
  return `<svg xmlns="${svgu.NS}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`
       + `<rect width="${size}" height="${size}"${r} fill="${background}"/>`
       + `<g transform="translate(${svgu.round(x)} ${svgu.round(y)}) scale(${svgu.round(scale, 6)})">${svgu.innerXML(doc)}</g>`
       + `</svg>`;
}

// A cover image is wider than it is tall, so the mark sits in the middle band
// that every platform leaves uncropped.
function banner(markSvg, { width, height, background, ink, heightRatio = 0.42 }) {
  const doc = svgu.parse(markSvg);
  oneColour(doc, ink);
  const box = geo.inkBox(markSvg);
  const scale = (height * heightRatio) / box.h;
  const x = (width - box.w * scale) / 2 - box.x * scale;
  const y = (height - box.h * scale) / 2 - box.y * scale;
  return `<svg xmlns="${svgu.NS}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
       + `<rect width="${width}" height="${height}" fill="${background}"/>`
       + `<g transform="translate(${svgu.round(x)} ${svgu.round(y)}) scale(${svgu.round(scale, 6)})">${svgu.innerXML(doc)}</g>`
       + `</svg>`;
}

// PNG-in-ICO, which every browser since Vista reads. Written by hand because a
// whole dependency for 22 bytes of header would be silly.
function ico(pngs) {
  const dir = Buffer.alloc(6 + pngs.length * 16);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(pngs.length, 4);
  let offset = dir.length;
  pngs.forEach((p, i) => {
    const at = 6 + i * 16;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, at);
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, at + 1);
    dir.writeUInt8(0, at + 2); dir.writeUInt8(0, at + 3);
    dir.writeUInt16LE(1, at + 4); dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(p.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += p.data.length;
  });
  return Buffer.concat([dir, ...pngs.map((p) => p.data)]);
}

async function zip(files) {
  const JSZip = require('jszip');
  const z = new JSZip();
  for (const f of files) z.file(f.path, f.data);
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

module.exports = { iconSquare, banner, ico, zip, toPdf };
