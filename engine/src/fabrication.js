'use strict';
// Making the thing.
//
// The engine has been writing sentences about embroidery and vinyl since the
// twenty-second round — "anything already made between 32 px and 64 px was
// inside the rule: small print, favicons, embroidery, anything cut in vinyl" —
// and it had never measured one thing about either. Twenty-five identities
// specified in pixels and millimetres of ink, for brands that mostly exist as
// objects: badges, signs, kit, plaques, van doors, certificates.
//
// A process is a floor like any other floor in this engine, in a unit the
// engine already works in. A satin stitch below about 1.3 mm will not lie down;
// vinyl below about 2 mm cannot be weeded; a router with a 3 mm bit cannot cut
// an internal corner sharper than a 1.5 mm radius. Given a drawing, its box and
// the size the thing will be made at, whether it can be made is arithmetic —
// and where it cannot, the twenty-fifth round's ladder already holds the answer,
// because a simpler drawing of the same mark is exactly what is wanted.
//
// The figures below are working ones, sourced where they could be and stated so
// they can be moved: every threshold in this engine is a rule the project may
// set, and a maker who knows their own machine knows better than this file.
const svgu = require('./svg');
const geo = require('./geometry');
const system = require('./system');

const PROCESSES = {
  embroidery: {
    feature: 1.3,
    what: 'a satin stitch narrower than this will not lie down, and reads as a crease rather than a line',
    also: 'letterforms need about 4 mm of height before their counters close up',
  },
  vinyl: {
    feature: 2.0, outline: true,
    what: 'anything narrower than this tears when the waste is weeded off the backing',
    also: 'a cutter follows outlines, so every stroke has to be converted to one before the file is sent',
  },
  screenprint: {
    feature: 0.4, registration: 0.5,
    what: 'a line finer than this fills in or breaks up depending on the mesh',
    also: 'two colours that meet exactly will show a gap on one side; they need an overlap',
  },
  foil: {
    feature: 0.35,
    what: 'below this the foil bridges the gap and the detail fills in solid',
  },
  engraving: {
    feature: 0.8, tool: 1.5,
    what: 'a groove narrower than the tool cannot be cut at all',
    also: 'the tool is round, so every internal corner comes out with the tool\'s radius on it.',
  },
  cast: {
    feature: 1.5,
    what: 'metal thinner than this does not fill the mould, and what does fill it will not survive being handled',
  },
};

const no = (code, what, why, how) => {
  const e = new Error(what);
  e.findings = [{ level: 'blocker', code, what, why, how }];
  throw e;
};

function rules(project) {
  const given = project.rules.fabrication;
  if (given === undefined) return [];
  if (!Array.isArray(given)) {
    no('fabrication', 'rules.fabrication is not a list.',
      'It is the things this identity is actually made as, each with the size it is made at, because a '
      + 'process is only answerable against a size.',
      'Write it as [{ "process": "embroidery", "at": 70, "note": "the blazer badge" }].');
  }
  return given.map((entry) => {
    const spec = PROCESSES[entry && entry.process];
    if (!spec) {
      no('fabrication', `rules.fabrication asks for "${entry && entry.process}", which the engine knows nothing about.`,
        'Every process here has a smallest feature it can hold, and one it has never been given cannot be checked '
        + 'against anything, so the answer would be silence.',
        `Use one of ${Object.keys(PROCESSES).join(', ')}, or add the figures for yours to src/fabrication.js.`);
    }
    if (!(Number(entry.at) > 0)) {
      no('fabrication', `the ${entry.process} entry does not say what size it is made at.`,
        'A process is not too fine or fine enough on its own: a mark that cannot be embroidered on a cap badge '
        + 'is perfectly embroiderable on a banner. The size is the whole question.',
        `Add "at": the width in millimetres, for example { "process": "${entry.process}", "at": 70 }.`);
    }
    return Object.assign({}, spec, entry, {
      feature: Number(entry.feature) > 0 ? Number(entry.feature) : spec.feature,
      tool: Number(entry.tool) > 0 ? Number(entry.tool) : spec.tool,
      at: Number(entry.at),
    });
  });
}

// ------------------------------------------------------------------ asking

// What a drawing measures once it is a physical thing.
const atSize = (drawing, mm) => {
  const per = mm / drawing.viewBox.w;               // millimetres per unit
  return {
    perUnit: per,
    thinnest: Number((drawing.minimumSize.thinnestStroke * per).toFixed(3)),
    heightMm: Number((drawing.viewBox.h * per).toFixed(1)),
  };
};

