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
  // English one. Declare a document you cannot write and it fails.
  //
  // Both documents are written from this dictionary now. The thirty-second
  // round moved the deck's words in; the thirty-third moved the manual's — and
  // the manual's turned out not all to live in documents/blocks.js: the floor's
  // own reasoning was a sentence inside geometry.js, what a making process can
  // hold was one inside fabrication.js, and why the engine picked the shape it
  // built the pattern from was one inside pattern.js. Each of those keeps its
  // English beside the facts, because brand.json, CHANGES.txt and the command
  // line are read as English whatever the brand's language is.
  //
  // The canvas is the third. Its chrome — Undo, Pages, Add a block, Properties —
  // is still literals in editor/emit.js and editor/app.js, so English is the
  // only language that writes one, and a French project's canvas says English
  // rather than carrying lang="fr" over English words. The script check cannot
  // catch that: French and English are the same alphabet.
  lang: 'en', dir: 'ltr', name: 'English', writes: ['manual', 'deck', 'canvas'],
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
  lang: 'fr', dir: 'ltr', name: 'français', writes: ['deck', 'manual'],
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
  alphabet: 'ABCDEFGHIJKLM abcdefghijklm 0123456789',
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
  alphabet: 'ABCDÉFGHIJKLM abcdéfghijklm 0123456789',
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

// The manual's body. Every sentence below was a literal in documents/blocks.js
// until the thirty-third round: 1,453 words that no dictionary had ever seen,
// inside a document that declared a language on the strength of its chrome.
Object.assign(EN, {
  // the construction drawing
  diaConstruction: 'The mark on its construction grid, showing the {box} unit box, the {w} by {h} area it actually fills, and the margin between them.',
  capStem: 'narrowest stem', capStroke: 'stroke',
  capFills: 'fills {w} × {h} · {feature} {thin}',
  capModule: ' · {unit} unit module, {across} across',
  capBox: '{w} unit box',
  capBoxModule: '{w} unit box · {across} modules of {unit}',
  // clear space
  diaClearSpace: 'Clear space of {x} units on every side, which is {ratio} of the {noun}\'s height.',
  capClear: 'x = {x} units · {ratio} of the {noun}\'s height',
  // the floor
  minLead: '{px} on screen and {mm} in print{alone}.',
  minAlone: ' for the mark alone',
  minBody: '{basis}, so holding the stroke at {px} px and {mm} mm puts the floor there. Move either rule and the floor moves with it.',
  minBothWidth: ' Both figures are the width; the second is the height that goes with it.',
  minProportion: ' These three are in proportion to each other rather than at actual size: {px} px is wider than this page.',
  thFolder: 'Folder', thDisappears: 'What disappears first',
  thOnScreen: 'On screen', thInPrint: 'In print',
  floorNote: 'A minimum size belongs to a drawing, and there are {n} of them in this package. Use the figure for the folder the file came out of, not the one above it{over}.',
  floorOver: ': {which} not hold at {px} — a lockup sets the name beside the mark at a fraction of its height, so it is wider than the mark and its finest part is finer, and both put the floor up',
  floorOverOne: 'one of them does', floorOverMany: '{n} of them do',
});

Object.assign(FR, {
  diaConstruction: 'Le symbole sur sa grille de construction : la boîte de {box} unités, la zone de {w} sur {h} qu’il occupe réellement, et la marge entre les deux.',
  capStem: 'hampe la plus étroite', capStroke: 'trait',
  capFills: 'occupe {w} × {h} · {feature} {thin}',
  capModule: ' · module de {unit} unités, {across} en travers',
  capBox: 'boîte de {w} unités',
  capBoxModule: 'boîte de {w} unités · {across} modules de {unit}',
  diaClearSpace: 'Zone de protection de {x} unités sur chaque côté, soit {ratio} de la hauteur du {noun}.',
  capClear: 'x = {x} unités · {ratio} de la hauteur du {noun}',
  minLead: '{px} à l’écran et {mm} en impression{alone}.',
  minAlone: ' pour le symbole seul',
  minBody: '{basis}, donc tenir le trait à {px} px et {mm} mm place le plancher là. Changez l’une ou l’autre règle et le plancher suit.',
  minBothWidth: ' Les deux chiffres sont la largeur ; le second est la hauteur qui va avec.',
  minProportion: ' Ces trois-là sont en proportion les uns des autres plutôt qu’à taille réelle : {px} px est plus large que cette page.',
  thFolder: 'Dossier', thDisappears: 'Ce qui disparaît en premier',
  thOnScreen: 'À l’écran', thInPrint: 'En impression',
  floorNote: 'Une taille minimale appartient à un dessin, et il y en a {n} dans ce dossier. Utilisez le chiffre du dossier d’où sort le fichier, pas celui au-dessus{over}.',
  floorOver: ' : {which} à {px} — un verrouillage pose le nom à côté du symbole à une fraction de sa hauteur, donc il est plus large que le symbole et sa partie la plus fine est plus fine, et les deux relèvent le plancher',
  floorOverOne: 'l’un d’eux ne tient pas', floorOverMany: '{n} d’entre eux ne tiennent pas',
});

Object.assign(EN, {
  // the size ladder
  bandAbove: '{from} px and above', bandRange: '{from} to {to} px',
  printAbove: '{from} mm and above', printRange: '{from} to {to} mm',
  ladderPiece: '{n} piece of ink.', ladderPieces: '{n} pieces of ink.',
  ladderShown: 'Shown here at {px} px, the smallest it is used at.',
  // how a part of the mark arrives — the four verbs src/motion.js can play
  howDraws: 'draws', howRises: 'rises', howFades: 'fades', howTurns: 'turns',
  ladderReadLead: 'Read it downwards.',
  ladderRead: 'Use the drawing whose band the size falls in. The switch is not a preference and not a judgement made in the moment: each rung is used from the size at which it holds down to the size at which the next one takes over, and those numbers are what the drawings measure, not what anybody decided they should be.',
  ladderBelowLead: 'Below {px} px there is nothing.',
  ladderBelowA: 'That is the identity\'s floor, and it is {px} px for the drawing at the top of this ladder — the difference between the two is the whole reason the ladder exists. Every icon and favicon in this package is cut from',
  ladderBelowB: ', because that is the drawing this identity uses at the sizes an icon lives at.',
  // the ident
  identPlaying: 'The ident, playing. It runs for {ms} ms and holds. This is the same file the package contains, not a picture of it.',
  identParts: 'Every part, when it arrives and how long it takes. The parts are the ones the master names with',
  identPartsB: '; a sequence may not name anything else.',
  identHow: 'A stroke draws itself by being given a dash the length of the line and having the dash moved off the end; a fill has no length to dash, so it rises or fades instead. Ask a fill to draw and the engine says so rather than quietly playing something else.',
  identReducedLead: 'A reader who has asked for less movement gets the finished mark and no animation.',
  identReducedA: 'Not a shortened version of the ident and not a still of the last frame — the mark, arriving already arrived.',
  identReducedB: 'holds one file per colourway, each with its own CSS inside it: nothing to install, nothing to fetch, and nothing that stops working when a player is not there.',
  // the brands inside the brand
  kinSetIn: 'Set in', kinEndorsed: 'Endorsed above',
  kinWithout: 'without the line down to {px} px; the mark alone below that.',
  kinRuleLead: 'A sub-brand is the mark and a stated difference.',
  kinRule: 'The difference is a name and a colour. Nothing here is drawn: the name is set from the face this identity ships and the lockup is composed from the mark\'s own measured ink — the name at {name} of its height, the endorsement at {endorsement}, the gap at {gap} — so a sub-brand cannot drift from its parent and a new one costs a line in the project file.',
  kinFinestLead: 'The words are the finest thing in the drawing.',
  kinFinest: 'A floor is the box divided by whatever is thinnest in it, and in an endorsed lockup that is a letter, not the mark. Each of these holds at several hundred pixels where the mark alone holds at {px}. That is not a fault, it is what the endorsement costs — so the package contains the lockup without it as well, and the figures above say where to change over.',
  // what it is made as
  thMadeAs: 'Made as', thWhichDrawing: 'Which drawing, and why',
  thFinest: 'Finest part', thProcessHolds: 'Process holds',
  fabCutFrom: 'Cut from',
  fabCutFromB: ', whose finest part measures {mm} mm there.',
  fabHolds: ', so nothing finer than {mm} mm goes to this maker.',
  fabOutline: ' The artwork is drawn in strokes and has to be outlined before it is sent.',
  fabNone: 'Nothing in this identity can be made this way at this size.',
  fabArithmeticLead: 'Every one of these is arithmetic.',
  fabArithmetic: 'A process has a smallest feature it can hold; a drawing has a finest part; the size the thing is made at turns the second into millimetres. Where the full mark does not survive, the drawing sent is the most detailed one that does — which is what the ladder in 1.5 is for.',
  fabFolder: 'holds each of them at true size, in millimetres, ready to send.',
  fabWorkingA: 'The figures a process holds are working ones and they are in',
  fabWorkingB: '. A maker who knows their own machine knows better than this file: set',
  fabWorkingC: 'on the entry and every number above moves with it.',
});

