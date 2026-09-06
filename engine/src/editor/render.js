/* One renderer, used by the editor and by the exported document. Pure string
   building against a precomputed bundle, so it needs no DOM, no native module
   and no measuring at draw time. Everything expensive already happened in the
   engine; this only lays it out. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../photography'), require('../print'), require('../surface'));
  else root.HandoverRender = factory(root.HandoverPhotography, root.HandoverPrint, root.HandoverSurface);
}(typeof self !== 'undefined' ? self : this, function (PH, PR, SU) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const r3 = (n) => Math.round(n * 1000) / 1000;

  // a colour name, a role name, or a literal hex all resolve here.
  // "none" is the case that matters over a photograph: a mark laid on a picture
  // has to sit on the picture, not on a rectangle of its own.
  function colour(bundle, key) {
    if (!key || key === 'none') return 'transparent';
    if (/^#/.test(key)) return key;
    if (bundle.roles && bundle.roles[key]) return bundle.roles[key].hex;
    if (bundle.colours && bundle.colours[key]) return bundle.colours[key].hex;
    return key;
  }
  // Which colourway to actually draw.
  //
  // A block asks for one by role — "the ground colourway" — and nothing says a
  // project cuts one named after each colour role. Meridian happens to; Halyard
  // does not, and three separate renderers dropped or mis-drew the mark because
  // of it before this was fixed in one place. Where the asked-for colourway is
  // not cut, take one meant for the ground it is going onto, and only then the
  // first that exists.
  function cwName(bundle, key, onKey) {
    const named = (bundle.roles && bundle.roles[key] && bundle.roles[key].name) || key;
    const have = bundle.colourways || [];
    if (!have.length || have.indexOf(named) > -1) return named;
    if (have.indexOf(key) > -1) return key;
    const onName = (bundle.roles && bundle.roles[onKey] && bundle.roles[onKey].name) || onKey;
    const forGround = have.find((n) => (bundle.colourwayOn || {})[n] === onName);
    return forGround || have[0];
  }

  function typeStyle(bundle, name) {
    const t = bundle.type || {};
    const step = (t.scale || []).find((s) => s.name.toLowerCase() === String(name).toLowerCase())
      || (t.scale || [])[4] || { family: 'text', size: 17, leading: 27, weight: 400 };
    const fam = (t.families || {})[step.family] || {};
    return `font-family:'${esc(fam.family || 'Georgia')}',${esc(fam.fallback || 'serif')};`
      + `font-size:${step.size}px;line-height:${r3(step.leading / step.size)};font-weight:${step.weight};`
      + (step.tracking ? `letter-spacing:${step.tracking}em;` : '');
  }

  // fit an SVG string into a box without distorting it
  const fitSvg = (svg, pad) =>
    svg.replace(/<svg([^>]*)>/, (m, a) =>
      `<svg${a.replace(/\s(width|height|style)="[^"]*"/g, '')} preserveAspectRatio="xMidYMid meet" `
      + `style="width:100%;height:100%;display:block;padding:${pad || 0}px;box-sizing:border-box">`);

  // A rule block states its own rule. That is the whole point of the kind: you
  // read the decision off the page instead of trusting that someone wrote it
  // down somewhere else and kept it current.
  // Segments are held together so the line breaks between them rather than
  // inside a phrase. Done with nowrap rather than hard spaces, so the caption
  // is still ordinary text to search for, select and paste.
  const ruleCaption = (text, tint) =>
    `<p style="font-family:ui-monospace,Menlo,monospace;font-size:10px;line-height:1.5;letter-spacing:.06em;`
    + `color:${tint};margin:0;text-align:center;opacity:.8">`
    + esc(text).split(' \u00b7 ').map((seg) => `<span style="white-space:nowrap">${seg}</span>`).join(' \u00b7 ')
    + `</p>`;

  // ------------------------------------------------------------ diagrams
  // Built from arithmetic and the mark's inner markup. No parsing, so this is
  // the same code in the editor and on the server.
  // The manual draws this block too, and three fixes made there were never made
  // here: the artwork was placed at the canvas origin and then drawn in its own
  // coordinates, nothing clipped it to the artboard, and clear space was drawn
  // as a square around artwork that is not one. One block, two renderers, and
  // only one of them ever taught.
  function construction(bundle, ink, line) {
    const vb = bundle.measured.markViewBox, ink2 = bundle.measured.markInk;
    const S = 260, pad = 30, k = (S - pad * 2) / Math.max(vb.w, vb.h);
    const clip = `k${Math.abs(Math.round(vb.x * 7 + vb.y * 13 + vb.w * 3 + vb.h))}`;
    const X = (v) => r3(pad + (v - vb.x) * k), Y = (v) => r3(pad + (v - vb.y) * k);
    let grid = '';
    for (let i = 0; i <= 6; i++) {
      grid += `<path d="M${X(vb.x + vb.w / 6 * i)} ${Y(vb.y)}V${Y(vb.y + vb.h)}"/>`
           +  `<path d="M${X(vb.x)} ${Y(vb.y + vb.h / 6 * i)}H${X(vb.x + vb.w)}"/>`;
    }
    return `<svg viewBox="0 0 ${S} ${S + 26}" style="width:100%;height:100%" role="img" aria-label="The mark on its grid. The box is ${vb.w} units and the artwork fills ${ink2.w} by ${ink2.h} of them.">
      <defs><clipPath id="${clip}"><rect x="${X(vb.x)}" y="${Y(vb.y)}" width="${r3(vb.w * k)}" height="${r3(vb.h * k)}"/></clipPath></defs>
      <g stroke="${line}" stroke-width=".5" opacity=".22">${grid}</g>
      <rect x="${X(vb.x)}" y="${Y(vb.y)}" width="${r3(vb.w * k)}" height="${r3(vb.h * k)}" fill="none" stroke="${line}" stroke-width=".9" opacity=".55"/>
      <rect x="${X(ink2.x)}" y="${Y(ink2.y)}" width="${r3(ink2.w * k)}" height="${r3(ink2.h * k)}" fill="none" stroke="${bundle.roles.accent.hex}" stroke-width="1" stroke-dasharray="4 3"/>
      <g clip-path="url(#${clip})"><g transform="translate(${X(vb.x)} ${Y(vb.y)}) scale(${r3(k)})${vb.x || vb.y ? ` translate(${-vb.x} ${-vb.y})` : ''}">${bundle.markInner[ink] || ''}</g></g>
      <text x="${S / 2}" y="16" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${line}" text-anchor="middle">${vb.w} unit box</text>
      <text x="${S / 2}" y="${S + 16}" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${bundle.roles.accent.hex}" text-anchor="middle">fills ${ink2.w} × ${ink2.h} · stroke ${bundle.measured.minimumSize.thinnestStroke}</text>
    </svg>`;
  }

  function clearSpace(bundle, ink, line) {
    const b = bundle.measured.markInk, x = bundle.measured.clearSpace;
    // clear space is x on every side of the ink box, so the box it makes is the
    // ink box grown by 2x — not a square. Drawn square it showed a rule nobody
    // could follow for anything but a square mark.
    const tw = b.w + x * 2, th = b.h + x * 2;
    const S = 260, k = S / (Math.max(tw, th) * 1.12);
    const ox = (S - tw * k) / 2, oy = (S - th * k) / 2;
    const PX = (v) => r3(ox + v * k), PY = (v) => r3(oy + v * k);
    return `<svg viewBox="0 0 ${S} ${S + 22}" style="width:100%;height:100%" role="img" aria-label="Clear space of ${x} units on every side.">
      <rect x="${PX(0)}" y="${PY(0)}" width="${r3(tw * k)}" height="${r3(th * k)}" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/>
      <g transform="translate(${PX(x)} ${PY(x)}) scale(${r3(k)}) translate(${-b.x} ${-b.y})">${bundle.markInner[ink] || ''}</g>
      <g stroke="${bundle.roles.accent.hex}" stroke-width="1.1">
        <path d="M${PX(0)} ${PY(th / 2)}H${PX(x)}"/><path d="M${PX(0)} ${PY(th / 2) - 5}v10"/><path d="M${PX(x)} ${PY(th / 2) - 5}v10"/></g>
      <text x="${PX(x / 2)}" y="${PY(th / 2) - 9}" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${bundle.roles.accent.hex}" text-anchor="middle">x</text>
      <text x="${S / 2}" y="${S + 14}" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${line}" text-anchor="middle">x = ${x} units · ${bundle.clearSpaceRatio} of the mark's height</text>
    </svg>`;
  }

  // ------------------------------------------------------------ blocks
  // what a mockup puts on the surface: a lockup, the mark alone, or the pattern
  function artFor(b, bu) {
    const cw = cwName(bu, b.props.colourway);
    if (b.props.art === 'mark') return (bu.marks || {})[cw] || Object.values(bu.marks || {})[0];
    if (b.props.art === 'pattern') {
      const t = (bu.patternTiles || {})[`medium:${b.props.colourway || 'ground'}`];
      return t ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.width} ${t.height}">${t.body}</svg>` : null;
    }
    return (bu.variants || {})[`${b.props.lockup || 'horizontal'}:${cw}`]
      || Object.values(bu.variants || {})[0];
  }

  const BLOCK = {
    // overflow:hidden here swallowed whatever did not fit, so a paragraph too
    // long for its block lost its last half on screen and printed straight
    // through the block underneath it, because Typst has no such rule. Let it
    // show, the way it prints: a page that looks wrong gets fixed, and a page
    // that quietly drops a sentence does not.
    text: (b, bu) => `<div class="hb-text" style="${typeStyle(bu, b.props.style)}color:${colour(bu, b.props.colour)};text-align:${b.props.align};width:100%;min-height:100%">${esc(b.props.text).replace(/\n/g, '<br>')}</div>`,
    rule: (b, bu) => `<div style="width:100%;height:${b.props.weight}px;background:${colour(bu, b.props.colour)}"></div>`,
    fill: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.colour)}"></div>`,
    // An image slot holds an id. The bytes come off the bundle, which is how
    // the same renderer draws it in the editor and on a published page.
    slot: (b, bu) => {
      const im = (bu.images || {})[b.props.image];
      if (!im) {
        // an empty slot on a published page is a hole, not an instruction
        return PUBLISHED ? '' : `<div class="hb-slot"><b>${esc(b.props.label)}</b><span>drop an image here</span></div>`;
      }
      const fit = b.props.fit === 'contain' ? 'contain' : 'cover';
      const pos = `${Number(b.props.focusX) || 0}% ${Number(b.props.focusY) || 0}%`;

      // The brand's photography treatment, applied by rule rather than baked
      // into the file. Every treated image carries its own filter, because a
      // block that needs something from the host page is not a block.
      const rules = (bu.system || {}).photography;
      const on = rules && rules.declared && b.props.treatment !== false;
      const fid = 'ph' + esc(b.id);
      const defs = on ? PH.filter(rules, bu, fid) : '';
      const scrim = on ? PH.scrimStyle(rules, bu, b.props.scrim) : null;

      const img = `<img draggable="false" src="${esc(im.src)}" alt="${esc(b.props.caption || b.props.label || '')}"`
        + ` style="width:100%;height:100%;object-fit:${fit};object-position:${pos};display:block`
        + (on && rules.duotone ? `;filter:url(#${fid})` : '') + `">`;
      const frame = `<div class="hb-img-f">${defs}${img}`
        + (scrim ? `<div class="hb-scrim" style="background:${scrim.background}"></div>` : '') + `</div>`;

      if (!b.props.caption) return `<div class="hb-img">${frame}</div>`;
      return `<figure class="hb-img">${frame}`
        + `<figcaption style="${typeStyle(bu, 'Caption')}color:${colour(bu, 'primary')}">${esc(b.props.caption)}</figcaption></figure>`;
    },

    // A mockup. The photograph, then the artwork mapped into the surface with
    // the one projective transform that takes a rectangle to four points, and
    // blended so the photograph's own shading comes through it. See
    // src/surface.js; the transform is CSS, so the canvas and the published
    // page do it the same way and nothing is baked into the picture.
    surface: (b, bu) => {
      const im = (bu.images || {})[b.props.image];
      const quad = (b.props.quad && b.props.quad.length === 4) ? b.props.quad : SU.DEFAULT;
      const px = quad.map(([u, v]) => [u * b.w, v * b.h]);
      const art = artFor(b, bu);
      const inner = art
        ? `<div class="hb-art" style="position:absolute;left:0;top:0;width:${b.w}px;height:${b.h}px;`
          + `transform-origin:0 0;transform:${SU.matrix3d(SU.homography(px), b.w, b.h)};`
          + `mix-blend-mode:${b.props.blend === 'normal' ? 'normal' : esc(b.props.blend || 'multiply')};`
          + `opacity:${b.props.opacity === undefined ? 1 : b.props.opacity}">`
          + `<div style="position:absolute;inset:12%;display:flex;align-items:center;justify-content:center">`
          + fitSvg(art, 0) + `</div></div>`
        : '';
      if (!im) {
        // published, the art alone on the ground, and nothing said to the reader
        // about a photograph they were never going to add
        if (PUBLISHED) return inner ? `<div style="position:absolute;inset:0;overflow:hidden">${inner}</div>` : '';
        return `<div class="hb-slot"><b>Mockup</b><span>drop a photograph here</span></div>`
          + (inner ? `<div style="position:absolute;inset:0;overflow:hidden">${inner}</div>` : '');
      }
      return `<div class="hb-surface" style="position:absolute;inset:0;overflow:hidden;isolation:isolate">`
        + `<img draggable="false" src="${esc(im.src)}" alt="${esc(b.props.label || 'mockup')}" `
        + `style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">`
        + inner + `</div>`;
    },

    mark: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.on)};display:flex;align-items:center;justify-content:center">
      ${fitSvg(bu.marks[cwName(bu, b.props.colourway, b.props.on)] || Object.values(bu.marks)[0], 14)}</div>`,

    lockup: (b, bu) => {
      const key = `${b.props.lockup}:${cwName(bu, b.props.colourway, b.props.on)}`;
      return `<div style="width:100%;height:100%;background:${colour(bu, b.props.on)};display:flex;align-items:center;justify-content:center">
        ${fitSvg(bu.variants[key] || bu.variants[Object.keys(bu.variants)[0]], 16)}</div>`;
    },

    construction: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.on || 'ground')}">${construction(bu, cwName(bu, b.props.colourway || 'primary'), colour(bu, b.props.line || 'neutral'))}</div>`,
    clearSpace: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.on || 'ground')}">${clearSpace(bu, cwName(bu, b.props.colourway || 'primary'), colour(bu, b.props.line || 'neutral'))}</div>`,

    // The steps are worked out in the engine and read here, because this block
    // is drawn twice — the manual draws the other one — and when the caption
    // learned to say the height as well as the width only one of the two was
    // taught. Hallward is the other half: the previews were laid out at their
    // literal pixel width, so a 766 px floor drew a 1532 px specimen that ran
    // off the right of a page 1400 px wide. Cap each at its share of the row,
    // so they shrink together and stay in proportion.
    minimumSize: (b, bu) => {
      const m = bu.measured.minimumSize;
      const steps = (m && m.steps) || [];
      if (!steps.length) return `<div class="hb-missing">Nothing in the master is painted, so no smallest size was measured.</div>`;
      const big = steps[0].px;
      const svg = bu.marks[cwName(bu, b.props.colourway || 'primary')] || Object.values(bu.marks)[0];
      return `<div class="hb-sizes">${steps.map((s) =>
        `<figure><div class="cell">
         <span style="display:block;width:min(${s.px}px,${r3((s.px / big) * 100)}%)">${fitSvg(svg)}</span></div>
         <figcaption>${esc(s.caption)} · ${esc(s.label)}</figcaption></figure>`).join('')}</div>`;
    },

    // a guessed CMYK is marked, because a chip that shows given and guessed the
    // same way is how a guess ends up on a press
    palette: (b, bu) => `<div class="hb-chips">${Object.entries(bu.colours).map(([n, c]) =>
      `<div><div class="sw" style="background:${c.hex}"></div><b>${esc(n)}</b>
       <span>${c.hex}</span><span>${(c.rgb || []).join(' ')}</span>
       <span class="${c.cmykDeclared ? '' : 'guess'}">${(c.cmyk || []).join(' ')}${c.cmykDeclared ? '' : ' ?'}</span>
       ${c.pantone ? `<span class="pms">${esc(c.pantone)}</span>` : ''}</div>`).join('')}</div>`,

    contrast: (b, bu) => {
      const cls = { AAA: 'ok', AA: 'ok', 'AA-large': 'warn', fail: 'bad' };
      return `<div class="hb-ctab">${bu.contrast.slice(0, b.props.limit || 6).map((p) =>
        `<div class="r"><span class="cp" style="background:${p.bgHex};color:${p.fgHex}">Aa</span>
         <span class="n">${esc(p.fg)} on ${esc(p.bg)}</span><em>${p.ratio}:1</em>
         <i class="${cls[p.level]}">${esc(p.use)}</i></div>`).join('')}</div>`;
    },

    typeSpecimen: (b, bu) => `<div class="hb-faces">${Object.entries((bu.type || {}).families || {}).map(([role, f]) =>
      `<div><p class="fl">${esc(f.family)} · ${esc(role)}</p>
       <p style="font-family:'${esc(f.family)}',${esc(f.fallback || 'serif')};font-weight:${(f.weights || [400])[0]};font-size:30px;line-height:1.2;margin:6px 0 0">ABCDEFGHIJ abcdefghij 0123</p></div>`).join('')}</div>`,

    // ---- rule blocks: one decision, every instance generated from it ----
    pattern: (b, bu) => {
      const sys = (bu.system || {}).pattern || {};
      if (!sys.available) {
        return `<div class="hb-missing">No pattern yet. ${esc(sys.how || 'Mark a shape in the master with data-pattern="source".')}</div>`;
      }
      // tiles are already keyed by role, so this must not go through cwName,
      // which would turn "primary" into the colourway name and miss every time
      const key = `${b.props.density || 'medium'}:${b.props.colourway || 'ground'}`;
      const t = bu.patternTiles[key] || bu.patternTiles[Object.keys(bu.patternTiles)[0]];
      if (!t) return `<div class="hb-missing">That density and colourway was refused, because it fails contrast on its ground.</div>`;
      const pid = 'p' + esc(b.id);
      const field = `<svg viewBox="0 0 ${b.w} ${b.h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block" role="img" aria-label="The brand pattern at ${esc(t.density)} density in ${esc(t.colourway)}.">
        <defs><pattern id="${pid}" width="${t.width}" height="${t.height}" patternUnits="userSpaceOnUse">${t.body}</pattern></defs>
        <rect width="${b.w}" height="${b.h}" fill="${colour(bu, b.props.on)}"/>
        <rect width="${b.w}" height="${b.h}" fill="url(#${pid})"/></svg>`;
      if (!b.props.caption) return field;
      // The tile is square-ish and repeats on a half-drop, so those two numbers
      // and the weight are the whole rule. Stated in the units the tile is cut in.
      const rule = `${t.width} tile · ${t.height} row · ${esc(t.density)} · half drop`;
      return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:6px">
        <div style="flex:1;min-height:0">${field}</div>${ruleCaption(rule, colour(bu, b.props.colourway))}</div>`;
    },

    iconGrid: (b, bu) => {
      const r = (bu.system || {}).icons; if (!r) return `<div class="hb-missing">no icon rules</div>`;
      const line = colour(bu, b.props.line || 'neutral'), ink = colour(bu, b.props.colourway || 'primary');
      const S = 240, pad = 26, k = (S - pad * 2) / r.box;
      const X = (v) => r3(pad + v * k);
      let grid = '';
      for (let i = 0; i <= 8; i++) {
        const g = X(r.box / 8 * i);
        grid += `<path d="M${g} ${X(0)}V${X(r.box)}"/><path d="M${X(0)} ${g}H${X(r.box)}"/>`;
      }
      const m = r.box * r.marginFraction;
      return `<div style="width:100%;height:100%;background:${colour(bu, b.props.on)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
        <svg viewBox="0 0 ${S} ${S}" style="width:100%;height:auto;max-height:78%" role="img" aria-label="The icon grid. A ${r.box} unit box with a ${r.live} unit live area and a stroke of ${r.stroke}.">
          <g stroke="${line}" stroke-width=".4" opacity=".25">${grid}</g>
          <rect x="${X(0)}" y="${X(0)}" width="${r3(r.box * k)}" height="${r3(r.box * k)}" fill="none" stroke="${line}" stroke-width=".9" opacity=".6"/>
          <rect x="${X(m)}" y="${X(m)}" width="${r3(r.live * k)}" height="${r3(r.live * k)}" fill="none" stroke="${bu.roles.accent.hex}" stroke-width="1" stroke-dasharray="4 3"/>
          <g fill="none" stroke="${ink}" stroke-width="${r3(r.stroke * k)}" stroke-linecap="${r.cap}">
            <path d="M${X(m)} ${X(r.box * 0.34)} A${r3(r.curveRadius * k)} ${r3(r.curveRadius * k)} 0 0 1 ${X(r.box - m)} ${X(r.box * 0.34)}"/>
            <path d="M${X(m)} ${X(r.box * 0.5)} A${r3(r.curveRadius * k)} ${r3(r.curveRadius * k)} 0 0 1 ${X(r.box - m)} ${X(r.box * 0.5)}"/>
            <path d="M${X(m)} ${X(r.box * 0.66)} A${r3(r.curveRadius * k)} ${r3(r.curveRadius * k)} 0 0 1 ${X(r.box - m)} ${X(r.box * 0.66)}"/>
          </g>
        </svg>
        ${b.props.caption === false ? '' : ruleCaption(`${r.box} box \u00b7 ${r.live} live \u00b7 ${r.stroke} stroke \u00b7 curve r ${r.curveRadius}`, line)}</div>`;
    },

    motion: (b, bu) => {
      const mo = (bu.system || {}).motion; if (!mo) return `<div class="hb-missing">no motion rules</div>`;
      const svg = bu.marks[cwName(bu, b.props.colourway, b.props.on)] || Object.values(bu.marks)[0];
      const inner = (svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [])[1] || '';
      const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 120 120';
      const n = vb.split(/\s+/).map(Number), vw = n[2] || 120, vh = n[3] || 120;

      // The rule has two steps, so the artwork has to move in two parts. Split
      // it the only way that generalises: what is stroked is the outline, what
      // is filled is the fill. The fill rises inside a clip of the outline's
      // own bounds, so it fills up rather than sliding past.
      const els = inner.match(/<[a-z][^>]*\/?>(?:[\s\S]*?<\/[a-z]+>)?/gi) || [];
      const outline = [], filled = [];
      for (const el of els) {
        const hasStroke = /stroke="(?!none)/.test(el);
        const hasFill = /fill="(?!none)/.test(el);
        (hasFill && !hasStroke ? filled : outline).push(el);
      }
      // A mark drawn entirely in fills has no outline to settle first, and
      // that is most marks. Splitting it anyway left the whole thing in the
      // rising half and the block came out empty. So say what is true: it
      // arrives in one piece.
      const onePiece = !outline.length;
      const dur = mo.durations, e = mo.easing;
      const bez = (a) => `cubic-bezier(${a.join(',')})`;
      const id = 'm' + esc(b.id);
      const draw = mo.build[0] || { from: 0, to: dur.considered };
      const rise = mo.build[1] || { from: 0, to: dur.slow };
      const box = bu.measured.markInk;
      const ms = (a) => `${a.to - a.from}ms`;
      const caption = b.props.caption === false ? '' :
        ruleCaption(onePiece
          ? `${ms(draw)} \u00b7 out \u00b7 one piece, no outline to draw first`
          : `${ms(draw)} out \u00b7 ${ms(rise)} through \u00b7 ${draw.part || 'outline'}, then ${rise.part || 'fill'}`,
          colour(bu, b.props.colourway));
      return `<div style="width:100%;height:100%;background:${colour(bu, b.props.on)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;overflow:hidden">
        <style>
          @keyframes ${id}-rise{from{transform:translateY(${r3(box.h)}px)}to{transform:translateY(0)}}
          @keyframes ${id}-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
          #${id} .hb-fill{animation:${id}-rise ${rise.to - rise.from}ms ${bez(e.through)} ${rise.from}ms both}
          #${id} .hb-out{animation:${id}-in ${draw.to - draw.from}ms ${bez(e.out)} ${draw.from}ms both;transform-origin:50% 50%}
          @media (prefers-reduced-motion:reduce){#${id} .hb-fill,#${id} .hb-out{animation:none}}
        </style>
        <svg id="${id}" viewBox="${vb}" style="width:64%;height:auto" role="img" aria-label="The mark, built to the brand's own motion rules. The outline settles, then the fill rises to its line.">
          <defs><clipPath id="${id}-c"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath></defs>
          ${onePiece
            ? `<g class="hb-out">${filled.join('')}</g>`
            : `<g clip-path="url(#${id}-c)"><g class="hb-fill">${filled.join('')}</g></g>`
              + `<g class="hb-out">${outline.join('')}</g>`}</svg>${caption}</div>`;
    },

    // The treatment stated, and shown. A ramp rather than a photograph, because
    // a project has no photograph of its own and a rule block should still say
    // what the rule is on a page nobody has dropped a file onto.
    photography: (b, bu) => {
      const r = (bu.system || {}).photography;
      if (!r || !r.declared) {
        return `<div class="hb-missing">No photography treatment yet. Set system.photography in the project: a duotone, a scrim, or both.</div>`;
      }
      const ink = colour(bu, 'primary'), on = colour(bu, b.props.on);
      const steps = 9;
      const swatches = [];
      for (let i = 0; i < steps; i++) {
        const v = i / (steps - 1);
        const t = PH.treatPixel(r, bu, { r: v, g: v, b: v });
        swatches.push(`<i style="background:rgb(${Math.round(t.r * 255)},${Math.round(t.g * 255)},${Math.round(t.b * 255)})"></i>`);
      }
      const scrim = PH.scrimStyle(r, bu, undefined);
      const line = (label, value) => `<div class="r"><span>${esc(label)}</span><em>${esc(value)}</em></div>`;
      return `<div class="hb-photo" style="background:${on};color:${ink}">
        <div class="ramp">${swatches.join('')}${scrim ? `<div class="hb-scrim" style="background:${scrim.background}"></div>` : ''}</div>
        <div class="rows">
          ${r.duotone ? line('Duotone', `${r.duotone.shadow} → ${r.duotone.highlight}`
            + (r.duotone.amount < 1 ? ` at ${Math.round(r.duotone.amount * 100)}%` : '')) : ''}
          ${r.scrim ? line('Scrim', `${Math.round(r.scrim.opacity * 100)}% ${r.scrim.colour}, from the ${r.scrim.direction}`) : ''}
          ${(r.ratios || []).length ? line('Crops to', r.ratios.join('  ')) : ''}
        </div>
        ${b.props.caption === false ? '' : ruleCaption('black → white through the treatment', ink)}</div>`;
    },

    assetIndex: (b, bu) => {
      const g = new Map();
      for (const f of bu.files || []) { const d = f.path.includes('/') ? f.path.split('/')[0] : '(root)'; g.set(d, (g.get(d) || 0) + 1); }
      return `<div class="hb-atab">${[...g.entries()].sort().map(([d, n]) =>
        `<div class="r"><code>${esc(d)}</code><em>${n}</em></div>`).join('')}
        <div class="r total"><code>total</code><em>${(bu.files || []).length}</em></div></div>`;
    },
  };

  // Which of the two this is drawing. The canvas is a place to work and says
  // "drop a photograph here"; a published page is something a client reads, and
  // an instruction to the designer printed on a ticket is the editor leaking
  // out of the door. The renderer is shared on purpose, so it is told.
  let PUBLISHED = false;
  const publishing = (on) => { PUBLISHED = !!on; };

  function block(b, bundle) {
    const fn = BLOCK[b.type];
    if (!fn) return `<div class="hb-missing">no renderer for "${esc(b.type)}"</div>`;
    try { return fn(b, bundle); }
    catch (e) { return `<div class="hb-missing">${esc(b.type)} could not draw: ${esc(e.message)}</div>`; }
  }

  // A block sits where it was put, unless it is against an edge on a page with
  // bleed, in which case it is painted out past the trim. The block never knows;
  // the box it draws into is simply bigger. See src/print.js.
  const positioned = (b, bundle, sheet, box) => {
    const out = sheet && box ? PR.bleedBox(b, sheet, box) : null;
    const g = out || b;
    return `<div class="hb-block${out ? ' bleeds' : ''}" data-id="${b.id}" data-type="${b.type}"`
      + ` style="position:absolute;left:${r3(g.x)}px;top:${r3(g.y)}px;width:${r3(g.w)}px;height:${r3(g.h)}px">`
      + `${block(b, bundle)}</div>`;
  };

  const page = (p, bundle, size) =>
    `<div class="hb-page" data-page="${p.id}" style="position:relative;width:${size.w}px;height:${size.h}px;background:${bundle.roles.ground.hex};overflow:hidden">`
    + p.blocks.map((b) => positioned(b, bundle)).join('') + `</div>`;

  return { block, positioned, page, colour, cwName, typeStyle, esc, construction, clearSpace, publishing, BLOCK };
}));
