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
  // Which of the two documents this dictionary can write, which is a claim with
  // a test behind it: the language battery renders every fixture twice and
  // measures how much of the wanted-language document is word for word the
  // English one. Declare a document you cannot write and it fails. The deck is
  // written from this dictionary end to end; the manual's body is still 1,453
  // words of prose that never went through a dictionary at all, in
  // documents/blocks.js, which is why français writes one and not the other.
  // See residue() below.
  lang: 'en', dir: 'ltr', name: 'English', writes: ['manual', 'deck'],
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
  // One sentence per treatment the engine can draw, so the caption is written
  // from the picture rather than sitting beside it hoping. See src/misuse.js.
  sayStretch: 'Do not stretch or squash it.',
  sayRotate: 'Do not rotate it.',
  sayCrowd: 'Do not crowd it. Clear space is {x} units on every side.',
  sayUndersize: 'Do not use it below {px}.',
  sayRecolour: 'Do not recolour it outside the palette.',
  sayShadow: 'Do not add a shadow, a glow or a bevel.',
  sayOutline: 'Do not outline it.',
  sayBusy: 'Do not put it on a busy ground without a scrim.',
  sayRedraw: 'Do not redraw it. The {part} belongs to the drawing.',
  sayRetype: 'Do not retype the name. It is artwork, not live text.',
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
  lang: 'fr', dir: 'ltr', name: 'français', writes: ['deck'],
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
  sayStretch: 'Ne pas l’étirer ni le comprimer.',
  sayRotate: 'Ne pas le faire pivoter.',
  sayCrowd: 'Ne pas l’enserrer : la zone de protection est de {x} unités sur chaque côté.',
  sayUndersize: 'Ne pas l’utiliser en dessous de {px} px.',
  sayRecolour: 'Ne pas le recolorer hors de la palette.',
  sayShadow: 'Ne pas ajouter d’ombre portée, de halo ni de biseau.',
  sayOutline: 'Ne pas le détourer.',
  sayBusy: 'Ne pas le poser sur un fond chargé sans voile.',
  sayRedraw: 'Ne pas le redessiner : {part} fait partie du dessin.',
  sayRetype: 'Ne pas ressaisir le nom : c’est un tracé, pas du texte.',
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

