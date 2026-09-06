'use strict';
// What language the document is in.
//
// A project states its language, and the engine has read it since the seventh
// round — for `lang` and `dir` on the document, which is exactly right if the
// document is in that language. It is not. Maayan's manual carries `lang="he"
// dir="rtl"` around **988 English words and twenty-one Hebrew ones**, so the
// whole of it is laid out right to left: headings right aligned, section numbers
// after their titles, an eyebrow reading from the wrong end. And the
// twenty-ninth round made it worse rather than better, because it checked that
// the language was declared and never asked whether it was true — a speech
// synthesiser told the page is Hebrew and handed English words reads gibberish
// with more confidence than one that was told nothing.
//
// The language of a document is the language it is *written in*. The brand's
// language belongs to the brand's own words: its name, its positioning, the
// samples in its type scale. Those are two different things and the engine had
// one field for both.
//
// So: the chrome lives here, in one place, in one language at a time. A project
// that supplies its own gets a document in it. A project that does not gets an
// English document that says so, with its own words marked as its own — which
// is the honest answer and the one a screen reader can act on.

const EN = {
  lang: 'en', dir: 'ltr', name: 'English',
  eyebrow: 'Brand manual · generated from one master file',
  manualTitle: '{brand} brand manual',
  deckTitle: '{brand} · brand deck',
  badgeSystem: 'Drawn by the system',
  badgeOnce: 'Set once by you',
  badgeYours: 'Yours',
  chMark: 'The mark', chLogotype: 'The logotype', chColour: 'Colour',
  chType: 'Typography', chSystem: 'The system', chAssets: 'Assets',
  chChanges: 'What changed since {version}', chMaking: 'Making it',
  chFamily: 'The brands inside it',
  secPrimaryMark: 'The primary mark', secPrimaryLogotype: 'The logotype',
  secConstruction: 'Construction', secClearSpace: 'Clear space',
  secMinimumSize: 'Minimum size', secEverySize: 'The mark at every size',
  secLockups: 'The lockup system', secPartners: 'Partner lockups', secMisuse: 'Misuse',
  secPalette: 'The palette', secGradient: 'The gradient',
  secContrast: 'Contrast and accessibility', secColourVision: 'Colour vision',
  secTypefaces: 'The typefaces', secScale: 'The scale',
  secPattern: 'The pattern', secPhotography: 'Photography', secIconGrid: 'The icon grid',
  secMotion: 'Motion', secIdent: 'The ident',
  secMadeAs: 'What it is made as', secSubBrands: 'Sub-brands',
  secReadFirst: 'Read this first',
  secInPackage: 'What is in the package', secMachineFile: 'The machine readable file',
  machineNote: "Shipped beside this page so the client's own tools can read the brand instead of guessing at it.",
  footerMeasured: 'Every measurement on this page was read off {master} when the package was built. None of it was typed in.',
  footerContrast: 'Contrast ratios follow WCAG 2.2. CMYK is converted from hex and should be soft proofed against an ICC profile before print.',
  footerFiles: '{brand} {version} · {n} files in the package.',
};

// One more language, to prove the mechanism is a mechanism rather than a hook
// nobody has ever hung anything on. Verdon is a French regional park and its
// manual is a French document.
const FR = {
  lang: 'fr', dir: 'ltr', name: 'français',
  eyebrow: 'Charte graphique · générée à partir d’un seul fichier maître',
  manualTitle: 'Charte graphique {brand}',
  deckTitle: '{brand} · présentation de la marque',
  badgeSystem: 'Tracé par le système',
  badgeOnce: 'Défini une fois par vous',
  badgeYours: 'À vous',
  chMark: 'Le symbole', chLogotype: 'Le logotype', chColour: 'Couleur',
  chType: 'Typographie', chSystem: 'Le système', chAssets: 'Fichiers',
  chChanges: 'Ce qui a changé depuis la version {version}', chMaking: 'La fabrication',
  chFamily: 'Les marques qu’elle contient',
  secPrimaryMark: 'Le symbole principal', secPrimaryLogotype: 'Le logotype',
  secConstruction: 'Construction', secClearSpace: 'Zone de protection',
  secMinimumSize: 'Taille minimale', secEverySize: 'Le symbole à chaque taille',
  secLockups: 'Les verrouillages', secPartners: 'Verrouillages partenaires', secMisuse: 'Usages interdits',
  secPalette: 'La palette', secGradient: 'Le dégradé',
  secContrast: 'Contraste et accessibilité', secColourVision: 'Vision des couleurs',
  secTypefaces: 'Les caractères', secScale: 'L’échelle',
  secPattern: 'Le motif', secPhotography: 'Photographie', secIconGrid: 'La grille d’icônes',
  secMotion: 'Animation', secIdent: 'L’habillage',
  secMadeAs: 'Ce dont elle est faite', secSubBrands: 'Sous-marques',
  secReadFirst: 'À lire d’abord',
  secInPackage: 'Ce que contient le dossier', secMachineFile: 'Le fichier lisible par une machine',
  machineNote: 'Fourni à côté de cette page pour que les outils du client lisent la marque au lieu de la deviner.',
  footerMeasured: 'Chaque mesure de cette page a été relevée sur {master} au moment de la construction du dossier. Aucune n’a été saisie à la main.',
  footerContrast: 'Les rapports de contraste suivent la norme WCAG 2.2. Le CMJN est converti depuis l’hexadécimal et doit être épreuvé avec un profil ICC avant impression.',
  footerFiles: '{brand} {version} · {n} fichiers dans le dossier.',
};

const HAVE = { en: EN, fr: FR };

// The language a document is written in, which is the engine's unless the
// project's own is one the engine can write.
function resolve(project) {
  const want = String((project && project.language) || 'en').toLowerCase().split(/[-_]/)[0];
  const set = HAVE[want] || EN;
  const t = (key, vars) => {
    let s = set[key] !== undefined ? set[key] : EN[key];
    if (s === undefined) return key;
    for (const [k, v] of Object.entries(vars || {})) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
  return { lang: set.lang, dir: set.dir, name: set.name, t,
    // Whether the brand's own language is the one this document is written in.
    // Where it is not, the brand's words carry their own lang and dir and the
    // document carries the engine's, which is what makes both claims true.
    speaksBrand: set.lang === want,
    brandLang: want, brandDir: (project && project.direction) || 'ltr',
    available: Object.keys(HAVE) };
}

module.exports = { EN, FR, HAVE, resolve };
