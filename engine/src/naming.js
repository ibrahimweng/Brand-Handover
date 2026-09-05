'use strict';
// A file name has to be ASCII to survive a zip, a URL and somebody's Windows
// machine, but throwing away the letters it cannot spell is not the way to get
// there: "Kvist & Sønn" came out as kvist-s-nn, with a word split down the
// middle by the o with a stroke through it. Accents decompose and drop; the
// letters that are letters in their own right need saying.
const FOLD = {
  ø: 'o', æ: 'ae', å: 'a', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th',
  ł: 'l', ħ: 'h', ı: 'i', ŋ: 'ng', ĸ: 'k', ſ: 's', '№': 'no', '&': 'and',
};
const fold = (s) => String(s).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')                    // combining accents
  .replace(/[^\u0000-\u007f]|&/g, (c) => FOLD[c] || ' ');

const slug = (s) => fold(s).trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// One naming rule for the whole package, so a client never receives two files
// that follow different conventions.
//
// The pattern belongs to the project, which means its separators do too. The
// first version slugged the whole assembled name, so a studio that wrote
// {brand}_{colourway}_{lockup} got hyphens anyway and nobody was told. Found by
// running a second project through: with only one project every convention
// looks like the convention.
//
// Case is the one thing still normalised, and deliberately: lowercase file
// names survive a case-insensitive filesystem, a URL and a stylesheet without
// anybody thinking about it. Separators are the project's, case is the
// package's.
function fileName(pattern, parts) {
  const name = pattern.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in parts)) throw new Error(`the naming pattern asks for {${key}}, which this project does not define`);
    const one = slug(parts[key]);
    if (!one && String(parts[key]).trim()) {
      throw new Error(`"${parts[key]}" has no letters a file name can carry.`
        + ' Give the project a "latinName" the package can be named after.');
    }
    return one;
  });
  const safe = fold(name)
    .replace(/[^a-z0-9._-]+/g, '-')      // whatever the pattern held, made safe
    .replace(/^[-_.]+|[-_.]+$/g, '');
  if (!safe) throw new Error(`the naming pattern "${pattern}" produced an empty file name.`);
  return safe;
}

const FOLDERS = { horizontal: '01-horizontal', stacked: '02-stacked', mark: '03-mark', wordmark: '04-wordmark' };
const folderFor = (lockup) => FOLDERS[lockup] || `99-${slug(lockup)}`;

module.exports = { slug, fileName, folderFor };