// The deck's own words, and the words of the things the deck prints.
//
// Both documents were said to be "in" a language on the strength of their
// chrome, which is the thirtieth round's fault a third time: the deck was a
// wall of English literals under whatever `lang` the project asked for, and
// what saved it was a hand-typed list saying français could not write one.
// A hand-typed list is a claim. Verdon's deck carried five French misuse
// captions inside a document declared English, because the cells took the
// manual's language and nobody had ever compared the two.
//
// So every word either document sets now comes from here, and what a language
// can write is measured off the finished page rather than declared — see
// missed() and residue() below.
Object.assign(EN, {
  // the deck's furniture
  deckDocTitle: '{brand} Brand Deck',
  deckCarousel: 'carousel',
  deckSlideOf: 'Slide {n}, {title}',
  deckSlides: 'Slides',
  deckPrev: 'Prev', deckNext: 'Next', deckKeys: 'Arrow keys',
  // what the drawing is called, which the prose declines around
  nounMark: 'mark', nounLogotype: 'logotype',
  // slide titles the manual has no section for
  sldTitle: 'Title', sldLockups: 'The lockups', sldContrast: 'Contrast',
  sldPackage: 'The package', sldClose: 'Close',
  bdgSystem: 'The system', bdgOnce: 'Set once',
  // the slides
  deckBuilt: 'built from one master file',
  deckPrimary: 'primary mark',
  deckMeasured: 'Measured, not decided',
  deckBox: 'The box is {box} units and the artwork fills {ink} of them. The {feature} is {thin}.',
  deckStem: 'narrowest stem', deckStroke: 'thinnest stroke',
  deckNumbers: 'Every number here was read off the artwork when this deck was built.',
  deckKeepClear: 'Keep x clear',
  deckClear: 'x is {x} units, which is {ratio} of the mark\'s own height. Nothing enters that space, including type and the trim of the page.',
  deckFloorPair: '{px}, and {mm}',
  deckFails: 'The stroke is what fails first. {basis}, so holding it at {px} px puts the floor there.',
  deckAtFloor: 'floor', deckTooSmall: 'too small',
  deckAlone: 'That is the {noun} alone. A lockup is a different drawing and disappears at a different size — the next slide has each of them, and the manual has the table.',
  deckArrangements: '{n} arrangements, {c} colourways',
  deckLockupsNote: 'All {n} cut from one master, so none of them can fall out of step with the others. The figure under each is the smallest it may be used at, which is its own and not the {noun}\'s.',
  deckPairs: '{n} partners, {p} pairs',
  deckPairsNote: 'Half of each is not ours: not recoloured, not redrawn, and not made at all where they have not supplied a version. A pair is a third drawing, so its smallest use is neither brand\'s own figure.',
  deckBreaksOne: '{n} way it breaks', deckBreaksMany: '{n} ways it breaks',
  deckColours: '{n} colours',
  deckChecked: 'Checked, not assumed',
  deckOn: '{fg} on {bg}',
  deckContrastNote: 'Nothing is softened, so the pairs that do not work are listed rather than left for somebody to discover.',
  deckFaces: '{n} faces, {n} jobs',
  deckAlphabet: 'ABCDEFGHIJKLM abcdefghijklm 0123456789',
  deckSteps: '{n} steps',
  deckScaleNote: 'Every size, weight and line height is read from the token file, so this deck and the running website cannot drift apart.',
  deckTiles: '{n} tiles, one decision',
  deckPatternNote: 'Built from <b>{motif}</b> — {draws} — at {d} densities in {c} colourways. Redraw the {noun} and all {n} are cut again.',
  deckDuotone: 'One duotone, every photograph',
  deckTreatment: 'One treatment, every photograph',
  deckPhotoFrom: 'From <b>{a}</b> to <b>{b}</b>.',
  deckPhotoScrim: 'A scrim {dir} at {pc} per cent.',
  deckPhotoNote: 'The editor measures the mark against the pixels under it, so this is checked rather than remembered.',
  deckCurves: 'Two curves, {n} durations',
  deckBuilds: 'The mark builds in {n} parts and {how}.',
  deckLoops: 'loops', deckPlaysOnce: 'plays once',
  deckNoBuild: 'How the mark itself builds is not set.',
  deckFiles: '{n} files',
  deckPackageLede: 'Every one cut from the master at the moment the package was built, so no old variant can survive in a corner of the folder.',
  deckPackageNote: 'The client keeps this whether or not anyone is still paying for the tool that made it.',
  deckRoot: '(root)',
  deckCloseA: 'Change the mark and every one of these is right again.',
  deckCloseB: 'Nothing here holds a copy of it.',
  deckCloseNote: 'This deck and the manual read the same project. They are different documents, not one document in two shapes.',

  // What the measurement says out loud. These sentences were written inside
  // geometry.js and inside contrast.js, one level below any dictionary, so a
  // French manual printed "box 240 ÷ stroke 16 = 15 stroke widths across" in
  // the middle of a French paragraph. A measurement is a number; how it is
  // said is a language's business.
  basisStroke: 'box {box} ÷ stroke {w} = {ratio} stroke widths across',
  basisStem: 'box {box} ÷ narrowest stem {w} = {ratio} stems across, measured off the artwork',
  basisThinner: ', which is thinner than the {w} stroke',
  floorUnknown: 'not measured',
  stepComfortable: 'comfortable', stepFloor: 'the floor', stepBelow: 'below the floor',
  useUnknown: 'Not measured', useAAA: 'Pass AAA', useAA: 'Pass AA',
  useAALarge: 'Large text only', useFail: 'Never for text',

  // What the pattern is built from, and how it repeats. Named by the engine
  // off the artwork, so the name is prose and belongs here too.
  motifSource: 'the shape marked in the master',
  motifMark: 'the whole mark',
  motifPart: 'the {part}',
  motifShape: 'the {shape} in the drawing',
  motifShapeNth: 'the {ord} {shape} in the drawing',
  shapePath: 'shape', shapeCircle: 'circle', shapeRect: 'rectangle',
  shapeEllipse: 'ellipse', shapePolygon: 'polygon', shapeLine: 'line',
  ord1: 'first', ord2: 'second', ord3: 'third', ord4: 'fourth', ord5: 'fifth',
  ord6: 'sixth', ord7: 'seventh', ord8: 'eighth', ord9: 'ninth', ord10: 'tenth',
  ord11: 'eleventh', ord12: 'twelfth', ord13: 'thirteenth',
  drawsGrid: 'a straight repeat, every instance the same way up',
  drawsHalfDrop: 'rows offset by half a cell, the way a textile repeats',
  drawsBrick: 'columns offset by half a cell, the way brickwork courses',
  drawsRotary: 'a block of four, each one turned a quarter more than the last',
  drawsMirror: 'a block of four, reflected across both axes',
  drawsScale: 'the same shape at four sizes, the way the size ladder steps down',
  drawsScatter: 'placed at intervals that do not line up, and never twice in the same place',
  drawsLines: 'rules at the weight the mark is drawn in, at the pitch of its own module',
  drawsArcs: 'quarter turns at the mark’s own weight, meeting across every edge',

  // the job a colour holds
  rolePrimary: 'primary', roleSecondary: 'secondary', roleAccent: 'accent',
  roleGround: 'ground', roleNeutral: 'neutral', roleSupport: 'support', roleAlert: 'alert',
  scrimTop: 'from the top', scrimBottom: 'from the bottom', scrimLeft: 'from the left',
  scrimRight: 'from the right', scrimFlat: 'flat',
});