Object.assign(FR, {
  bandAbove: '{from} px et au-dessus', bandRange: 'de {from} à {to} px',
  printAbove: '{from} mm et au-dessus', printRange: 'de {from} à {to} mm',
  ladderPiece: '{n} pièce d’encre.', ladderPieces: '{n} pièces d’encre.',
  ladderShown: 'Montré ici à {px} px, la plus petite taille à laquelle il sert.',
  howDraws: 'se dessine', howRises: 'monte', howFades: 'apparaît en fondu', howTurns: 'pivote',
  ladderReadLead: 'Lisez de haut en bas.',
  ladderRead: 'Utilisez le dessin dont la plage contient la taille voulue. Le passage de l’un à l’autre n’est ni une préférence ni un jugement porté sur le moment : chaque échelon sert depuis la taille à laquelle il tient jusqu’à celle où le suivant prend le relais, et ces chiffres sont ce que les dessins mesurent, non ce que quelqu’un a décidé.',
  ladderBelowLead: 'En dessous de {px} px il n’y a rien.',
  ladderBelowA: 'C’est le plancher de l’identité, et il est de {px} px pour le dessin en haut de cette échelle — l’écart entre les deux est toute la raison d’être de l’échelle. Chaque icône et chaque favicon de ce dossier est taillé dans',
  ladderBelowB: ', parce que c’est le dessin que cette identité emploie aux tailles où vit une icône.',
  identPlaying: 'L’habillage, en lecture. Il dure {ms} ms puis se fige. C’est le fichier même que contient le dossier, pas une image de celui-ci.',
  identParts: 'Chaque partie, quand elle arrive et combien de temps elle prend. Les parties sont celles que le fichier maître nomme avec',
  identPartsB: ' ; une séquence ne peut en nommer aucune autre.',
  identHow: 'Un trait se dessine en recevant un tiret de la longueur de la ligne, tiret que l’on fait glisser hors de son extrémité ; un aplat n’a pas de longueur à tirer, il monte ou apparaît en fondu. Demandez à un aplat de se dessiner et le moteur le dit, plutôt que de jouer discrètement autre chose.',
  identReducedLead: 'Un lecteur qui a demandé moins de mouvement reçoit le symbole fini, sans animation.',
  identReducedA: 'Ni une version raccourcie de l’habillage, ni une image de la dernière image — le symbole, arrivé déjà arrivé.',
  identReducedB: 'contient un fichier par déclinaison, chacun portant son propre CSS : rien à installer, rien à télécharger, et rien qui cesse de fonctionner faute de lecteur.',
  kinSetIn: 'En', kinEndorsed: 'Avec caution au-dessus de',
  kinWithout: 'sans la ligne jusqu’à {px} px ; le symbole seul en dessous.',
  kinRuleLead: 'Une sous-marque, c’est le symbole et une différence énoncée.',
  kinRule: 'La différence est un nom et une couleur. Rien ici n’est dessiné : le nom est composé dans le caractère que livre cette identité et le verrouillage est bâti sur l’encre mesurée du symbole lui-même — le nom à {name} de sa hauteur, la caution à {endorsement}, l’écart à {gap} — de sorte qu’une sous-marque ne peut pas dériver de sa marque mère et qu’une nouvelle coûte une ligne dans le fichier de projet.',
  kinFinestLead: 'Les mots sont ce qu’il y a de plus fin dans le dessin.',
  kinFinest: 'Un plancher, c’est la boîte divisée par ce qu’elle a de plus fin, et dans un verrouillage avec caution c’est une lettre, pas le symbole. Chacun de ceux-ci tient à plusieurs centaines de pixels là où le symbole seul tient à {px}. Ce n’est pas un défaut, c’est ce que coûte la caution — le dossier contient donc aussi le verrouillage sans elle, et les chiffres ci-dessus disent où passer de l’un à l’autre.',
  thMadeAs: 'Fabriqué en', thWhichDrawing: 'Quel dessin, et pourquoi',
  thFinest: 'Partie la plus fine', thProcessHolds: 'Le procédé tient',
  fabCutFrom: 'Taillé dans',
  fabCutFromB: ', dont la partie la plus fine y mesure {mm} mm.',
  fabHolds: ', donc rien de plus fin que {mm} mm ne part chez ce fabricant.',
  fabOutline: ' Le tracé est dessiné en traits et doit être vectorisé avant l’envoi.',
  fabNone: 'Rien dans cette identité ne peut être fabriqué ainsi à cette taille.',
  fabArithmeticLead: 'Tout ceci n’est que de l’arithmétique.',
  fabArithmetic: 'Un procédé a une plus petite forme qu’il sait tenir ; un dessin a une partie la plus fine ; la taille à laquelle l’objet est fabriqué convertit la seconde en millimètres. Là où le symbole complet ne survit pas, le dessin envoyé est le plus détaillé qui survive — c’est à cela que sert l’échelle en 1.5.',
  fabFolder: 'les contient tous à taille réelle, en millimètres, prêts à envoyer.',
  fabWorkingA: 'Les chiffres qu’un procédé tient sont des valeurs de travail, et ils sont dans',
  fabWorkingB: '. Un fabricant qui connaît sa propre machine en sait plus que ce fichier : posez',
  fabWorkingC: 'sur l’entrée et tous les nombres ci-dessus suivent.',
});

Object.assign(EN, {
  // a name that is set rather than drawn
  nameLead: 'The name is not drawn.',
  nameSetInA: 'It is set in',
  nameSetInB: 'at weight {w}{caps}, tracked {track}/1000 of an em, at',
  nameCaps: ', in capitals',
  namePerCent: '{n} per cent',
  nameSetInC: 'of the mark\'s ink height — {h} units, so the name stands {stands}. Set it that way and it is right; the files in',
  nameSetInD: 'are that setting outlined at build time, so they need no font to render and will not go out of step with a sign. {family} is the {role} face in the palette above: change it there and the name is redrawn with it.',
});

