'use strict';
// The findings, written for the designer who exported the file rather than for
// the engineer who wrote the checker.

const HEADINGS = {
  blocker: 'Must fix before this can be used',
  warning: 'Worth a look',
  fixed:   'Fixed for you',
};
const ORDER = ['blocker', 'warning', 'fixed'];
const MARK = { blocker: '✗', warning: '!', fixed: '✓' };

function wrap(text, width, indent) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > width) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : indent + l)).join('\n');
}

function format(findings, { name = 'this file', width = 76 } = {}) {
  if (!findings.length) return `${name} is clean. Nothing to fix and nothing to flag.`;

  const out = [];
  const counts = { blocker: 0, warning: 0, fixed: 0 };
  for (const f of findings) counts[f.level]++;

  const parts = ORDER.filter((l) => counts[l]).map((l) => {
    const n = counts[l];
    if (l === 'blocker') return `${n} thing${n > 1 ? 's' : ''} to fix`;
    if (l === 'warning') return `${n} to look at`;
    return `${n} handled for you`;
  });
  out.push(`${name}: ${parts.join(', ')}.`);

  for (const level of ORDER) {
    const group = findings.filter((f) => f.level === level);
    if (!group.length) continue;
    out.push('', `  ${HEADINGS[level]}`);
    for (const f of group) {
      out.push(`    ${MARK[level]} ${wrap(f.what, width - 6, '      ')}`);
      if (f.why) out.push(`      ${wrap(f.why, width - 6, '      ')}`);
      if (f.how) out.push(`      → ${wrap(f.how, width - 8, '        ')}`);
    }
  }
  if (counts.blocker) {
    out.push('', '  Nothing was built. Fix the items above and run this again.');
  }
  out.push('');
  return out.join('\n');
}

module.exports = { format };