Object.assign(FR, {
  deckDocTitle: 'Présentation de la marque {brand}',
  deckCarousel: 'carrousel',
  deckSlideOf: 'Diapositive {n}, {title}',
  deckSlides: 'Diapositives',
  deckPrev: 'Préc.', deckNext: 'Suiv.', deckKeys: 'Touches fléchées',
  nounMark: 'symbole', nounLogotype: 'logotype',
  sldTitle: 'Titre', sldLockups: 'Les verrouillages', sldContrast: 'Contraste',
  sldPackage: 'Le dossier', sldClose: 'Fin',
  bdgSystem: 'Le système', bdgOnce: 'Défini une fois',
  deckBuilt: 'construit à partir d’un seul fichier maître',
  deckPrimary: 'symbole principal',
  deckMeasured: 'Mesuré, non décidé',
  deckBox: 'La boîte fait {box} unités et le tracé en occupe {ink}. {feature} mesure {thin}.',
  deckStem: 'La hampe la plus étroite', deckStroke: 'Le trait le plus fin',
  deckNumbers: 'Chaque nombre présenté ici a été relevé sur le tracé au moment où cette présentation a été construite.',
  deckKeepClear: 'Gardez x libre',
  deckClear: 'x vaut {x} unités, soit {ratio} de la hauteur du symbole lui-même. Rien n’entre dans cette zone, ni le texte ni la coupe de la page.',
  deckFloorPair: '{px}, et {mm}',
  deckFails: 'C’est le trait qui lâche en premier. {basis}, donc le tenir à {px} px place le plancher là.',
  deckAtFloor: 'plancher', deckTooSmall: 'trop petit',
  deckAlone: 'Cela vaut pour le {noun} seul. Un verrouillage est un autre dessin et disparaît à une autre taille — la diapositive suivante les montre tous, et la charte en donne le tableau.',
  deckArrangements: '{n} agencements, {c} déclinaisons',
  deckLockupsNote: 'Les {n} sont taillés dans un seul fichier maître : aucun ne peut se désaccorder des autres. Le chiffre sous chacun est la plus petite taille à laquelle il peut servir, la sienne et non celle du {noun}.',
  deckPairs: '{n} partenaires, {p} paires',
  deckPairsNote: 'La moitié de chaque paire ne nous appartient pas : ni recolorée, ni redessinée, ni fabriquée là où ils n’ont fourni aucune version. Une paire est un troisième dessin, donc sa plus petite taille n’est celle d’aucune des deux marques.',
  deckBreaksOne: '{n} façon de le casser', deckBreaksMany: '{n} façons de le casser',
  deckColours: '{n} couleurs',
  deckChecked: 'Vérifié, non supposé',
  deckOn: '{fg} sur {bg}',
  deckContrastNote: 'Rien n’est adouci : les paires qui ne fonctionnent pas sont listées plutôt que laissées à découvrir.',
  deckFaces: '{n} caractères, {n} rôles',
  deckAlphabet: 'ABCDÉFGHIJKLM abcdéfghijklm 0123456789',
  deckSteps: '{n} échelons',
  deckScaleNote: 'Chaque corps, chaque graisse et chaque interligne est lu dans le fichier de tokens : cette présentation et le site en production ne peuvent pas diverger.',
  deckTiles: '{n} tuiles, une seule décision',
  deckPatternNote: 'Construit à partir de <b>{motif}</b> — {draws} — à {d} densités et en {c} déclinaisons. Redessinez le {noun} et les {n} sont retaillées.',
  deckDuotone: 'Un seul duoton, toutes les photographies',
  deckTreatment: 'Un seul traitement, toutes les photographies',
  deckPhotoFrom: 'De <b>{a}</b> à <b>{b}</b>.',
  deckPhotoScrim: 'Un voile {dir} à {pc} pour cent.',
  deckPhotoNote: 'L’éditeur mesure le symbole contre les pixels qui se trouvent dessous : c’est vérifié plutôt que retenu de mémoire.',
  deckCurves: 'Deux courbes, {n} durées',
  deckBuilds: 'Le symbole se construit en {n} parties et {how}.',
  deckLoops: 'boucle', deckPlaysOnce: 'ne joue qu’une fois',
  deckNoBuild: 'La façon dont le symbole se construit n’est pas définie.',
  deckFiles: '{n} fichiers',
  deckPackageLede: 'Chacun taillé dans le fichier maître au moment où le dossier a été construit : aucune ancienne variante ne peut survivre dans un coin du dossier.',
  deckPackageNote: 'Le client garde tout ceci, que quelqu’un paie encore ou non pour l’outil qui l’a produit.',
  deckRoot: '(racine)',
  deckCloseA: 'Changez le symbole et chacun de ces fichiers redevient juste.',
  deckCloseB: 'Aucun d’eux n’en garde une copie.',
  deckCloseNote: 'Cette présentation et la charte lisent le même projet. Ce sont deux documents différents, et non un seul document sous deux formes.',

  basisStroke: 'boîte {box} ÷ trait {w} = {ratio} largeurs de trait en travers',
  basisStem: 'boîte {box} ÷ hampe la plus étroite {w} = {ratio} hampes en travers, relevées sur le tracé',
  basisThinner: ', plus fine que le trait de {w}',
  floorUnknown: 'non mesuré',
  stepComfortable: 'confortable', stepFloor: 'le plancher', stepBelow: 'sous le plancher',
  useUnknown: 'Non mesuré', useAAA: 'AAA atteint', useAA: 'AA atteint',
  useAALarge: 'Grand texte seulement', useFail: 'Jamais pour du texte',

  motifSource: 'la forme marquée dans le fichier maître',
  motifMark: 'le symbole entier',
  motifPart: 'le {part}',
  motifShape: 'le {shape} du dessin',
  motifShapeNth: 'le {ord} {shape} du dessin',
  shapePath: 'tracé', shapeCircle: 'cercle', shapeRect: 'rectangle',
  shapeEllipse: 'ellipse', shapePolygon: 'polygone', shapeLine: 'trait',
  ord1: 'premier', ord2: 'deuxième', ord3: 'troisième', ord4: 'quatrième',
  ord5: 'cinquième', ord6: 'sixième', ord7: 'septième', ord8: 'huitième',
  ord9: 'neuvième', ord10: 'dixième', ord11: 'onzième', ord12: 'douzième',
  ord13: 'treizième',
  drawsGrid: 'une répétition droite, chaque exemplaire dans le même sens',
  drawsHalfDrop: 'des rangées décalées d’une demi-case, comme se répète un textile',
  drawsBrick: 'des colonnes décalées d’une demi-case, comme s’appareille une brique',
  drawsRotary: 'un bloc de quatre, chacun tourné d’un quart de plus que le précédent',
  drawsMirror: 'un bloc de quatre, reflété selon les deux axes',
  drawsScale: 'la même forme à quatre tailles, comme descend l’échelle des tailles',
  drawsScatter: 'posé à des intervalles qui ne s’alignent pas, et jamais deux fois au même endroit',
  drawsLines: 'des filets à la graisse du tracé, au pas de son propre module',
  drawsArcs: 'des quarts de tour à la graisse du symbole, se rejoignant sur chaque bord',

  rolePrimary: 'principale', roleSecondary: 'secondaire', roleAccent: 'accent',
  roleGround: 'fond', roleNeutral: 'neutre', roleSupport: 'appui', roleAlert: 'alerte',
  scrimTop: 'venant du haut', scrimBottom: 'venant du bas', scrimLeft: 'venant de la gauche',
  scrimRight: 'venant de la droite', scrimFlat: 'uniforme',
});