Object.assign(FR, {
  nameLead: 'Le nom n’est pas dessiné.',
  nameSetInA: 'Il est composé en',
  nameSetInB: 'à la graisse {w}{caps}, approche {track}/1000 de cadratin, à',
  nameCaps: ', en capitales',
  namePerCent: '{n} pour cent',
  nameSetInC: 'de la hauteur d’encre du symbole — {h} unités, le nom mesure donc {stands}. Composé ainsi, il est juste ; les fichiers de',
  nameSetInD: 'sont cette composition vectorisée à la construction : ils n’ont besoin d’aucune fonte pour s’afficher et ne peuvent pas se désaccorder d’une enseigne. {family} est le caractère {role} de la palette ci-dessus : changez-le là et le nom est recomposé avec lui.',
});

Object.assign(EN, {
  // the palette as three other people see it
  cvAsYouSee: 'As you see it',
  visProtanopia: 'protanopia', visDeuteranopia: 'deuteranopia', visTritanopia: 'tritanopia',
  sayProtanopia: 'a protanope, who has no red cone',
  sayDeuteranopia: 'a deuteranope, who has no green cone',
  sayTritanopia: 'a tritanope, who has no blue cone',
  shareProtanopia: 'about 1 man in 100',
  shareDeuteranopia: 'about 1 man in 16, and the commonest of the three',
  shareTritanopia: 'about 1 person in 10,000',
  cvSetLead: 'The {name} set.',
  cvCoveredA: 'Nothing in it is told apart by colour alone:',
  cvIs: 'is',
  cvCoveredB: '. That is the rule, and it is the rule because two of these colours are one colour to some readers.',
  cvNotCovered: 'These are told apart by colour alone.',
  cvSomeLead: '{which} for most readers and not for all.',
  cvOnePair: 'One pair separates', cvManyPairs: '{n} pairs separate',
  cvPairNames: '{a} and {b}',
  cvPair: '{pair} are {normal} apart to you and {worst} to {kind}, {share}',
  cvPairTail: '. Every one of them passes the contrast table above, because that table measures luminance and this is hue.',
  cvAllLead: 'Every pair in this palette that separates for you separates for all three.',
  cvAll: 'Nothing here is told apart by hue alone.',
  cvMethod: 'Distances are CIE ΔE*ab, where about {floor} is the point at which two flat colours side by side stop being reliably different. The three rows are dichromacy — one cone type absent — simulated after Viénot, Brettel and Mollon (1999). The commoner condition is anomalous trichromacy, where the cone is present and shifted: those readers see a reduced version of the same thing, so every pair named here is at least harder for them and often exactly this.',
  // partner lockups
  ptOn: '{way} on {ground}.',
  ptSmallestA: 'Smallest use', ptSmallestB: '/ {mm} mm, set by {by}.',
  ptPlaced: 'Their mark is placed at {scale} of the size they supplied it at, which makes the pair {w} units wide',
  ptTimes: ' — {n} times the narrowest pair here',
  ptMissing: ' They have supplied no {which} version, so there is no pair on {which}.',
  ptOr: '{a} or {b}',
  ptScaleNote: 'The {n} above are drawn at a size each can be read at, not to one scale: {ratio} separates the widest of them from the narrowest, and at one factor the narrow ones cannot be read. The width of each is under it.',
  ptRuleLead: 'The rule.',
  ptRule: 'Their mark is set to the same {match} as ours{at}, with {gap} units either side of a {divider}, measured off our own ink height. Our half is {with}.',
  ptRuleAt: ' at {n} of it',
  ptMatchHeight: 'height', ptWithPrimary: 'the primary lockup',
  ptDividerRule: '{n} unit dividing rule', ptDividerPlain: 'plain gap',
  ptNotLead: 'What may not be done to it.',
  ptNot: '{owners} own the artwork on the right of each pair. It is not recoloured into this palette, not redrawn, and not swapped for another of their versions when the one for a ground is missing — which version goes on which ground is theirs to decide. Where a pair is not shown above, it does not exist, and only they can supply it.',
  ptFloorLead: 'The smallest use is neither brand\'s.',
  ptFloor: 'A pair is a third drawing, wider than ours and containing whatever is finest in theirs, so it has a floor of its own. Their manual states their mark alone and this one states ours; the figure under each pair above is the only place the two are measured together.',
});

Object.assign(FR, {
  cvAsYouSee: 'Comme vous les voyez',
  visProtanopia: 'protanopie', visDeuteranopia: 'deutéranopie', visTritanopia: 'tritanopie',
  sayProtanopia: 'un protanope, qui n’a pas de cône rouge',
  sayDeuteranopia: 'un deutéranope, qui n’a pas de cône vert',
  sayTritanopia: 'un tritanope, qui n’a pas de cône bleu',
  shareProtanopia: 'environ 1 homme sur 100',
  shareDeuteranopia: 'environ 1 homme sur 16, et la plus fréquente des trois',
  shareTritanopia: 'environ 1 personne sur 10 000',
  cvSetLead: 'L’ensemble {name}.',
  cvCoveredA: 'Rien n’y est distingué par la couleur seule :',
  cvIs: 'est',
  cvCoveredB: '. C’est la règle, et elle existe parce que deux de ces couleurs n’en font qu’une pour certains lecteurs.',
  cvNotCovered: 'Ceux-ci sont distingués par la couleur seule.',
  cvSomeLead: '{which} pour la plupart des lecteurs et pas pour tous.',
  cvOnePair: 'Une paire se distingue', cvManyPairs: '{n} paires se distinguent',
  cvPairNames: '{a} et {b}',
  cvPair: '{pair} sont à {normal} l’une de l’autre pour vous et à {worst} pour {kind}, {share}',
  cvPairTail: '. Chacune d’elles passe le tableau de contraste ci-dessus, parce que ce tableau mesure la luminance et qu’il s’agit ici de teinte.',
  cvAllLead: 'Toute paire de cette palette qui se distingue pour vous se distingue pour les trois.',
  cvAll: 'Rien ici n’est distingué par la teinte seule.',
  cvMethod: 'Les distances sont des ΔE*ab CIE, où environ {floor} est le point à partir duquel deux aplats côte à côte cessent d’être distinguables de façon fiable. Les trois rangées sont des dichromaties — un type de cône absent — simulées d’après Viénot, Brettel et Mollon (1999). La condition la plus répandue est la trichromatie anormale, où le cône est présent mais décalé : ces lecteurs voient une version atténuée de la même chose, donc chaque paire nommée ici leur est au moins plus difficile, et souvent exactement ceci.',
  ptOn: '{way} sur {ground}.',
  ptSmallestA: 'Plus petit emploi', ptSmallestB: '/ {mm} mm, fixé par {by}.',
  ptPlaced: 'Leur marque est posée à {scale} de la taille à laquelle ils l’ont fournie, ce qui donne une paire de {w} unités de large',
  ptTimes: ' — {n} fois la paire la plus étroite présentée ici',
  ptMissing: ' Ils n’ont fourni aucune version {which}, il n’y a donc pas de paire sur {which}.',
  ptOr: '{a} ou {b}',
  ptScaleNote: 'Les {n} ci-dessus sont dessinées à une taille où chacune se lit, et non à une seule échelle : {ratio} sépare la plus large de la plus étroite, et à facteur unique les étroites ne se lisent plus. La largeur de chacune est indiquée dessous.',
  ptRuleLead: 'La règle.',
  ptRule: 'Leur marque est mise à la même {match} que la nôtre{at}, avec {gap} unités de part et d’autre d’un {divider}, mesurées sur notre propre hauteur d’encre. Notre moitié est {with}.',
  ptRuleAt: ' à {n} de celle-ci',
  ptMatchHeight: 'hauteur', ptWithPrimary: 'le verrouillage principal',
  ptDividerRule: 'filet de séparation de {n} unité', ptDividerPlain: 'simple écart',
  ptNotLead: 'Ce qu’on ne peut pas en faire.',
  ptNot: '{owners} possèdent le tracé situé à droite de chaque paire. Il n’est ni recoloré dans cette palette, ni redessiné, ni remplacé par une autre de leurs versions quand celle prévue pour un fond manque — quelle version va sur quel fond, c’est à eux d’en décider. Là où une paire n’est pas montrée ci-dessus, elle n’existe pas, et eux seuls peuvent la fournir.',
  ptFloorLead: 'Le plus petit emploi n’appartient à aucune des deux marques.',
  ptFloor: 'Une paire est un troisième dessin, plus large que le nôtre et contenant ce que le leur a de plus fin : elle a donc son propre plancher. Leur charte énonce leur marque seule et celle-ci énonce la nôtre ; le chiffre sous chaque paire ci-dessus est le seul endroit où les deux sont mesurées ensemble.',
});

