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

async function toPdf(svgString) {
  const w = dom();
  const vb = svgu.viewBox(svgu.parse(svgString));
  const holder = w.document.createElement('div');
  holder.innerHTML = svgString;
  const el = holder.querySelector('svg');
  if (!el) throw new Error('no <svg> element found to turn into a PDF');

  const doc = new jsPDF({ unit: 'pt', format: [vb.w, vb.h], compress: true });
  await doc.svg(el, { x: 0, y: 0, width: vb.w, height: vb.h });
  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = { toPdf };