const HAVE = { en: EN, fr: FR };

// The language a document is written in, which is the engine's unless the
// project's own is one the engine can write — and it is asked per document,
// because the two are not written from the same words. Verdon shipped a French
// manual and a deck of English prose under lang="fr", which is the thirtieth
// round's fault repeated one level down: the check was that a language had been
// declared, not that the document was in it.
function resolve(project, which = 'manual') {
  const want = String((project && project.language) || 'en').toLowerCase().split(/[-_]/)[0];
  const asked = HAVE[want];
  const set = asked && (asked.writes || ['manual']).indexOf(which) > -1 ? asked : EN;
  // A key this dictionary does not have still gets written, in English, because
  // half a page in the right language beats none — but the page keeps a list of
  // what it had to fall back on, and the build reads it. A silent fallback is
  // how a document ends up declaring a language it is not written in.
  const missed = new Set();
  const t = (key, vars) => {
    let s = set[key];
    if (s === undefined) { if (set !== EN && EN[key] !== undefined) missed.add(key); s = EN[key]; }
    if (s === undefined) return key;
    for (const [k, v] of Object.entries(vars || {})) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
  return { lang: set.lang, dir: set.dir, name: set.name, t, document: which,
    // what the project asked for, and whether this document could be written in
    // it: the deck of a French project is English until deck.js takes its words
    // from here, and saying so is the difference between a claim and a lie
    wanted: want, wantedName: (asked && asked.name) || want,
    writes: (asked && (asked.writes || ['manual'])) || [],
    // Whether the brand's own language is the one this document is written in.
    // Where it is not, the brand's words carry their own lang and dir and the
    // document carries the engine's, which is what makes both claims true.
    speaksBrand: set.lang === want,
    brandLang: want, brandDir: (project && project.direction) || 'ltr',
    available: Object.keys(HAVE),
    // every key this document asked for and this dictionary did not have
    missed: () => [...missed].sort() };
}

// How much of a document was never written in the language it claims.
//
// Every check the engine had asked whether a language had been declared, and
// none of them looked at the page. Verdon's manual carried lang="fr" over 2,255
// words of which 2,034 were the English build's, word for word: the chrome came
// from this dictionary and the body was literals in documents/blocks.js that no
// dictionary had ever seen. A key that falls back can be counted; a sentence
// that never asks for a key cannot, and the only thing that sees it is the
// finished page beside the English one.
//
// Count the prose words the two renders share, as a multiset, over the words
// that could have been translated at all — a number, a hex code, a folder name
// and the brand's own vocabulary are the same in every language and are not
// evidence of anything. Sharing is an upper bound: `construction` is spelled
// the same in both, so a well translated page scores a little above zero rather
// than at it. Erring that way is the safe direction for a claim.
const NOT_PROSE = /^[^\p{L}]*$/u;
const splitWords = (t) => String(t)
  .split(/[\s,.;:!?()[\]{}"'\u2018\u2019\u201c\u201d\u00b7\u2014\u2013\/|]+/u);
function proseWords(html, skip) {
  const text = String(html)
    .replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/url\(data:[^)]*\)/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  const out = [];
  for (const w of splitWords(text)) {
    const k = w.toLowerCase();
    if (!k || NOT_PROSE.test(k) || /^#?[0-9a-f]{3,8}$/.test(k)) continue;
    if (skip && skip.has(k)) continue;
    out.push(k);
  }
  return out;
}

// The words that are the project's own and mean nothing about translation.
// Everything that reaches a page through own() is the brand's, printed the same
// in both builds by design — Verdon's positioning is French in the English deck
// too — so counting it as "shared" would mark a well translated page down for
// carrying the brand's own language, which is the one thing it is supposed to do.
function ownVocabulary(project) {
  const p = project || {};
  const type = (p.tokens || {}).type || {};
  const bits = [p.brand, p.version]
    .concat(Object.keys((p.tokens || {}).colour || {}))
    .concat(Object.values(type.families || {}).map((f) => f.family))
    .concat((type.scale || []).map((s) => s.sample))
    .concat(Object.values(p.content || {}).filter((v) => typeof v === 'string'))
    .concat(((p.content || {}).misuse || []).map((m) => m && m.why))
    .concat((p.partners || []).map((x) => x.name))
    .concat((p.rules && p.rules.lockups) || [])
    .concat(Object.keys(((p.system || {}).motion || {}).durations || {}));
  const set = new Set();
  for (const b of bits) {
    // the same splitter proseWords uses, or a hyphenated word is stored as two
    // and looked up as one
    for (const w of splitWords(String(b == null ? '' : b).toLowerCase())) if (w) set.add(w);
  }
  return set;
}

function residue(wanted, english, project) {
  const skip = ownVocabulary(project);
  const a = proseWords(wanted, skip), b = proseWords(english, skip);
  const have = new Map();
  for (const w of b) have.set(w, (have.get(w) || 0) + 1);
  let shared = 0;
  for (const w of a) { const n = have.get(w) || 0; if (n > 0) { shared++; have.set(w, n - 1); } }
  return { words: a.length, shared, share: a.length ? shared / a.length : 0 };
}

module.exports = { EN, FR, HAVE, resolve, residue, proseWords };