Object.assign(EN, {
  // the two drawn rules
  diaCrowd: 'Type and rules set inside the clear space of {x} units, which is what crowding the {noun} looks like.',
  diaUndersize: 'The {noun} drawn at {small} px inside the {floor} px box that is its floor.',
  // the palette
  palNoteA: 'RGB is converted from the hex.',
  palTypedLead: 'CMYK and Pantone are typed in by you',
  palNoteB: ', because what a colour becomes in ink depends on the press and the paper, and no formula knows which paper.',
  palGuessLead: '{names} {has} no build yet',
  palHas: 'has', palHave: 'have', palIt: 'it', palThem: 'them',
  palGuess: ', so the numbers shown for {it} are converted from the screen colour and marked with a question mark. Do not send {it} to a press.',
  palEveryOne: 'Every colour here has one.',
  // the gradient
  gradCap: '{slots} · {n} stops · {kind}',
  gradAt: 'at {offsets}, read off the artwork.',
  gradAnd: '{a} and {b}',
  gradCarriedA: 'Carried in', gradCarriedB: ', and repainted flat in {flat}.',
  gradNothingElse: 'nothing else',
  gradNoneLead: 'No colourway keeps it', gradNone: ', so it is in the master and in none of the files.',
  gradSpot: 'A gradient cannot be printed as a spot ink, so the flat version is the one a one- or two-colour job uses, and a PDF carrying the gradient has that part in DeviceRGB whatever the rest is in.',
  // the pattern
  patMotifLabel: '{name}, the shape this pattern is built from',
  patCell: '{density} · cell {n}',
  patWeight: 'The line weight is the same fraction of the motif that the {noun}\'s stroke is of the {noun}, and the air around it is the clear space rule, so the field is drawn in the same hand at any size.',
  patChosen: ' Chosen from {n} {shapes} in the drawing and {m} constructions; the canvas offers every one of them.',
  patShape: 'shape', patShapes: 'shapes',
  patDensities: '{d} densities in {c} {colourways} —',
  patColourway: 'colourway', patColourways: 'colourways',
  patTiles: '{n} tiles',
  patAllIn: ', all in the package, every one of them seamless in both directions. Redraw the {noun} and all {n} are cut again.',
  // photography
  phRamp: 'a grey ramp, treated', phUnderScrim: ', under the scrim',
  phDuoA: 'Every photograph is a duotone from', phDuoB: 'in the shadows to',
  phDuoC: 'in the highlights, at {pct} per cent.',
  phUntreated: 'Photographs run untreated.',
  phScrim: 'A scrim of {colour} at {pct} per cent runs from the {dir}, which is what type sits on.',
  edgeTop: 'top', edgeBottom: 'bottom', edgeLeft: 'left', edgeRight: 'right', edgeFlat: 'flat',
  phCrops: 'Crops are {ratios}.',
  phEditor: 'The editor measures the mark against the pixels actually under it and says which colourway reads there, so this is a rule you can check rather than one you have to remember.',
  // the icon grid
  diaIconGrid: 'The icon grid: a {box} unit box with a {live} unit live area and a {stroke} unit stroke.',
  capIconGrid: '{box} unit box · {live} live · {stroke} stroke',
  iconFigure: 'the grid every icon is drawn on',
  iconA: 'Not decided: taken from the {noun} itself. Its box is {vb} units and it fills {ink} of them, so the margin is {margin} —',
  iconB: ', which is the same margin an icon keeps. Its narrowest part is {stroke} units, which is',
  iconC: 'of the box, so an icon\'s stroke is {s} in a {b} box. Ends are {cap}, corners {join}, and the set is {fill}. Redraw the {noun} and these move with it. Run',
  iconFilled: 'filled', iconOutline: 'drawn in outline',
  iconD: 'to have one measured against them.',
  iconSimplifiedA: 'The icons are not the mark. A crest or any drawing with fine parts closes up at icon sizes, so this identity has a simplified drawing for them — fewer parts, heavier strokes, the same meaning. It is what everything in',
  iconSimplifiedB: 'is cut from.',
  // motion
  diaCurve: '{label}, a cubic bezier through {points}.',
  motDurations: 'how long each thing takes',
  motBuildsA: 'The mark builds in {n} parts:',
  motStepFrom: 'from {from} to {to} ms on',
  motBuildsB: '. It {loop}. The parts are the ones the master names, and',
  motLoops: 'loops', motPlaysOnce: 'plays once and holds',
  motBuildsC: 'holds the file that plays them.',
  motNoBuildA: 'This identity has not said how the mark builds, so nothing here does. The curves and the durations above apply to anything that moves — a panel, a menu, a page — and the sequence the mark itself arrives in is a decision, which means it is one somebody has to make rather than one the engine can supply. Mark the parts in the master with',
  motNoBuildB: 'and give each a step in',
  motNoBuildC: ', and the package will contain a file that plays it.',
  motWhole: 'Two curves and {n} durations are the whole of it; anything else on screen is one of these.',
  // contrast
  thSample: 'Sample', thPair: 'Pair', thRatio: 'Ratio', thVerdict: 'Verdict',
  ctNote: 'Every pair in the palette, checked against WCAG 2.2 and sorted worst last. Nothing here is softened, so the combinations that do not work are listed rather than left for somebody to discover.',
  // what is in the package
  asFilesLead: '{n} files.',
  asFiles: 'Every one cut from the master at the moment the package was built, so no old variant can survive in a corner of the folder. The client keeps this whether or not anyone is still paying for the tool that made it.',
  // what changed
  cngSameA: 'This package is version', cngSameB: 'and the last one was',
  cngSameC: ', and nothing measured here is different between them: same palette, same lockups, same colourways, same floor, same clear space. Anyone holding the last package can keep it.',
  cngComparedA: 'Compared with', cngComparedB: ': {n} {changes}.',
  cngOne: 'change', cngMany: 'changes',
  cngBreaking: '{n} of {those} {retires} something that already exists.',
  cngThem: 'them', cngThose: 'those', cngRetires: 'retires', cngRetire: 'retire',
  cngBreakingNote: 'Nothing in the files anyone already holds changes on its own, so until somebody acts on this list both versions are in use at once and both look correct.',
  cngNoneRetires: 'None of them retires anything already made.',
});

