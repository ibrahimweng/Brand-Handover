'use strict';
/* Who is allowed to build what, and what the client gets.

   Two honest limits on this file, stated here because a billing system that
   overstates itself is worse than none.

   First, there is no server in this project, and accounts and billing without
   one are not a real thing. What is here is the half that has to be settled
   before a server is worth writing: what the plans are, what each one permits,
   how a permission is proved, and what the client ends up owning. The other
   half — sign up, take a card, handle a webhook, revoke on non-payment — is a
   server, and src/../README.md says plainly what it needs.

   Second, this is a signature, not a lock. The engine runs on the designer's
   own machine, so anybody can edit it. What a signature buys is that a licence
   cannot be forged or edited: the plan, the dates and the holder are fixed at
   issue, so a support conversation is about facts rather than claims. Real
   enforcement, the day it matters, is the server refusing to generate the
   package at all.

   The plan this product is arguing against is the one where the client inherits
   the designer's subscription. So the licence deliberately splits in two: the
   designer holds a seat and pays for it, and the client owns the package
   outright, forever, with no account. That is written into the package. */
const crypto = require('crypto');

// ------------------------------------------------------------------- plans
// A limit is only worth having if it is a number the engine already knows how
// to count. These are all read straight off a project or a build.
const PLANS = {
  trial: {
    name: 'Trial', projects: 1, colourways: 2, lockups: 2,
    print: false, mockups: false, publish: true, mark: true,
    why: 'enough to run one identity end to end and see whether the thing works',
  },
  solo: {
    name: 'Solo', projects: 8, colourways: 6, lockups: 6,
    print: true, mockups: true, publish: true, mark: false,
    why: 'one designer, the whole engine',
  },
  studio: {
    name: 'Studio', projects: Infinity, colourways: Infinity, lockups: Infinity,
    print: true, mockups: true, publish: true, mark: false,
    why: 'a studio, and the client packages it hands over',
  },
};

const FEATURES = {
  print: 'the print path: CMYK assets, bleed, crop marks and a printed piece',
  mockups: 'mockups: the mark mapped into a photograph',
  publish: 'publishing a document as a page',
};

// ------------------------------------------------------------- the licence
// Small on purpose. Everything in it is either a fact about the holder or a
// number the engine checks, and nothing is a promise it cannot keep.
function body(licence) {
  const l = licence || {};
  return JSON.stringify({
    v: 1, holder: l.holder || '', email: l.email || '', plan: l.plan || 'trial',
    issued: l.issued || '', expires: l.expires || '', seats: l.seats || 1,
  });
}

function sign(licence, privateKeyPem) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const text = body(licence);
  const sig = crypto.sign(null, Buffer.from(text), key).toString('base64');
  return Object.assign({}, JSON.parse(text), { signature: sig });
}

// The result says which of three things is true, because "invalid" covers two
// very different conversations: a licence that was tampered with, and one that
// simply ran out.
function verify(licence, publicKeyPem, now) {
  if (!licence || typeof licence !== 'object') return { ok: false, state: 'missing', why: 'There is no licence.' };
  if (!licence.signature) return { ok: false, state: 'unsigned', why: 'That licence carries no signature.' };
  let good = false;
  try {
    good = crypto.verify(null, Buffer.from(body(licence)),
      crypto.createPublicKey(publicKeyPem), Buffer.from(licence.signature, 'base64'));
  } catch (e) { return { ok: false, state: 'unreadable', why: `That licence could not be read: ${e.message}` }; }
  if (!good) {
    return { ok: false, state: 'altered',
      why: 'The signature does not match what the licence says, so one of them has been edited since it was issued.' };
  }
  const today = (now || new Date()).toISOString().slice(0, 10);
  if (licence.expires && licence.expires < today) {
    return { ok: false, state: 'expired', why: `That licence ran out on ${licence.expires}.`, licence };
  }
  return { ok: true, state: 'good', licence, plan: PLANS[licence.plan] || PLANS.trial };
}

const planOf = (result) => (result && result.ok && PLANS[result.licence.plan]) || PLANS.trial;

// ----------------------------------------------------------------- limits
// The same three-part finding the rest of the engine uses, because a limit a
// person hits is a thing that needs explaining, not a status code.
function check(result, project, want) {
  const plan = planOf(result);
  const found = [];
  const w = want || {};
  const rules = (project && project.rules) || {};

  if (result && !result.ok && result.state !== 'missing') {
    found.push({ level: 'blocker', what: result.why,
      why: 'Everything below is measured against the Trial limits until there is a licence the engine can read.',
      how: 'Run "handover licence <file.json>" to see what the engine makes of it, or work to the Trial limits.' });
  }

  const ways = (rules.colourways || []).length;
  if (ways > plan.colourways) {
    found.push({ level: 'blocker',
      what: `This project has ${ways} colourways, and ${plan.name} covers ${plan.colourways}.`,
      why: `${plan.name} is ${plan.why}.`,
      how: `Cut it to ${plan.colourways}, or move to a plan that carries more.` });
  }
  const locks = (rules.lockups || []).length;
  if (locks > plan.lockups) {
    found.push({ level: 'blocker',
      what: `This project has ${locks} lockups, and ${plan.name} covers ${plan.lockups}.`,
      why: `${plan.name} is ${plan.why}.`,
      how: `Cut it to ${plan.lockups}, or move to a plan that carries more.` });
  }
  for (const f of ['print', 'mockups', 'publish']) {
    if (w[f] && !plan[f]) {
      found.push({ level: 'blocker',
        what: `${plan.name} does not include ${FEATURES[f]}.`,
        why: `${plan.name} is ${plan.why}.`,
        how: 'Move to Solo or Studio, or leave that step out.' });
    }
  }
  return found;
}