// The smallest size at which a drawing can be made by a process: the box
// divided by the thinnest thing in it, times what that thing has to measure.
const needs = (drawing, spec) =>
  Number(((drawing.viewBox.w / drawing.minimumSize.thinnestStroke) * spec.feature).toFixed(1));

// A round tool cannot cut an internal corner at all: every one comes back with
// the tool's radius on it. That is not a fault and it is not avoidable — the
// question is whether it shows, which is the radius as a fraction of the size
// the thing is made at. Three millimetres on a stone 240 wide is one per cent
// and nobody will ever see it; the same tool on a 60 mm trophy takes five per
// cent off every corner in the drawing.
//
// Counted per subpath. The first version ran straight through the M commands
// and found twenty-three corners in a drawing that has five, because an
// optimiser merges eleven separate lines into one path with eleven subpaths and
// the end of each one is not a corner with the start of the next.
function subpaths(d) {
  const out = [];
  const parts = String(d).split(/(?=[Mm])/).filter((x) => x.trim());
  for (const part of parts) {
    const pts = system.pathPoints(part);
    if (pts.length > 1) out.push({ pts, closed: /[Zz]\s*$/.test(part.trim()) });
  }
  return out;
}

function sharpCorners(source, limitDeg = 150) {
  const doc = svgu.parse(source);
  const found = [];
  svgu.eachPainted(doc, (el) => {
    if (!el.getAttribute) return;
    if (String(el.nodeName).replace(/^.*:/, '').toLowerCase() !== 'path') return;
    for (const sp of subpaths(el.getAttribute('d') || '')) {
      const n = sp.pts.length;
      const from = sp.closed ? 0 : 1;
      const to = sp.closed ? n : n - 1;
      for (let i = from; i < to; i++) {
        const [ax, ay] = sp.pts[(i - 1 + n) % n], [bx, by] = sp.pts[i % n], [cx, cy] = sp.pts[(i + 1) % n];
        const v1 = [ax - bx, ay - by], v2 = [cx - bx, cy - by];
        const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
        // A segment shorter than a hundredth of the box is not a segment, it is
        // how a curve came out of the point extractor — and the reversal it
        // reads as (0 degrees) is not a corner either. Both were being counted:
        // a circle that an optimiser rewrote as arcs contributed three of the
        // nine corners found in a shield that has six.
        const tiny = Math.max(l1, l2) < 1e-6 ? true : Math.min(l1, l2) < 0.01 * (svgu.viewBox(doc).w || 1);
        if (tiny) continue;
        const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
        const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
        if (deg < 1 || deg >= limitDeg) continue;         // a reversal, or a bend rather than a corner
        found.push({ at: [svgu.round(bx, 1), svgu.round(by, 1)], angle: svgu.round(deg, 1) });
      }
    }
  });
  return found.sort((a, b) => a.angle - b.angle);
}

// ---------------------------------------------------------------- the answer

// For each thing the identity is made as: which drawing to send, at what size,
// and what the process will do to it that the screen does not show.
function plan(project, drawings, list) {
  return list.map((spec) => {
    // the most detailed drawing that survives the process at the size asked for
    const able = drawings.filter((d) => atSize(d, spec.at).thinnest >= spec.feature);
    const chosen = able.length ? able[0] : null;
    const out = {
      process: spec.process, at: spec.at, note: spec.note || null,
      feature: spec.feature, what: spec.what, also: spec.also || null,
      drawing: chosen ? chosen.name : null,
      thinnestMm: chosen ? atSize(chosen, spec.at).thinnest : null,
      heightMm: chosen ? atSize(chosen, spec.at).heightMm : null,
      considered: drawings.map((d) => ({ name: d.name, thinnestMm: atSize(d, spec.at).thinnest,
        needsMm: needs(d, spec) })),
    };
    if (chosen && spec.outline) {
      out.outline = svgu.thinnestStroke(svgu.parse(chosen.source)) != null;
    }
    if (chosen && spec.tool) {
      const per = spec.at / chosen.viewBox.w;
      out.tool = spec.tool;
      out.corners = sharpCorners(chosen.source).length;
      // what the tool takes off every one of them, as a share of the thing
      out.toolShare = Number(((spec.tool / spec.at) * 100).toFixed(2));
      out.toolUnits = Number((spec.tool / per).toFixed(1));
    }
    return out;
  });
}

module.exports = { PROCESSES, rules, plan, atSize, needs, sharpCorners };