Object.assign(FR, {
  diaCrowd: 'Du texte et des filets posés dans la zone de protection de {x} unités : voilà à quoi ressemble un {noun} enserré.',
  diaUndersize: 'Le {noun} dessiné à {small} px dans la boîte de {floor} px qui est son plancher.',
  palNoteA: 'Le RVB est converti depuis l’hexadécimal.',
  palTypedLead: 'Le CMJN et le Pantone sont saisis par vous',
  palNoteB: ', parce que ce qu’une couleur devient en encre dépend de la presse et du papier, et qu’aucune formule ne sait quel papier.',
  palGuessLead: '{names} n’{has} pas encore de formule',
  palHas: 'a', palHave: 'ont', palIt: 'elle', palThem: 'elles',
  palGuess: ', donc les chiffres montrés pour {it} sont convertis depuis la couleur d’écran et marqués d’un point d’interrogation. Ne {it} envoyez pas sur presse.',
  palEveryOne: 'Chaque couleur ici en a une.',
  gradCap: '{slots} · {n} arrêts · {kind}',
  gradAt: 'à {offsets}, relevés sur le tracé.',
  gradAnd: '{a} et {b}',
  gradCarriedA: 'Porté par', gradCarriedB: ', et repeint à plat dans {flat}.',
  gradNothingElse: 'rien d’autre',
  gradNoneLead: 'Aucune déclinaison ne le garde', gradNone: ' : il est dans le fichier maître et dans aucun des fichiers livrés.',
  gradSpot: 'Un dégradé ne s’imprime pas en ton direct : la version à plat est celle qu’emploie un travail en une ou deux couleurs, et un PDF portant le dégradé a cette partie en DeviceRGB quel que soit le reste.',
  patMotifLabel: '{name}, la forme dont ce motif est construit',
  patCell: '{density} · cellule {n}',
  patWeight: 'La graisse du filet est la même fraction du motif que le trait du {noun} l’est du {noun}, et l’air autour de lui est la règle de zone de protection : le champ est donc dessiné de la même main à toute taille.',
  patChosen: ' Choisi parmi {n} {shapes} du dessin et {m} constructions ; le canevas les propose toutes.',
  patShape: 'forme', patShapes: 'formes',
  patDensities: '{d} densités en {c} {colourways} —',
  patColourway: 'déclinaison', patColourways: 'déclinaisons',
  patTiles: '{n} tuiles',
  patAllIn: ', toutes dans le dossier, chacune raccordant sans couture dans les deux sens. Redessinez le {noun} et les {n} sont retaillées.',
  phRamp: 'un dégradé de gris, traité', phUnderScrim: ', sous le voile',
  phDuoA: 'Chaque photographie est un duoton allant de', phDuoB: 'dans les ombres à',
  phDuoC: 'dans les hautes lumières, à {pct} pour cent.',
  phUntreated: 'Les photographies restent sans traitement.',
  phScrim: 'Un voile de {colour} à {pct} pour cent descend depuis {dir}, et c’est là-dessus que se pose le texte.',
  edgeTop: 'le haut', edgeBottom: 'le bas', edgeLeft: 'la gauche', edgeRight: 'la droite', edgeFlat: 'partout',
  phCrops: 'Les cadrages sont {ratios}.',
  phEditor: 'L’éditeur mesure le symbole contre les pixels qui se trouvent réellement dessous et dit quelle déclinaison s’y lit : c’est donc une règle vérifiable plutôt qu’une règle à retenir.',
  diaIconGrid: 'La grille d’icônes : une boîte de {box} unités, une zone utile de {live} unités et un trait de {stroke} unités.',
  capIconGrid: 'boîte de {box} unités · {live} utiles · trait de {stroke}',
  iconFigure: 'la grille sur laquelle chaque icône est dessinée',
  iconA: 'Non décidé : relevé sur le {noun} lui-même. Sa boîte fait {vb} unités et il en occupe {ink}, la marge est donc de {margin} —',
  iconB: ', soit la même marge que garde une icône. Sa partie la plus étroite fait {stroke} unités, soit',
  iconC: 'de la boîte : le trait d’une icône est donc de {s} dans une boîte de {b}. Les extrémités sont {cap}, les angles {join}, et le jeu est {fill}. Redessinez le {noun} et tout ceci suit. Lancez',
  iconFilled: 'plein', iconOutline: 'dessiné en filaire',
  iconD: 'pour faire mesurer une icône contre ces valeurs.',
  iconSimplifiedA: 'Les icônes ne sont pas le symbole. Un blason, ou tout dessin à parties fines, se referme aux tailles d’icône : cette identité possède donc un dessin simplifié pour elles — moins de parties, des traits plus gras, le même sens. C’est de lui qu’est taillé tout ce que contient',
  iconSimplifiedB: '.',
  diaCurve: '{label}, une courbe de Bézier cubique passant par {points}.',
  motDurations: 'combien de temps prend chaque chose',
  motBuildsA: 'Le symbole se construit en {n} parties :',
  motStepFrom: 'de {from} à {to} ms sur',
  motBuildsB: '. Il {loop}. Les parties sont celles que nomme le fichier maître, et',
  motLoops: 'boucle', motPlaysOnce: 'joue une fois puis se fige',
  motBuildsC: 'contient le fichier qui les joue.',
  motNoBuildA: 'Cette identité n’a pas dit comment le symbole se construit : rien ici ne le fait donc. Les courbes et les durées ci-dessus valent pour tout ce qui bouge — un panneau, un menu, une page — et la séquence dans laquelle le symbole lui-même arrive est une décision, c’est-à-dire une chose que quelqu’un doit prendre et que le moteur ne peut pas fournir. Marquez les parties dans le fichier maître avec',
  motNoBuildB: 'et donnez à chacune une étape dans',
  motNoBuildC: ', et le dossier contiendra un fichier qui la joue.',
  motWhole: 'Deux courbes et {n} durées, c’est tout ; tout le reste à l’écran est l’une d’elles.',
  thSample: 'Échantillon', thPair: 'Paire', thRatio: 'Rapport', thVerdict: 'Verdict',
  ctNote: 'Chaque paire de la palette, vérifiée contre la norme WCAG 2.2 et triée la pire en dernier. Rien n’est adouci ici : les combinaisons qui ne fonctionnent pas sont listées plutôt que laissées à découvrir.',
  asFilesLead: '{n} fichiers.',
  asFiles: 'Chacun taillé dans le fichier maître au moment où le dossier a été construit : aucune ancienne variante ne peut survivre dans un coin du dossier. Le client garde tout ceci, que quelqu’un paie encore ou non pour l’outil qui l’a produit.',
  cngSameA: 'Ce dossier est la version', cngSameB: 'et le précédent était le',
  cngSameC: ', et rien de ce qui est mesuré ici ne diffère entre les deux : même palette, mêmes verrouillages, mêmes déclinaisons, même plancher, même zone de protection. Qui détient le dossier précédent peut le garder.',
  cngComparedA: 'Par rapport au', cngComparedB: ' : {n} {changes}.',
  cngOne: 'changement', cngMany: 'changements',
  cngBreaking: '{n} {retires} quelque chose qui existe déjà.',
  cngThem: 'eux', cngThose: 'ceux-là', cngRetires: 'd’entre eux retire', cngRetire: 'd’entre eux retirent',
  cngBreakingNote: 'Rien dans les fichiers déjà détenus ne change de soi-même : tant que personne n’agit sur cette liste, les deux versions sont en usage en même temps et les deux paraissent correctes.',
  cngNoneRetires: 'Aucun d’eux ne retire quoi que ce soit de déjà fabriqué.',
});

