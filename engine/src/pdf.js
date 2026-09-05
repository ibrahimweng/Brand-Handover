'use strict';
// True vector PDF. Nothing is rasterised, so a printer receives paths.
// An .ai file is the same bytes: since version 9 Illustrator files are a PDF
// wrapper, so Illustrator opens a PDF named .ai without complaint.
//
// Load order matters, and the two libraries want opposite things. jsPDF ships a
// UMD bundle that attaches itself to `window` when it finds one, so it must be
// required BEFORE the jsdom globals exist or require() hands back nothing at
// all. svg2pdf reads the DOM while it loads, so it must be required AFTER they
// exist. Hence one at the top of the file and one inside dom().
const jspdfModule = require('jspdf');
const { jsPDF } = jspdfModule;
const svgu = require('./svg');

let win = null;
function dom() {
  if (win) return win;
  const { JSDOM } = require('jsdom');
  const d = new JSDOM('<!doctype html><body></body>');
  // Node 22 defines some of these itself, and defines them read only, so a
  // plain assignment throws. defineProperty replaces them either way.
  for (const k of ['window', 'document', 'navigator', 'Element', 'SVGElement', 'DOMParser', 'XMLSerializer']) {
    if (!d.window[k]) continue;
    try {
      Object.defineProperty(global, k, { value: d.window[k], writable: true, configurable: true });
    } catch (_) { /* a global we cannot replace is one the library will read from window instead */ }
  }
  // svg2pdf goes the other way round: it reads the DOM as it loads, so it has
  // to be required after the globals exist. Its UMD wrapper then takes the
  // browser branch, which looks for a global called jspdf instead of requiring
  // it, so hand it the module we already loaded.
  global.jspdf = jspdfModule;
  d.window.jspdf = jspdfModule;
  require('svg2pdf.js');
  win = d.window;
  return win;
}

// Print colour. svg2pdf reads the hex out of the artwork and hands jsPDF three
// numbers, which become a DeviceRGB operator: a description of light leaving a
// screen, in a file going to a press. Where the project has declared what a
// colour is in ink, that call is answered with the four numbers instead and the
// operator becomes DeviceCMYK.
//
// Done by wrapping the two setters rather than by rewriting the finished
// stream, because the stream is compressed and because svg2pdf is entitled to
// call these however it likes. An undeclared colour falls through untouched and
// stays RGB, which is the honest outcome: see src/cmyk.js for why the engine
// will not invent the numbers.
function useInk(doc, ink) {
  if (!ink || !ink.size) return () => 0;
  let swapped = 0;
  for (const name of ['setFillColor', 'setDrawColor']) {
    const orig = doc[name].bind(doc);
    doc[name] = function (...args) {
      const key = triple(args);
      const cmyk = key && ink.get(key);
      if (cmyk) { swapped++; return orig(cmyk[0], cmyk[1], cmyk[2], cmyk[3]); }
      return orig.apply(doc, args);
    };
  }
  return () => swapped;
}

// The byte triple a call is asking for, however it was written. Exactly three
// numbers, because jsPDF reads four as CMYK already and reading those as a
// screen colour would map an ink build onto another ink build.
function triple(args) {
  if (args.length === 3 && args.every((v) => typeof v === 'number')) {
    return args.map((v) => Math.round(v)).join(',');
  }
  if (args.length === 1 && typeof args[0] === 'string') {
    const m = /^#?([0-9a-f]{6})$/i.exec(args[0].trim());
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',');
  }
  return null;
}

// A gradient does not go through the colour setters at all. jsPDF writes it as
// a shading dictionary, and its writer says `/ColorSpace /DeviceRGB` outright,
// with no hook to say otherwise — so a mark whose ring is a gradient goes to
// press with the ring in RGB and the star beside it in the declared CMYK, in a
// file the package called DeviceCMYK. That claim is now made per file, from
// what was actually written, and the count comes from here.
function countShadings(doc) {
  if (typeof doc.addShadingPattern !== 'function') return () => 0;
  let n = 0;
  const orig = doc.addShadingPattern.bind(doc);
  doc.addShadingPattern = function (...args) { n++; return orig(...args); };
  return () => n;
}

async function toPdf(svgString, opts) {
  const o = opts || {};
  const w = dom();
  const vb = svgu.viewBox(svgu.parse(svgString));
  const holder = w.document.createElement('div');
  holder.innerHTML = svgString;
  const el = holder.querySelector('svg');
  if (!el) throw new Error('no <svg> element found to turn into a PDF');

  const doc = new jsPDF({ unit: 'pt', format: [vb.w, vb.h], compress: true });
  // a PDF stamps the moment it was made, so the same artwork written twice is
  // two different files and two packages cannot be diffed. Pin it when asked.
  if (process.env.SOURCE_DATE_EPOCH) {
    if (doc.setCreationDate) doc.setCreationDate(new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000));
    // the file identifier is generated fresh for every document, so two PDFs of
    // the same artwork are two different files. Pin it to the artwork itself.
    if (doc.setFileId) {
      let h = 2166136261;
      for (let i = 0; i < svgString.length; i++) { h ^= svgString.charCodeAt(i); h = Math.imul(h, 16777619); }
      doc.setFileId(Math.abs(h).toString(16).toUpperCase().padStart(8, '0').repeat(4).slice(0, 32));
    }
  }
  const count = useInk(doc, o.ink);
  const shadings = countShadings(doc);
  await doc.svg(el, { x: 0, y: 0, width: vb.w, height: vb.h });
  const buf = Buffer.from(doc.output('arraybuffer'));
  buf.inkColours = count();
  buf.rgbShadings = shadings();
  return buf;
}

module.exports = { toPdf, useInk, triple, countShadings };