// What goes in the corner of a Trial package. Not a spoiler across the
// artwork: the assets are real files a designer may need to show somebody, and
// a ruined asset is a reason to work around the tool rather than pay for it.
const marks = (result) => planOf(result).mark;

// -------------------------------------------------------------- what to bill
// Counted off the build that just happened rather than estimated, so an invoice
// and the package agree about what was made.
function usage(result, project, built) {
  const rules = (project && project.rules) || {};
  return {
    // pinned when a repeatable build is asked for, so two packages can be diffed
    at: (typeof process !== 'undefined' && process.env && process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date()).toISOString(),
    holder: (result && result.ok && result.licence.holder) || null,
    // "not enforced" rather than "trial": with no vendor key there is no plan
    // in force at all, and an invoice built on a guess is worse than none
    plan: result ? (result.ok ? result.licence.plan : `licence ${result.state}`) : 'not enforced',
    brand: project && project.brand,
    files: (built && built.written && built.written.length) || 0,
    bytes: (built && built.written || []).reduce((n, f) => n + (f.bytes || 0), 0),
    colourways: (rules.colourways || []).length,
    lockups: (rules.lockups || []).length,
  };
}

// ------------------------------------------------------- what the client gets
// The whole argument against the tools this replaces is that the client
// inherits the designer's subscription. So the package says, in the package,
// that they do not.
function clientLicence(project, result) {
  const holder = (result && result.ok && result.licence.holder) || 'the designer';
  const year = new Date().getFullYear();
  return `${project.brand} — brand package
${'='.repeat(String(project.brand).length + 16)}

Prepared by ${holder}, ${year}.

WHAT YOU HAVE
  Every file in this package is yours. The artwork, the documents, the machine
  readable brand file, all of it. Copy it, put it on a server, hand it to a
  printer, give it to the next agency. Nothing here calls home and nothing
  stops working.

WHAT YOU DO NOT NEED
  An account. A subscription. This tool. The package was generated by software
  ${holder} pays for, and that arrangement is between ${holder} and the people
  who make it. It is not inherited by you, and it does not expire.

WHAT IS NOT OURS TO GIVE
  Typefaces are licensed separately by whoever made them, and this package does
  not grant you any right to them. The same goes for any Pantone reference
  quoted in the documents, and for any photograph supplied by somebody else.
  Those are named in the documents so you can license them yourself.

WHERE IT CAME FROM
  Every measurement in these files was read off the master artwork rather than
  typed in, so they agree with each other by construction. brand.json holds the
  same numbers in machine readable form.
`;
}

// A keypair for whoever is issuing licences. Kept here so the one command that
// needs it is not a shell incantation in a wiki somewhere.
function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// A short, readable fingerprint, for saying which licence a package was built
// under without printing the whole thing.
const fingerprint = (licence) => (licence && licence.signature)
  ? crypto.createHash('sha256').update(licence.signature).digest('hex').slice(0, 12)
  : null;

// ------------------------------------------------------------------ config
// The engine ships with no vendor key, and with no vendor key there are no
// limits. That is deliberate rather than a gap: this is being built for one
// studio's own work first, and a tool that refuses to run your own job on your
// own machine because nobody has decided to sell it yet is a tool you route
// around. Set a key and the limits become real, everywhere at once.
function config(env, fs, path) {
  const e = env || {};
  let publicKey = null;
  if (e.HANDOVER_LICENCE_KEY) {
    publicKey = /BEGIN /.test(e.HANDOVER_LICENCE_KEY)
      ? e.HANDOVER_LICENCE_KEY
      : fs.readFileSync(e.HANDOVER_LICENCE_KEY, 'utf8');
  }
  return { publicKey, enforcing: !!publicKey };
}

// Where a licence comes from, in the order a person would expect: the one you
// named, then the one the environment points at, then the one sitting beside
// the project.
function load(fs, path, opts) {
  const o = opts || {};
  const tries = [o.file, o.env, o.dir && path.join(o.dir, 'licence.json')].filter(Boolean);
  for (const p of tries) {
    try { return { licence: JSON.parse(fs.readFileSync(p, 'utf8')), from: p }; }
    catch (e) { if (p === o.file) throw new Error(`could not read the licence at ${p}: ${e.message}`); }
  }
  return { licence: null, from: null };
}

module.exports = { PLANS, FEATURES, sign, verify, check, planOf, marks, usage,
  clientLicence, keypair, fingerprint, body, config, load };