// Prose that reaches the manual from further down: what a making process can
// hold, why the engine picked the shape it built the pattern from, and which
// half of a partner pair sets the floor. Each module keeps its English beside
// the key, because brand.json and the command line are read as English.
Object.assign(EN, {
  procEmbroidery: 'embroidery', procVinyl: 'vinyl', procScreenprint: 'screenprint',
  procFoil: 'foil', procEngraving: 'engraving', procCast: 'cast',
  whatEmbroidery: 'a satin stitch narrower than this will not lie down, and reads as a crease rather than a line',
  whatVinyl: 'anything narrower than this tears when the waste is weeded off the backing',
  whatScreenprint: 'a line finer than this fills in or breaks up depending on the mesh',
  whatFoil: 'below this the foil bridges the gap and the detail fills in solid',
  whatEngraving: 'a groove narrower than the tool cannot be cut at all',
  whatCast: 'metal thinner than this does not fill the mould, and what does fill it will not survive being handled',
  whyMarked: 'the master marks this shape with data-pattern="source", so it was not a choice the engine had to make.',
  whySquare: 'it is close to square, so it repeats as a field rather than as stripes',
  whySquarish: 'it is squarish enough to repeat without reading as stripes',
  whySimple: 'it is simple enough to survive being drawn a tenth of the size the mark is',
  whySubstantial: 'it is a substantial part of the drawing rather than a fragment of one',
  whyRanked: 'Ranked first of {n} {shapes} in the drawing',
  whyOthers: '; the others are offered beside it',
  ptOurHalf: 'our half', ptTheirMark: 'their mark', ptTheRule: 'the rule between them',
});

Object.assign(FR, {
  procEmbroidery: 'broderie', procVinyl: 'vinyle', procScreenprint: 'sérigraphie',
  procFoil: 'dorure à chaud', procEngraving: 'gravure', procCast: 'fonte',
  whatEmbroidery: 'un point de bourdon plus étroit que cela ne se couche pas et se lit comme un pli plutôt que comme une ligne',
  whatVinyl: 'tout ce qui est plus étroit que cela se déchire quand on écheniller le support',
  whatScreenprint: 'une ligne plus fine que cela se bouche ou se rompt selon la trame',
  whatFoil: 'en dessous, la feuille ponte l’intervalle et le détail se remplit en plein',
  whatEngraving: 'une gorge plus étroite que l’outil ne peut pas être creusée du tout',
  whatCast: 'un métal plus mince que cela ne remplit pas le moule, et ce qui le remplit ne survit pas à la manipulation',
  whyMarked: 'le fichier maître marque cette forme avec data-pattern="source" : ce n’était donc pas un choix que le moteur avait à faire.',
  whySquare: 'elle est proche du carré : elle se répète en champ plutôt qu’en rayures',
  whySquarish: 'elle est assez carrée pour se répéter sans se lire comme des rayures',
  whySimple: 'elle est assez simple pour survivre dessinée au dixième de la taille du symbole',
  whySubstantial: 'elle est une part substantielle du dessin plutôt qu’un fragment',
  whyRanked: 'Classée première sur {n} {shapes} du dessin',
  whyOthers: ' ; les autres sont proposées à côté d’elle',
  ptOurHalf: 'notre moitié', ptTheirMark: 'leur marque', ptTheRule: 'le filet entre les deux',
});

