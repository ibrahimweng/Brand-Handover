'use strict';
// Turning one variant into every file a client is owed.
const geo = require('./geometry');
const svgu = require('./svg');
const { toPdf } = require('./pdf');
const PH = require('./photography');
const contrast = require('./contrast');

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
  // An icon is square and a logotype is not. The mark is inset to fit its
  // longest side, so a wordmark four times wider than it is tall is drawn at a
  // quarter of the height a square mark would get and covers a tenth of the
  // icon. The stroke rule catches the consequence — everything in it is thinner
  // — but says the artwork needs redrawing heavier, which is not advice you can
  // take about a word. What a logotype identity needs for square contexts is a
  // device, and nothing was saying so.
  const short = Math.min(measured.markInk.w, measured.markInk.h);
  const aspect = long / short;
  const coverage = ICON_SAFE_AREA * ICON_SAFE_AREA * (short / long);
  const look = (prefix, sizes) => (sizes || []).map((size) =>
    ({ name: `${prefix}-${size}.png`, size, at: svgu.round(paints(size), 2) }));
  const icons = look('icon', rules.iconSizes);
  const favicons = look('favicon', rules.faviconSizes);
  return {
    smallest,
    aspect: svgu.round(aspect, 2),
    coverage: svgu.round(coverage * 100, 1),      // per cent of the square the artwork's box fills
    squarish: aspect < 2,                          // beyond this a square icon wastes most of itself
    thinIcons: icons.filter((i) => i.at < rules.minStrokePx),
    thinFavicons: favicons.filter((i) => i.at < rules.minStrokePx),
    clears: icons.concat(favicons).filter((i) => i.at >= rules.minStrokePx).map((i) => i.name),
  };
}

// The photograph, with the treatment already in it. resvg decodes the raster
// and fast-png encodes the result, so nothing new is needed to do it — and the
// per-pixel map is treatPixel, which is the function treatment-check measures
// against a real browser. Print and screen come out of the same arithmetic.
//
// The scrim is baked in too. It is a translucent wash, and Typst will not put
// alpha on a CMYK colour — "CMYK does not have an alpha component" — which is
// the right refusal: a translucent wash over a photograph is not something a
// press does with an ink, it is part of the picture by the time it gets there.
// So it becomes part of the picture here, at the alpha the rules state, read
// back through the same alphaAt the editor's check uses.
const RASTER_DPI = 300;
// `at` is the box the picture is placed in, if there is one; without it the
// photograph keeps its own shape, which is what a package wants.
function treatPhoto(im, rules, bundle, scrim, at) {
  const geom = at || { w: ((im.w || 1200) * 72) / RASTER_DPI, h: ((im.h || 800) * 72) / RASTER_DPI };
  const { Resvg } = require('@resvg/resvg-js');
  const png = require('fast-png');
  // Rasterised in the block's own shape, cropped the way the page crops it, so
  // the scrim runs across the picture the reader sees rather than across the
  // photograph the camera took.
  const want = Math.max(1, Math.round((geom.w / 72) * RASTER_DPI));
  const width = Math.max(1, Math.min(want, im.w || want));
  const height = Math.max(1, Math.round(width * (geom.h / geom.w)));
  const holder = `<svg xmlns="${svgu.NS}" viewBox="0 0 ${width} ${height}">`
    + `<image href="${im.src}" x="0" y="0" width="${width}" height="${height}" `
    + `preserveAspectRatio="xMidYMid slice"/></svg>`;
  let raw;
  try { raw = new Resvg(holder, { fitTo: { mode: 'width', value: width } }).render(); }
  catch (e) { return null; }                 // an image this cannot decode goes as it arrived
  const w = raw.width, h = raw.height;
  const data = Buffer.from(raw.pixels);
  const wash = scrim ? contrast.rgb(scrim.hex) : null;
  for (let i = 0; i < data.length; i += 4) {
    const px = i / 4, col = px % w, row = Math.floor(px / w);
    let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    if (rules) { const t = PH.treatPixel(rules, bundle, { r, g, b }); r = t.r; g = t.g; b = t.b; }
    if (wash) {
      const a = PH.alphaAt(scrim, PH.gradientT(scrim.direction, { x: (col + 0.5) / w, y: (row + 0.5) / h }));
      if (a > 0) {
        r = r * (1 - a) + (wash[0] / 255) * a;
        g = g * (1 - a) + (wash[1] / 255) * a;
        b = b * (1 - a) + (wash[2] / 255) * a;
      }
    }
    data[i] = Math.round(r * 255); data[i + 1] = Math.round(g * 255); data[i + 2] = Math.round(b * 255);
  }
  return Buffer.from(png.encode({ width: w, height: h, data, channels: 4, depth: 8 }));
}

module.exports = { iconSquare, banner, ico, zip, toPdf, iconFloor, treatPhoto, ICON_SAFE_AREA };
