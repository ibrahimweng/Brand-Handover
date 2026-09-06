'use strict';
// The document furniture. Deliberately neutral, so the brand being documented
// is the only thing on the page with a colour.
//
// `figcaption` is a label: uppercase, letter-spaced, monospaced, which is right
// for three words naming a thing. `figcaption.said` is the same caption when it
// is a sentence, because that style is unreadable at that length. Every
// fixture's misuse captions were three words until one arrived whose captions
// were the sentences a real manual writes.
// Answered in one place now: src/typeface.js. A face that ships with the project
// is inlined, a face somebody else hosts is linked, and neither document has to
// know which it got.
const TF = require('../typeface');
const fontLink = (type, fonts) => TF.head(type, fonts);

const CSS = `
:root{--paper:#FCFCFB;--surface:#fff;--sunk:#F2F2F0;--ink:#0E1011;--ink-2:#5A5F63;--ink-3:#8B9197;--rule:#E3E5E6;--rule-2:#C7CACC;
--ui:"Schibsted Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--paper:#0C0D0F;--surface:#141618;--sunk:#101214;--ink:#ECEEF0;--ink-2:#9BA1A7;--ink-3:#6B7177;--rule:#232629;--rule-2:#34383C}}
:root[data-theme=dark]{--paper:#0C0D0F;--surface:#141618;--sunk:#101214;--ink:#ECEEF0;--ink-2:#9BA1A7;--ink-3:#6B7177;--rule:#232629;--rule-2:#34383C}
*{box-sizing:border-box}body{background:var(--paper);color:var(--ink);font-family:var(--ui);font-size:16px;line-height:1.6;margin:0;-webkit-font-smoothing:antialiased}
.page{max-width:1040px;margin:0 auto;padding:0 30px 90px}p{margin:0}
h1,h2,h3,h4{font-family:var(--ui);margin:0;text-wrap:balance}
.mast{padding:44px 0 32px;border-bottom:2px solid var(--ink)}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink-3);margin-bottom:26px}
.mast h1{font-weight:700;font-size:clamp(32px,5.4vw,54px);line-height:1.02;letter-spacing:-.035em;max-width:16ch}
.mast .sub{margin-top:16px;max-width:62ch;font-size:18px;line-height:1.55;color:var(--ink-2)}
.chapter{margin-top:70px;padding-top:20px;border-top:2px solid var(--ink)}
.chno{font-family:var(--mono);font-size:12px;color:var(--ink-3);letter-spacing:.1em}
.chapter h2{font-weight:700;font-size:clamp(23px,3.3vw,32px);letter-spacing:-.028em;margin-top:7px}
.sec{margin-top:40px}
.sech{display:flex;justify-content:space-between;align-items:baseline;gap:18px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--rule-2);margin-bottom:20px}
.sech h3{font-weight:600;font-size:17px;letter-spacing:-.012em}
.sech h3 i{font-family:var(--mono);font-style:normal;font-weight:400;color:var(--ink-3);margin-right:12px;font-size:13px}
.badge{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2)}
.badge::before{content:"";width:9px;height:9px;border:1.5px solid var(--ink);background:var(--ink)}
.badge.once::before{background:linear-gradient(90deg,var(--ink) 0 50%,transparent 50% 100%)}
.badge.yours::before{background:none}.badge.yours{color:var(--ink-3)}
.note{font-size:15px;line-height:1.6;color:var(--ink-2);max-width:66ch;margin-top:14px}.note b{color:var(--ink);font-weight:600}
.chgs{margin-top:22px;border-top:1px solid var(--rule-2)}
.chg{padding:15px 4px 15px 20px;border-bottom:1px solid var(--rule);position:relative}
.chg::before{content:"";position:absolute;left:0;top:19px;width:9px;height:9px;background:var(--ink-3)}
.chg.breaking::before{background:#C2352B}
.chg b{display:block;font-weight:600;font-size:15.5px;letter-spacing:-.008em}
.chg span,.chg em{display:block;font-size:14px;line-height:1.55;color:var(--ink-2);max-width:64ch;margin-top:5px}
.chg em{font-style:normal;color:var(--ink-3)}
.chg em::before{content:"\\2192  ";color:var(--ink-3)}
.stage{background:var(--sunk);border:1px solid var(--rule);display:flex;align-items:center;justify-content:center;padding:40px 26px}
.stage.tight{padding:22px 16px;min-height:120px}
.row2>figure>.stage,.row3>figure>.stage{min-height:190px}
.row2>figure>.stage svg,.row3>figure>.stage svg{max-width:100%;height:auto}
.stage.dont{position:relative;overflow:hidden}
.stage.dont::after{content:"";position:absolute;top:8px;right:8px;width:15px;height:15px;background:#C2352B;clip-path:polygon(20% 0,50% 30%,80% 0,100% 20%,70% 50%,100% 80%,80% 100%,50% 70%,20% 100%,0 80%,30% 50%,0 20%)}
.stage.busy{background:repeating-linear-gradient(52deg,#7E8C7A 0 12px,#5E6B5B 12px 24px)}
.row2{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.row3{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}
figure{margin:0}figcaption{font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin-top:9px}
figcaption.said{font-family:var(--ui);font-size:12px;letter-spacing:0;text-transform:none;line-height:1.45;color:var(--ink-2);max-width:34ch}
.dia{width:100%;max-width:340px;height:auto;display:block;margin:0 auto;color:var(--ink-3)}
.dl{font-family:var(--mono);font-size:8px;fill:currentColor}
.chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:14px}
.chip .sw{height:110px;border:1px solid rgba(0,0,0,.08)}
.chip b{display:block;font-weight:600;font-size:15px;margin-top:11px}
.chip .role{display:block;font-size:13px;color:var(--ink-3)}
.chip dl{margin:10px 0 0;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-family:var(--mono);font-size:11px}
.chip dt{color:var(--ink-3)}.chip dd{margin:0;text-align:right;color:var(--ink-2);font-variant-numeric:tabular-nums}
.chip .typed{font-style:italic;color:var(--ink-3)}
.chip .guess{color:#8A6410;font-style:italic}
.ctab{border-top:1px solid var(--rule-2)}
.ctr{display:grid;grid-template-columns:64px minmax(0,1fr) 66px 128px;gap:16px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--rule)}
.ctr.head{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);padding:0 4px 9px}
.ctr.head span:nth-child(3),.ctr.head span:nth-child(4){text-align:right}
.cp{display:flex;align-items:center;justify-content:center;height:34px;font-weight:600;font-size:14px;border:1px solid rgba(0,0,0,.08)}
.ctr span{font-size:14.5px;color:var(--ink-2)}
.ctr em{font-family:var(--mono);font-style:normal;font-size:13px;text-align:right;font-variant-numeric:tabular-nums}
.ctr i{font-family:var(--mono);font-style:normal;font-size:10px;letter-spacing:.06em;text-transform:uppercase;text-align:right}
.v-ok{color:#1B7A4B}.v-warn{color:#8A6410}.v-bad{color:#C2352B}
.face{border:1px solid var(--rule);background:var(--surface);padding:22px 24px}.face+.face{margin-top:14px}
.fn{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.fn h4{font-weight:600;font-size:17px}.fn span{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.alpha{font-size:clamp(24px,4vw,38px);line-height:1.15;word-break:break-word}
.fnote{margin-top:14px;padding-top:12px;border-top:1px solid var(--rule);font-size:14px;line-height:1.5;color:var(--ink-2);max-width:60ch}
.scale{border-top:1px solid var(--rule-2)}
.sr{display:grid;grid-template-columns:minmax(0,1fr) 168px;gap:20px;align-items:baseline;padding:16px 4px;border-bottom:1px solid var(--rule)}
.sr em{font-family:var(--mono);font-style:normal;font-size:10.5px;color:var(--ink-3);text-align:right}
.atab{border-top:1px solid var(--rule-2)}
.ar{display:flex;justify-content:space-between;padding:9px 4px;border-bottom:1px solid var(--rule);font-family:var(--mono);font-size:13px}
.ar em{font-style:normal;color:var(--ink-3)}
pre{background:var(--sunk);border:1px solid var(--rule);padding:18px 20px;overflow-x:auto;font-family:var(--mono);font-size:12px;line-height:1.65;margin:0;color:var(--ink-2)}
footer{margin-top:70px;padding-top:22px;border-top:2px solid var(--ink);font-family:var(--mono);font-size:11px;line-height:1.8;color:var(--ink-3);max-width:70ch}
@media (max-width:700px){.page{padding:0 18px 60px}.ctr{grid-template-columns:56px 1fr 60px}.ctr i{grid-column:2/-1;text-align:left}.ctr.head{display:none}.sr{grid-template-columns:1fr;gap:6px}.sr em{text-align:left}}
`;

// The brand name reaches this from the project, and a brand name is allowed to
// contain an ampersand. Two of the four emitters escaped it and two did not,
// which nothing noticed until a project was called Kvist & Sonn. The body is
// already-built markup and stays untouched; the title is text.
const escText = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const shell = ({ title, type, fonts, body, favicon, language = 'en', direction = 'ltr' }) => `<!doctype html>
<html lang="${escText(language)}" dir="${escText(direction)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escText(title)}</title>${favicon ? `\n<link rel="icon" href="${favicon}">` : ''}
${fontLink(type, fonts)}
<style>${CSS}</style></head><body><div class="page">${body}</div></body></html>`;

module.exports = { shell, CSS, fontLink, escText };
