'use strict';
const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// One naming rule for the whole package, so a client never receives two files
// that follow different conventions.
function fileName(pattern, parts) {
  const name = pattern.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in parts)) throw new Error(`the naming pattern asks for {${key}}, which this project does not define`);
    return slug(parts[key]);
  });
  return slug(name);
}

const FOLDERS = { horizontal: '01-horizontal', stacked: '02-stacked', mark: '03-mark', wordmark: '04-wordmark' };
const folderFor = (lockup) => FOLDERS[lockup] || `99-${slug(lockup)}`;

module.exports = { slug, fileName, folderFor };