// What moved since the last version. These three sentences per change are also
// the body of CHANGES.txt, which is English by design like README.txt and the
// command line; src/previous.js keeps the English beside the key so both stay
// true. Without this, chapter 00 of a French manual was an English chapter.
Object.assign(EN, {
  cgUp: 'up', cgDown: 'down', cgAnd: '{a} and {b}',
  cgMinWhat: 'the smallest usable size has gone {dir}, from {fa} px / {ma} mm to {fb} px / {mb} mm.',
  cgMinWhyUp: 'Anything already made between {fa} px and {fb} px was inside the rule when it was made and is outside it now: small print, favicons, embroidery, anything cut in vinyl. The artwork in those places has not changed, so nothing about them looks wrong until it is printed. The new artwork has a finer part in it, and the floor is set by whatever disappears first.',
  cgMinWhyDown: 'The new artwork has no part finer than the old one, so it survives further down. Nothing already made is affected.',
  cgMinHowUp: 'List where the mark appears below {fb} px or {mb} mm and either enlarge it or use a lockup that holds at that size. 05-icons shows which sizes the new artwork clears.',
  cgMinHowDown: 'Nothing to do. The old floor still holds, so existing applications stay inside the rule.',
  cgLockWhat: 'the {l} lockup now holds at {yp} px / {ym} mm, where it held at {xp} px / {xm} mm.',
  cgLockWhyUp: 'Every use of that one lockup below {yp} px was inside the rule and is outside it now. The mark\'s own floor says nothing about this: a lockup is a different drawing.',
  cgLockWhyDown: 'It survives further down than it did, so nothing already made in it is affected.',
  cgLockHowUp: 'Check where {l} is placed and raise it, or use a lockup that holds at the size you need.',
  cgNothingToDo: 'Nothing to do.',
  cgPartnerAddedWhat: '{name} is a new partner.',
  cgPartnerAddedWhy: 'Nothing already made carries the pair, so it adds to the set without disturbing anything.',
  cgPartnerAddedHow: 'The pairs they have supplied artwork for are in 11-partners.',
  cgPartnerVersionWhat: 'the {name} pair is no longer made in {gone}.',
  cgPartnerVersionWhy: '{owner} has withdrawn the version of their mark that stood on that ground, or it was taken out of this project. Files already handed out still carry it and still look correct.',
  cgPartnerVersionHow: 'Ask {owner} whether the version is withdrawn or only missing, and say which pair replaces it.',
  cgPartnerGoneWhat: '{name} is no longer a partner in this package.',
  cgPartnerGoneWhy: 'Every pair made with them has gone with them, and nothing on the files anyone already holds says so. A partner lockup outlives the partnership unless somebody withdraws it.',
  cgPartnerGoneHow: 'Say when the {name} pair stops being used, and tell whoever is holding artwork of it.',
  cgClearWhat: 'clear space has gone from {ca} to {cb} units.',
  cgClearWhyUp: 'Every layout built to the old figure now reserves too little, and the mark sits closer to its neighbours than the rule allows. The number is a fraction of the mark, and the mark changed shape.',
  cgClearWhyDown: 'Layouts built to the old figure reserve more than the rule now asks for, which is safe.',
  cgClearHowUp: 'Templates, ad slots and signage artwork that hard coded the old figure need it raised.',
  cgColourAddedWhat: '{name} is a new colour, {hex}.',
  cgColourAddedWhy: 'Nothing already made uses it, so it adds to the palette without disturbing it.',
  cgColourAddedHow: 'It is in 07-colour and in the contrast table with every pair it makes.',
  cgColourMovedWhat: '{name} has moved from {a} to {b}.',
  cgColourMovedWhy: 'Stock already printed, sites already built and files already handed out carry the old value. A colour that has moved a little is worse than one that has moved a lot, because the two sit side by side and read as a printing fault rather than as two versions.',
  cgColourMovedHow: 'Search for {a} in code and templates and replace it. For anything already printed, decide whether it is reprinted or allowed to run out.',
  cgPantoneWhat: '{name} keeps its screen value and changes Pantone, {a} to {b}.',
  cgPantoneNone: 'none',
  cgPantoneWhy: 'Print buyers work from the Pantone, so a job already at a press is being matched to the old chip.',
  cgPantoneHow: 'Tell whoever holds the print specification. Nothing on screen changes.',
  cgColourGoneWhat: '{name} ({hex}) has been withdrawn from the palette.',
  cgColourGoneWhy: 'Anything already made in it is now off palette, and nothing on those files says so. The colour does not stop existing because it left the token list.',
  cgColourGoneHow: 'Decide what replaces {hex} where it is already in use, and say so to whoever holds those files.',
  cgLockup: 'lockup', cgColourway: 'colourway',
  cgSetGoneWhatOne: '{list} is a {label} that has been withdrawn.',
  cgSetGoneWhatMany: '{list} are {label}s that have been withdrawn.',
  cgWhereLockupsOne: '{folders} is not in this package',
  cgWhereLockupsMany: '{folders} are not in this package',
  cgWhereColourways: 'no file in this package ends {suffixes}, and no colourway of that name is',
  cgSetGoneWhy: '{where}. Files are named {brand}-{lockup}-{colourway}, so the ones already downloaded keep working and keep their names, and nothing about them announces that they are no longer part of the identity.',
  cgSetGoneHowOne: 'Say which {label} replaces it and where. Anyone comparing the old package to this one will otherwise read it as a file that failed to build.',
  cgSetGoneHowMany: 'Say which {label} replaces them and where. Anyone comparing the old package to this one will otherwise read them as a file that failed to build.',
  cgSetAddedWhatOne: '{list} is a new {label}.',
  cgSetAddedWhatMany: '{list} are new {label}s.',
  cgSetAddedWhyOne: 'Nothing already made refers to it, so it adds to the set without disturbing it.',
  cgSetAddedWhyMany: 'Nothing already made refers to them, so they add to the set without disturbing it.',
  cgSetAddedHowLockupsOne: 'It is in {folders}.', cgSetAddedHowLockupsMany: 'They are in {folders}.',
  cgSetAddedHowWaysOne: 'Every lockup is written in it alongside the others.',
  cgSetAddedHowWaysMany: 'Every lockup is written in them alongside the others.',
  cgAllowsAAA: 'any text at any size', cgAllowsAA: 'body text and above',
  cgAllowsLarge: 'headings at 24 px and above, and shapes', cgAllowsNever: 'no text at all',
  cgContrastWhat: '{pair} {verb} what it did: {ra}:1 {va} is now {rb}:1 {vb}.',
  cgNoLonger: 'no longer reaches', cgNowReaches: 'now reaches',
  cgContrastWhyFell: 'Text already set in this pair passed when it was set and does not now. The words did not change and the layout did not change, so there is nothing on the page to look at — only the colour underneath moved.',
  cgContrastWhyRose: 'A pair that was restricted has more room than it had.',
  cgContrastHowSome: 'This pair is now good for {allows}. Find where it carries anything smaller and change the size or one of the two colours.',
  cgContrastHowNone: 'Take text out of this pair wherever it appears, or change one of the two colours.',
  cgContrastHowRose: 'The pair is now good for {allows}, where the last version allowed {was}.',
  cgVisionWhat: '{pair} could be told apart in the last version and cannot now: they are {normal} apart to most readers and {worst} to a {kind}.',
  cgVisionWhy: 'A colour moved and took this with it. Contrast is a ratio of luminance and does not catch it: both of these still pass every ratio in the table. Anything that uses the two to mean different things — a key, a chart, a status, a map — stopped working for those readers at this version and nothing on the page says so.',
  cgVisionHow: 'Move one of them back or further, or give whatever uses them a second channel — a shape, a fill, a word — and name it in tokens.sets so the engine holds the next version to it.',
  cgIconWhat: 'icons are drawn at {b} on a {box} box, where the last version drew them at {a}.',
  cgIconWhy: 'The icon weight is taken off the master, so redrawing the master redraws the whole icon set without anyone asking for it. Icons already in a product were built to the old weight and now sit beside the new ones.',
  cgIconHow: 'Either redraw the existing icons at {b}, or set system.icons.stroke to {a} to hold the set where it was.',
});

