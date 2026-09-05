'use strict';
const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
    return slug(parts[key]);
  });
  return name.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')      // whatever the pattern held, made safe
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

const FOLDERS = { horizontal: '01-horizontal', stacked: '02-stacked', mark: '03-mark', wordmark: '04-wordmark' };
const folderFor = (lockup) => FOLDERS[lockup] || `99-${slug(lockup)}`;

module.exports = { slug, fileName, folderFor };
