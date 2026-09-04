/* One renderer, used by the editor and by the exported document. Pure string
   building against a precomputed bundle, so it needs no DOM, no native module
   and no measuring at draw time. Everything expensive already happened in the
   engine; this only lays it out. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HandoverRender = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const r3 = (n) => Math.round(n * 1000) / 1000;

  // a colour name, a role name, or a literal hex all resolve here
  function colour(bundle, key) {
    if (!key) return 'transparent';
    if (/^#/.test(key)) return key;
    if (bundle.roles && bundle.roles[key]) return bundle.roles[key].hex;
    if (bundle.colours && bundle.colours[key]) return bundle.colours[key].hex;
    return key;
  }
  const cwName = (bundle, key) =>
    (bundle.roles && bundle.roles[key] && bundle.roles[key].name) || key;

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

  // ------------------------------------------------------------ diagrams
  // Built from arithmetic and the mark's inner markup. No parsing, so this is
  // the same code in the editor and on the server.
  function construction(bundle, ink, line) {
    const vb = bundle.measured.markViewBox, ink2 = bundle.measured.markInk;
    const S = 260, pad = 30, k = (S - pad * 2) / Math.max(vb.w, vb.h);
    const X = (v) => r3(pad + (v - vb.x) * k), Y = (v) => r3(pad + (v - vb.y) * k);
    let grid = '';
    for (let i = 0; i <= 6; i++) {
      grid += `<path d="M${X(vb.x + vb.w / 6 * i)} ${Y(vb.y)}V${Y(vb.y + vb.h)}"/>`
           +  `<path d="M${X(vb.x)} ${Y(vb.y + vb.h / 6 * i)}H${X(vb.x + vb.w)}"/>`;
    }
    return `<svg viewBox="0 0 ${S} ${S + 26}" style="width:100%;height:100%" role="img" aria-label="The mark on its grid. The box is ${vb.w} units and the artwork fills ${ink2.w} by ${ink2.h} of them.">
      <g stroke="${line}" stroke-width=".5" opacity=".22">${grid}</g>
      <rect x="${X(vb.x)}" y="${Y(vb.y)}" width="${r3(vb.w * k)}" height="${r3(vb.h * k)}" fill="none" stroke="${line}" stroke-width=".9" opacity=".55"/>
      <rect x="${X(ink2.x)}" y="${Y(ink2.y)}" width="${r3(ink2.w * k)}" height="${r3(ink2.h * k)}" fill="none" stroke="${bundle.roles.accent.hex}" stroke-width="1" stroke-dasharray="4 3"/>
      <g transform="translate(${X(vb.x)} ${Y(vb.y)}) scale(${r3(k)})">${bundle.markInner[ink] || ''}</g>
      <text x="${S / 2}" y="16" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${line}" text-anchor="middle">${vb.w} unit box</text>
      <text x="${S / 2}" y="${S + 16}" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${bundle.roles.accent.hex}" text-anchor="middle">fills ${ink2.w} × ${ink2.h} · stroke ${bundle.measured.minimumSize.thinnestStroke}</text>
    </svg>`;
  }

  function clearSpace(bundle, ink, line) {
    const b = bundle.measured.markInk, x = bundle.measured.clearSpace;
    const total = b.w + x * 2, S = 260, k = S / (total * 1.12), o = (S - total * k) / 2;
    const P = (v) => r3(o + v * k);
    return `<svg viewBox="0 0 ${S} ${S + 22}" style="width:100%;height:100%" role="img" aria-label="Clear space of ${x} units on every side.">
      <rect x="${P(0)}" y="${P(0)}" width="${r3(total * k)}" height="${r3(total * k)}" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/>
      <g transform="translate(${P(x)} ${P(x)}) scale(${r3(k)}) translate(${-b.x} ${-b.y})">${bundle.markInner[ink] || ''}</g>
      <g stroke="${bundle.roles.accent.hex}" stroke-width="1.1">
        <path d="M${P(0)} ${P(total / 2)}H${P(x)}"/><path d="M${P(0)} ${P(total / 2) - 5}v10"/><path d="M${P(x)} ${P(total / 2) - 5}v10"/></g>
      <text x="${P(x / 2)}" y="${P(total / 2) - 9}" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${bundle.roles.accent.hex}" text-anchor="middle">x</text>
      <text x="${S / 2}" y="${S + 14}" font-family="ui-monospace,Menlo,monospace" font-size="8" fill="${line}" text-anchor="middle">x = ${x} units · ${bundle.clearSpaceRatio} of the mark's height</text>
    </svg>`;
  }

  // ------------------------------------------------------------ blocks
  const BLOCK = {
    text: (b, bu) => `<div class="hb-text" style="${typeStyle(bu, b.props.style)}color:${colour(bu, b.props.colour)};text-align:${b.props.align};width:100%;height:100%;overflow:hidden">${esc(b.props.text).replace(/\n/g, '<br>')}</div>`,
    rule: (b, bu) => `<div style="width:100%;height:${b.props.weight}px;background:${colour(bu, b.props.colour)}"></div>`,
    fill: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.colour)}"></div>`,
    slot: (b) => `<div class="hb-slot"><b>${esc(b.props.label)}</b><span>${esc(b.props.ratio)} · drop an image here</span></div>`,

    mark: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.on)};display:flex;align-items:center;justify-content:center">
      ${fitSvg(bu.marks[cwName(bu, b.props.colourway)] || Object.values(bu.marks)[0], 14)}</div>`,

    lockup: (b, bu) => {
      const key = `${b.props.lockup}:${cwName(bu, b.props.colourway)}`;
      return `<div style="width:100%;height:100%;background:${colour(bu, b.props.on)};display:flex;align-items:center;justify-content:center">
        ${fitSvg(bu.variants[key] || bu.variants[Object.keys(bu.variants)[0]], 16)}</div>`;
    },

    construction: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.on || 'ground')}">${construction(bu, cwName(bu, b.props.colourway || 'primary'), colour(bu, b.props.line || 'neutral'))}</div>`,
    clearSpace: (b, bu) => `<div style="width:100%;height:100%;background:${colour(bu, b.props.on || 'ground')}">${clearSpace(bu, cwName(bu, b.props.colourway || 'primary'), colour(bu, b.props.line || 'neutral'))}</div>`,

    minimumSize: (b, bu) => {
      const m = bu.measured.minimumSize;
      const sizes = [m.screenPx * 2, m.screenPx, Math.round(m.screenPx * 0.6)];
      const cap = ['comfortable', 'the floor', 'below the floor'];
      const svg = bu.marks[cwName(bu, b.props.colourway || 'primary')] || Object.values(bu.marks)[0];
      return `<div class="hb-sizes">${sizes.map((s, i) =>
        `<figure><div style="height:${Math.max(...sizes)}px;display:flex;align-items:center;justify-content:center">
         <span style="width:${s}px;display:block">${fitSvg(svg)}</span></div>
         <figcaption>${s} px · ${cap[i]}</figcaption></figure>`).join('')}</div>`;
    },

    palette: (b, bu) => `<div class="hb-chips">${Object.entries(bu.colours).map(([n, c]) =>
      `<div><div class="sw" style="background:${c.hex}"></div><b>${esc(n)}</b>
       <span>${c.hex}</span><span>${(c.rgb || []).join(' ')}</span><span>${(c.cmyk || []).join(' ')}</span>
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

    assetIndex: (b, bu) => {
      const g = new Map();
      for (const f of bu.files || []) { const d = f.path.includes('/') ? f.path.split('/')[0] : '(root)'; g.set(d, (g.get(d) || 0) + 1); }
      return `<div class="hb-atab">${[...g.entries()].sort().map(([d, n]) =>
        `<div class="r"><code>${esc(d)}</code><em>${n}</em></div>`).join('')}
        <div class="r total"><code>total</code><em>${(bu.files || []).length}</em></div></div>`;
    },
  };

  function block(b, bundle) {
    const fn = BLOCK[b.type];
    if (!fn) return `<div class="hb-missing">no renderer for "${esc(b.type)}"</div>`;
    try { return fn(b, bundle); }
    catch (e) { return `<div class="hb-missing">${esc(b.type)} could not draw: ${esc(e.message)}</div>`; }
  }

  const positioned = (b, bundle) =>
    `<div class="hb-block" data-id="${b.id}" data-type="${b.type}" style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">${block(b, bundle)}</div>`;

  const page = (p, bundle, size) =>
    `<div class="hb-page" data-page="${p.id}" style="position:relative;width:${size.w}px;height:${size.h}px;background:${bundle.roles.ground.hex};overflow:hidden">`
    + p.blocks.map((b) => positioned(b, bundle)).join('') + `</div>`;

  return { block, positioned, page, colour, typeStyle, esc, construction, clearSpace, BLOCK };
}));
