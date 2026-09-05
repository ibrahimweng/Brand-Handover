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

const ICON_SAFE_AREA = 0.68;

function iconSquare(markSvg, { size, background, ink, safeArea = ICON_SAFE_AREA, radius = 0 }) {
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

// `date` pins the mtime of every entry: without it a zip of identical files is
// a different zip every time, and two packages cannot be compared.
async function zip(files, date) {
  const JSZip = require('jszip');
  const z = new JSZip();
  for (const f of files) z.file(f.path, f.data, date ? { date } : undefined);
  // the folder entries jszip creates for itself do not take the option, and
  // they carry the clock, so the archive still changed between builds
  if (date) for (const name of Object.keys(z.files)) z.files[name].date = date;
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// How small an icon this mark survives, and which of the ones a project asks
// for it does not. The engine already refuses an icon handed to it on exactly
// this measurement and wrote its own without making it, so a 180 px app icon of
// a hairline seal shipped at 0.49 px and nothing said so. The mark is inset to
// the safe area, so it is drawn at size * safeArea across its longest side and
// everything in it shrinks by the same factor.
//
// A favicon is the exception that is not a fault: no mark of any weight clears
// a 3 px stroke at 16 px, which is why a favicon is a simplified glyph rather
// than the mark. So the floor is reported for every project, and only an app
// icon under it — a size the designer chose for this mark — is a warning.
function iconFloor(measured, rules) {
  const thin = measured.minimumSize && measured.minimumSize.thinnestStroke;
  const long = Math.max(measured.markInk.w, measured.markInk.h);
  if (thin == null || !(long > 0)) return null;
  const paints = (size) => (thin * size * ICON_SAFE_AREA) / long;
  const smallest = Math.ceil((rules.minStrokePx * long) / (thin * ICON_SAFE_AREA));
  const look = (prefix, sizes) => (sizes || []).map((size) =>
    ({ name: `${prefix}-${size}.png`, size, at: svgu.round(paints(size), 2) }));
  const icons = look('icon', rules.iconSizes);
  const favicons = look('favicon', rules.faviconSizes);
  return {
    smallest,
    thinIcons: icons.filter((i) => i.at < rules.minStrokePx),
    thinFavicons: favicons.filter((i) => i.at < rules.minStrokePx),
    clears: icons.concat(favicons).filter((i) => i.at >= rules.minStrokePx).map((i) => i.name),
  };
}

module.exports = { iconSquare, banner, ico, zip, toPdf, iconFloor, ICON_SAFE_AREA };