Object.assign(FR, {
  cgUp: 'monté', cgDown: 'descendu', cgAnd: '{a} et {b}',
  cgMinWhat: 'la plus petite taille utilisable a {dir}, de {fa} px / {ma} mm à {fb} px / {mb} mm.',
  cgMinWhyUp: 'Tout ce qui a déjà été fabriqué entre {fa} px et {fb} px respectait la règle au moment de sa fabrication et ne la respecte plus : petits imprimés, favicons, broderie, tout ce qui est découpé dans du vinyle. Le tracé y est inchangé, donc rien n’y paraît fautif avant l’impression. Le nouveau tracé comporte une partie plus fine, et le plancher est fixé par ce qui disparaît en premier.',
  cgMinWhyDown: 'Le nouveau tracé n’a aucune partie plus fine que l’ancien : il survit donc plus bas. Rien de ce qui est déjà fabriqué n’est touché.',
  cgMinHowUp: 'Relevez les endroits où le symbole apparaît en dessous de {fb} px ou {mb} mm et agrandissez-le, ou employez un verrouillage qui tient à cette taille. 05-icons montre quelles tailles le nouveau tracé passe.',
  cgMinHowDown: 'Rien à faire. L’ancien plancher tient toujours : les applications existantes restent dans la règle.',
  cgLockWhat: 'le verrouillage {l} tient désormais à {yp} px / {ym} mm, là où il tenait à {xp} px / {xm} mm.',
  cgLockWhyUp: 'Tout emploi de ce seul verrouillage en dessous de {yp} px respectait la règle et ne la respecte plus. Le plancher propre au symbole ne dit rien de ceci : un verrouillage est un autre dessin.',
  cgLockWhyDown: 'Il survit plus bas qu’avant : rien de ce qui est déjà fabriqué avec lui n’est touché.',
  cgLockHowUp: 'Vérifiez où {l} est posé et remontez-le, ou employez un verrouillage qui tient à la taille voulue.',
  cgNothingToDo: 'Rien à faire.',
  cgPartnerAddedWhat: '{name} est un nouveau partenaire.',
  cgPartnerAddedWhy: 'Rien de ce qui est déjà fabriqué ne porte la paire : elle s’ajoute à l’ensemble sans rien déranger.',
  cgPartnerAddedHow: 'Les paires pour lesquelles ils ont fourni un tracé sont dans 11-partners.',
  cgPartnerVersionWhat: 'la paire {name} n’est plus fabriquée en {gone}.',
  cgPartnerVersionWhy: '{owner} a retiré la version de sa marque qui se posait sur ce fond, ou bien elle a été sortie de ce projet. Les fichiers déjà remis la portent encore et paraissent encore corrects.',
  cgPartnerVersionHow: 'Demandez à {owner} si la version est retirée ou seulement manquante, et dites quelle paire la remplace.',
  cgPartnerGoneWhat: '{name} n’est plus partenaire dans ce dossier.',
  cgPartnerGoneWhy: 'Toutes les paires faites avec eux sont parties avec eux, et rien sur les fichiers déjà détenus ne le dit. Un verrouillage partenaire survit au partenariat tant que personne ne le retire.',
  cgPartnerGoneHow: 'Dites à partir de quand la paire {name} cesse d’être employée, et prévenez qui en détient le tracé.',
  cgClearWhat: 'la zone de protection est passée de {ca} à {cb} unités.',
  cgClearWhyUp: 'Toute mise en page bâtie sur l’ancien chiffre réserve désormais trop peu, et le symbole se retrouve plus près de ses voisins que la règle ne l’autorise. Ce nombre est une fraction du symbole, et le symbole a changé de forme.',
  cgClearWhyDown: 'Les mises en page bâties sur l’ancien chiffre réservent plus que la règle ne demande, ce qui est sans risque.',
  cgClearHowUp: 'Les gabarits, emplacements publicitaires et tracés d’enseigne qui ont figé l’ancien chiffre doivent le relever.',
  cgColourAddedWhat: '{name} est une nouvelle couleur, {hex}.',
  cgColourAddedWhy: 'Rien de ce qui est déjà fabriqué ne l’emploie : elle s’ajoute à la palette sans la déranger.',
  cgColourAddedHow: 'Elle est dans 07-colour et dans le tableau de contraste avec chaque paire qu’elle forme.',
  cgColourMovedWhat: '{name} est passée de {a} à {b}.',
  cgColourMovedWhy: 'Les stocks déjà imprimés, les sites déjà construits et les fichiers déjà remis portent l’ancienne valeur. Une couleur qui a peu bougé est pire qu’une couleur qui a beaucoup bougé, parce que les deux se retrouvent côte à côte et se lisent comme un défaut d’impression plutôt que comme deux versions.',
  cgColourMovedHow: 'Cherchez {a} dans le code et les gabarits et remplacez-la. Pour ce qui est déjà imprimé, décidez si on réimprime ou si on laisse s’écouler.',
  cgPantoneWhat: '{name} garde sa valeur écran et change de Pantone, {a} devient {b}.',
  cgPantoneNone: 'aucun',
  cgPantoneWhy: 'Les acheteurs d’impression travaillent d’après le Pantone : un travail déjà sur presse est donc calé sur l’ancienne référence.',
  cgPantoneHow: 'Prévenez qui détient le cahier des charges d’impression. Rien ne change à l’écran.',
  cgColourGoneWhat: '{name} ({hex}) a été retirée de la palette.',
  cgColourGoneWhy: 'Tout ce qui est déjà fabriqué dans cette couleur est désormais hors palette, et rien sur ces fichiers ne le dit. Une couleur ne cesse pas d’exister parce qu’elle a quitté la liste des tokens.',
  cgColourGoneHow: 'Décidez ce qui remplace {hex} là où elle est déjà employée, et dites-le à qui détient ces fichiers.',
  cgLockup: 'verrouillage', cgColourway: 'déclinaison',
  cgSetGoneWhatOne: '{list} est un {label} qui a été retiré.',
  cgSetGoneWhatMany: '{list} sont des {label}s qui ont été retirés.',
  cgWhereLockupsOne: '{folders} n’est pas dans ce dossier',
  cgWhereLockupsMany: '{folders} ne sont pas dans ce dossier',
  cgWhereColourways: 'aucun fichier de ce dossier ne se termine par {suffixes}, et aucune déclinaison de ce nom n’est',
  cgSetGoneWhy: '{where}. Les fichiers sont nommés {brand}-{lockup}-{colourway} : ceux déjà téléchargés continuent de fonctionner et gardent leur nom, et rien en eux n’annonce qu’ils ne font plus partie de l’identité.',
  cgSetGoneHowOne: 'Dites quel {label} le remplace et où. Sinon, qui comparera l’ancien dossier à celui-ci le lira comme un fichier dont la construction a échoué.',
  cgSetGoneHowMany: 'Dites quel {label} les remplace et où. Sinon, qui comparera l’ancien dossier à celui-ci les lira comme des fichiers dont la construction a échoué.',
  cgSetAddedWhatOne: '{list} est un nouveau {label}.',
  cgSetAddedWhatMany: '{list} sont de nouveaux {label}s.',
  cgSetAddedWhyOne: 'Rien de ce qui est déjà fabriqué n’y renvoie : il s’ajoute à l’ensemble sans le déranger.',
  cgSetAddedWhyMany: 'Rien de ce qui est déjà fabriqué n’y renvoie : ils s’ajoutent à l’ensemble sans le déranger.',
  cgSetAddedHowLockupsOne: 'Il est dans {folders}.', cgSetAddedHowLockupsMany: 'Ils sont dans {folders}.',
  cgSetAddedHowWaysOne: 'Chaque verrouillage y est écrit à côté des autres.',
  cgSetAddedHowWaysMany: 'Chaque verrouillage y est écrit à côté des autres.',
  cgAllowsAAA: 'tout texte à toute taille', cgAllowsAA: 'le texte courant et au-dessus',
  cgAllowsLarge: 'les titres à partir de 24 px, et les formes', cgAllowsNever: 'aucun texte',
  cgContrastWhat: '{pair} {verb} ce qu’elle atteignait : {ra}:1 {va} devient {rb}:1 {vb}.',
  cgNoLonger: 'n’atteint plus', cgNowReaches: 'atteint désormais',
  cgContrastWhyFell: 'Le texte déjà composé dans cette paire passait au moment où il a été composé et ne passe plus. Les mots n’ont pas changé et la mise en page non plus : il n’y a donc rien à regarder sur la page, seule la couleur en dessous a bougé.',
  cgContrastWhyRose: 'Une paire qui était restreinte a plus de marge qu’avant.',
  cgContrastHowSome: 'Cette paire convient désormais à {allows}. Trouvez où elle porte quelque chose de plus petit et changez la taille ou l’une des deux couleurs.',
  cgContrastHowNone: 'Retirez le texte de cette paire partout où elle apparaît, ou changez l’une des deux couleurs.',
  cgContrastHowRose: 'La paire convient désormais à {allows}, là où la version précédente autorisait {was}.',
  cgVisionWhat: '{pair} pouvaient être distinguées dans la version précédente et ne le peuvent plus : elles sont à {normal} l’une de l’autre pour la plupart des lecteurs et à {worst} pour un {kind}.',
  cgVisionWhy: 'Une couleur a bougé et a emporté ceci avec elle. Le contraste est un rapport de luminance et ne l’attrape pas : ces deux-là passent encore tous les rapports du tableau. Tout ce qui emploie les deux pour signifier des choses différentes — une légende, un graphique, un état, une carte — a cessé de fonctionner pour ces lecteurs à cette version, et rien sur la page ne le dit.',
  cgVisionHow: 'Éloignez ou rapprochez l’une des deux, ou donnez à ce qui les emploie un second canal — une forme, un aplat, un mot — et nommez-le dans tokens.sets pour que le moteur y tienne la prochaine version.',
  cgIconWhat: 'les icônes sont dessinées à {b} dans une boîte de {box}, là où la version précédente les dessinait à {a}.',
  cgIconWhy: 'La graisse des icônes est relevée sur le fichier maître : redessiner le maître redessine donc tout le jeu d’icônes sans que personne l’ait demandé. Les icônes déjà en production ont été bâties à l’ancienne graisse et voisinent maintenant avec les nouvelles.',
  cgIconHow: 'Soit redessinez les icônes existantes à {b}, soit fixez system.icons.stroke à {a} pour tenir le jeu où il était.',
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
