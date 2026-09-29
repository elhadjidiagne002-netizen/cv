// Contrôleur de conformité aux normes du recrutement.
// checkCV(cv, template, { pages }) → { score /100, issues: [{ id, severity, message, advice, target, fix }] }
// target : chemin du champ à corriger (« experiences.0.start ») — l'éditeur y amène l'utilisateur.
// fix : action corrective automatique proposée (« sort:experiences », « anonymous », « hide:photo »…).

import { MONTH_RE, EMAIL_RE, CEFR_LEVELS, LIST_SECTIONS, recencyKey, sortAntichronological } from './model.js';
import { getTemplate } from './templates/index.js';
import {
  parseSenegalPhone, formatSenegalPhone, findCFAAmounts, convertCFA, foreignDiplomas, hasEquivalentNote, DOSSIER_ITEMS,
} from './senegal.js';

/**
 * Profils de règles par pays visé (meta.country). '' = règles générales (francophones).
 * photo / personal : 'forbidden' (à proscrire), 'discouraged' (déconseillé, facultatif),
 * 'accepted' (usage courant, toujours facultatif). onePageUnder : années d'expérience en dessous
 * desquelles 1 page est attendue (0 = pas d'exigence).
 */
export const COUNTRY_PROFILES = {
  FR: { name: 'France', inName: 'en France', paper: 'A4', photo: 'discouraged', personal: 'discouraged', maxPages: 2, onePageUnder: 10, phone: '+33', lang: 'fr', currency: 'EUR', templates: ['sobre', 'chronologique', 'classique', 'moderne-ats'] },
  SN: { name: 'Sénégal', inName: 'au Sénégal', paper: 'A4', photo: 'accepted', personal: 'accepted', maxPages: 2, onePageUnder: 5, phone: '+221', lang: 'fr', local: true, templates: ['sobre', 'teranga', 'registre', 'classique'] },
  SNFP: { name: 'Sénégal (fonction publique, concours)', inName: 'dans la fonction publique sénégalaise', paper: 'A4', photo: 'accepted', personal: 'accepted', maxPages: 2, onePageUnder: 0, phone: '+221', lang: 'fr', local: true, dossier: true, templates: ['classique', 'registre', 'sobre', 'teranga'] },
  CI: { name: 'Côte d\'Ivoire', inName: 'en Côte d\'Ivoire', paper: 'A4', photo: 'accepted', personal: 'accepted', maxPages: 2, onePageUnder: 5, phone: '+225', lang: 'fr', cfa: true, templates: ['sobre', 'teranga', 'classique'] },
  MA: { name: 'Maroc', inName: 'au Maroc', paper: 'A4', photo: 'accepted', personal: 'accepted', maxPages: 2, onePageUnder: 5, phone: '+212', lang: 'fr', currency: 'EUR', templates: ['sobre', 'classique', 'moderne-ats'] },
  BE: { name: 'Belgique', inName: 'en Belgique', paper: 'A4', photo: 'discouraged', personal: 'discouraged', maxPages: 2, onePageUnder: 10, phone: '+32', lang: '', currency: 'EUR', templates: ['sobre', 'europass', 'chronologique'] },
  CH: { name: 'Suisse', inName: 'en Suisse', paper: 'A4', photo: 'accepted', personal: 'accepted', maxPages: 2, onePageUnder: 0, phone: '+41', lang: '', currency: 'EUR', templates: ['sobre', 'chronologique', 'europass'] },
  CA: { name: 'Canada / Québec', inName: 'au Canada / Québec', paper: 'Letter', photo: 'forbidden', personal: 'forbidden', maxPages: 2, onePageUnder: 0, phone: '+1', lang: '', currency: 'USD', templates: ['quebec', 'canada-en'] },
  UK: { name: 'Royaume-Uni', inName: 'au Royaume-Uni', paper: 'A4', photo: 'forbidden', personal: 'forbidden', maxPages: 2, onePageUnder: 0, phone: '+44', lang: 'en', currency: 'EUR', templates: ['uk-cv'] },
  US: { name: 'États-Unis', inName: 'aux États-Unis', paper: 'Letter', photo: 'forbidden', personal: 'forbidden', maxPages: 2, onePageUnder: 10, phone: '+1', lang: 'en', currency: 'USD', templates: ['us-resume'] },
  DE: { name: 'Allemagne', inName: 'en Allemagne', paper: 'A4', photo: 'accepted', personal: 'accepted', maxPages: 2, onePageUnder: 0, phone: '+49', lang: '', currency: 'EUR', templates: ['lebenslauf', 'lebenslauf-moderne', 'europass'] },
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Informations à ne jamais mettre sur un CV : appartenance religieuse ou confrérique, ethnie, caste
 * (critères de discrimination interdits) et numéros de pièce d'identité (risque d'usurpation).
 */
const DISCRIMINATORY_RE = /(^|[^a-zàâçéèêëîïôûùüÿœ])(religion|religieu(x|se)|musulman(e)?|chr[ée]tien(ne)?|catholique|protestant(e)?|mouride|tidian[ei]|tidjan[ei]|layène|khadre|qadiri|confr[ée]rie|dahira|ethnie|ethnique|caste)(?=$|[^a-zàâçéèêëîïôûùüÿœ])/i;
const ID_NUMBER_RE = /(\bCNI\b|carte (nationale )?d'identit[ée]|passeport|\bNIN\b|num[ée]ro d'identification|s[ée]curit[ée] sociale|\bIPRES\b|\bCSS\b)[^\n]{0,20}\d{5,}/i;
const PHYSICAL_RE = /(^|[^a-zà-ÿ])(taille|poids|height|weight)\s*:?\s*\d/i;

/** Mots creux (« buzzwords ») : affirmations sans preuve que les recruteurs ignorent. */
const BUZZ_FR = ['dynamique', 'motivé', 'motivée', 'rigoureux', 'rigoureuse', 'passionné', 'passionnée', 'polyvalent', 'polyvalente', 'sérieux', 'sérieuse',
  'force de proposition', 'esprit d\'équipe', 'bon relationnel', 'orienté résultats', 'orientée résultats', 'proactif', 'proactive', 'perfectionniste',
  'autonome', 'curieux', 'curieuse', 'travailleur', 'travailleuse', 'bonne capacité d\'adaptation', 'sens du relationnel'];
const BUZZ_EN = ['hardworking', 'hard-working', 'team player', 'motivated', 'passionate', 'dynamic', 'detail-oriented', 'go-getter', 'results-driven',
  'self-starter', 'synergy', 'think outside the box', 'proactive', 'perfectionist', 'best of breed', 'go-to person'];

/** Diplômes de fin d'études secondaires : leur année permet de déduire l'âge. */
const SECONDARY_RE = /(baccalaur|\bbac\b|\bbfem\b|\bcepe\b|brevet des coll|high school|\ba-?levels?\b|\bgcse\b|\babitur\b|dipl[oô]me d'[ée]tudes secondaires|\bdes\b.*secondaire)/i;

/** Nombre de mois entre deux dates AAAA-MM (b - a). */
export function monthsBetween(a, b) {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

function ymLabel(ym) {
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
}

/** Intervalles [début, fin] (AAAA-MM) des éléments datés ; « en cours » = mois courant. */
function intervals(list, now) {
  return list
    .filter((it) => MONTH_RE.test(it.start))
    .map((it) => ({ it, start: it.start, end: it.current ? now : MONTH_RE.test(it.end) ? it.end : null }))
    .filter((x) => x.end && x.end >= x.start);
}

/**
 * Trous de plus de `minMonths` mois dans le parcours (expériences, formations et bénévolat
 * comblent la chronologie), à partir de la première expérience.
 */
export function findGaps(cv, now, minMonths = 6) {
  const exp = intervals(cv.experiences, now);
  if (!exp.length) return [];
  const firstJob = exp.reduce((m, x) => (x.start < m ? x.start : m), exp[0].start);
  const all = [...exp, ...intervals(cv.education, now), ...intervals(cv.volunteering, now)]
    .filter((x) => x.end >= firstJob)
    .sort((a, b) => a.start.localeCompare(b.start));
  const gaps = [];
  let coveredUntil = null;
  for (const x of all) {
    if (coveredUntil && monthsBetween(coveredUntil, x.start) - 1 > minMonths) {
      gaps.push({ from: coveredUntil, to: x.start, months: monthsBetween(coveredUntil, x.start) - 1, next: x.it });
    }
    if (!coveredUntil || x.end > coveredUntil) coveredUntil = x.end;
  }
  return gaps;
}

/** Chevauchements d'au moins `minMonths` mois entre deux expériences professionnelles. */
export function findOverlaps(cv, now, minMonths = 2) {
  const exp = intervals(cv.experiences, now).map((x) => ({ ...x, index: cv.experiences.indexOf(x.it) }));
  const out = [];
  for (let i = 0; i < exp.length; i += 1) {
    for (let j = i + 1; j < exp.length; j += 1) {
      const a = exp[i];
      const b = exp[j];
      const start = a.start > b.start ? a.start : b.start;
      const end = a.end < b.end ? a.end : b.end;
      const months = monthsBetween(start, end) + 1;
      if (end >= start && months >= minMonths) out.push({ a: a.index, b: b.index, months });
    }
  }
  return out;
}

/** Normalise un numéro : chiffres et « + » initial. */
export function phoneDigits(phone) {
  return String(phone || '').replace(/(?!^\+)[^\d]/g, '');
}

const firstWord = (line) => (line.toLowerCase().normalize('NFC').replace(/^[«"'(\s]+/, '').match(/^[a-zàâçéèêëîïôûùüÿœ'-]+/) || [''])[0];

/** Temps du premier verbe d'une ligne : 'inf' | 'part' (FR) ; 'past' | 'base' (EN) ; '' sinon. */
export function verbTense(line, lang) {
  const w = firstWord(line);
  if (!w || w.length < 3) return '';
  if (lang === 'en') {
    if (/ed$/.test(w) || /^(led|built|ran|won|grew|wrote|sold|taught|drove|oversaw|made|began|brought|cut|set|spoke|gave|took|met|held|kept)$/.test(w)) return 'past';
    if (/ing$/.test(w)) return 'ing';
    return startsWithActionVerb(line, 'en') ? 'base' : '';
  }
  if (/(é|ée|és|ées)$/.test(w)) return 'part';
  if (/(er|ir|re|oir)$/.test(w)) return 'inf';
  return '';
}

export const SEVERITY_WEIGHT = { error: 12, warning: 6, info: 2 };

/** Verbes d'action (infinitif / passé composé / participe) — FR. */
const FR_VERBS = [
  'accompagn', 'accueill', 'administr', 'analys', 'anim', 'apport', 'assur', 'audit', 'automatis', 'bâti', 'budg', 'câbl', 'calcul',
  'catalogu', 'certifi', 'chiffr', 'coach', 'collabor', 'collect', 'command', 'communiqu', 'compt', 'concev', 'conçu', 'concevoir', 'conduire',
  'conduit', 'conseill', 'consolid', 'construi', 'contrôl', 'contribu', 'convainc', 'coordonn', 'cré', 'décroch', 'défin', 'déploy', 'dessin',
  'dével', 'diagnostiqu', 'dirig', 'diffus', 'digitalis', 'document', 'élabor', 'élarg', 'encadr', 'enseign', 'entreten', 'établi', 'étudi',
  'évalu', 'exécut', 'fédér', 'fidélis', 'form', 'gagn', 'gér', 'gérer', 'identifi', 'implant', 'implément', 'install', 'initi', 'innov', 'intégr',
  'lanc', 'livr', 'maintenir', 'maintenu', 'maîtris', 'manag', 'mené', 'mener', 'mettre', 'mis', 'modernis', 'monté', 'monter', 'motiv', 'négoci',
  'optimis', 'organis', 'orient', 'ouvr', 'pilot', 'planifi', 'port', 'prépar', 'présent', 'prospect', 'produi', 'program', 'promouv', 'propos',
  'publi', 'rationalis', 'réalis', 'recrut', 'rédig', 'redress', 'rédui', 'refond', 'rénov', 'renforc', 'répar', 'représent', 'résoudre', 'résolu',
  'restructur', 'réussi', 'sécuris', 'sélection', 'sensibilis', 'servi', 'simplifi', 'soign', 'soutenu', 'soutenir', 'standardis', 'structur',
  'suivi', 'suivre', 'superv', 'tester', 'testé', 'traduire', 'traduit', 'trait', 'transform', 'valid', 'valoris', 'vend', 'vérifi', 'augment',
  'diminu', 'accroî', 'accru', 'atteindre', 'atteint', 'dépass', 'obten', 'remport', 'rédui', 'économis', 'conçu', 'assist', 'particip', 'aid',
  'répond', 'accueil', 'factur', 'install', 'entretenir', 'entretenu', 'nettoy', 'cuisin', 'soigner', 'conduit', 'transport', 'stock', 'inventori',
];

/** Verbes d'action — EN (base / prétérit). */
const EN_VERBS = [
  'achiev', 'administer', 'advis', 'analy', 'architect', 'assess', 'assist', 'automat', 'boost', 'budget', 'built', 'build', 'coach', 'collaborat',
  'conduct', 'consolidat', 'coordinat', 'creat', 'cut', 'deliver', 'design', 'develop', 'direct', 'drove', 'drive', 'enabl', 'engineer', 'establish',
  'evaluat', 'execut', 'expand', 'facilitat', 'forecast', 'generat', 'grew', 'grow', 'guid', 'handl', 'head', 'identif', 'implement', 'improv',
  'increas', 'initiat', 'innovat', 'install', 'integrat', 'introduc', 'launch', 'lead', 'led', 'maintain', 'manag', 'mentor', 'modern', 'monitor',
  'negotiat', 'optimi', 'orchestrat', 'organi', 'overs', 'oversaw', 'plan', 'prepar', 'present', 'produc', 'program', 'promot', 'propos', 'publish',
  'recruit', 'reduc', 'redesign', 'resolv', 'restructur', 'review', 'revamp', 'saved', 'schedul', 'secur', 'sell', 'sold', 'simplif', 'solv',
  'spearhead', 'streamlin', 'strengthen', 'supervis', 'support', 'taught', 'teach', 'test', 'track', 'train', 'transform', 'translat', 'upgrad',
  'won', 'win', 'wrote', 'write', 'research', 'serv', 'ran', 'run', 'tripl', 'doubl', 'decreas', 'exceed', 'earn', 'ensur', 'writ',
];

/** Formulations faibles à remplacer par un verbe d'action et un résultat. */
const WEAK_FR = /^(j'ai|je suis|j'étais|responsable de|en charge de|chargée? de|participation à|aide à|travail sur|tâches?\s*:)/i;
const WEAK_EN = /^(i was|i am|i have|responsible for|in charge of|duties included|worked on|helped with|tasks?\s*:)/i;

/** Mots jugés peu professionnels dans une adresse e-mail. */
const UNPRO_EMAIL = /(love|lover|sexy|bebe|bébé|baby|cute|chou|doudou|princ|queen|king|boss|lol|swag|thug|gangst|diva|beaute|beauty|miss|star|bogoss|beaugoss|bg\d|kiss|coeur|heart|angel|ange|mimi|puce|fifi|gamer|killer|dark|devil|demon|crazy|fou|folle|sweet|hot|cool|playa|player|thebest|lebest|daddy|mama)/i;

/** Estimation grossière du nombre de pages (repli quand l'aperçu ne peut pas être mesuré). */
export function estimatePages(cv) {
  // Calibré sur le modèle « Sobre » (≈ 58 lignes de 10 pt par page A4 utile).
  let lines = 6; // nom, titre, coordonnées
  const text = (s) => Math.ceil(String(s || '').length / 95);
  lines += text(cv.summary) + (cv.summary ? 2 : 0);
  for (const e of [...cv.experiences, ...cv.education, ...cv.volunteering, ...cv.projects]) {
    lines += 2.5;
    for (const l of String(e.description || '').split('\n')) if (l.trim()) lines += text(l);
  }
  lines += cv.skills.length * 1.5 + cv.languages.length + cv.certifications.length + (cv.interests.length ? 1 : 0) + cv.references.length;
  const sectionsCount = ['experiences', 'education', 'skills', 'languages', 'certifications', 'projects', 'volunteering', 'interests', 'references'].filter(
    (s) => cv[s].length || (s === 'references' && cv.referencesOnRequest),
  ).length;
  lines += sectionsCount * 1.8;
  return Math.max(1, Math.ceil(lines / 58));
}

/** Nombre d'années d'expérience professionnelle (approximation, périodes non fusionnées). */
export function yearsOfExperience(cv, today = new Date()) {
  const nowYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  let months = 0;
  for (const e of cv.experiences) {
    if (!MONTH_RE.test(e.start)) continue;
    const end = e.current || !e.end ? nowYM : e.end;
    if (!MONTH_RE.test(end)) continue;
    const [y1, m1] = e.start.split('-').map(Number);
    const [y2, m2] = end.split('-').map(Number);
    months += Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1);
  }
  return months / 12;
}

function bulletLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim())
    .filter(Boolean);
}

function startsWithActionVerb(line, lang) {
  const word = line.toLowerCase().normalize('NFC').replace(/^[«"'(\s]+/, '');
  const list = lang === 'en' ? EN_VERBS : FR_VERBS;
  return list.some((v) => word.startsWith(v));
}

/** Heuristique simple : le texte est-il plutôt en français ? */
export function looksFrench(text) {
  const words = String(text || '').toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ']+/g) || [];
  if (words.length < 6) return false;
  const fr = new Set(['le', 'la', 'les', 'des', 'du', 'de', 'et', 'une', 'un', 'pour', 'dans', 'avec', 'sur', 'au', 'aux', 'en', 'est', 'à']);
  const en = new Set(['the', 'and', 'of', 'to', 'in', 'for', 'with', 'on', 'a', 'an', 'is', 'as', 'by', 'at']);
  let f = 0;
  let e = 0;
  for (const w of words) {
    if (fr.has(w)) f += 1;
    if (en.has(w)) e += 1;
  }
  return f > e * 1.5 && f >= 3;
}

const todayYM = (today) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

/**
 * Analyse un CV. opts : { pages?: number (mesuré dans l'aperçu), today?: Date }
 */
export function checkCV(cv, templateOrId, opts = {}) {
  // Les éléments masqués (« versions ciblées ») ne figurent pas sur le CV : on analyse le CV visible,
  // puis on ramène les chemins (« experiences.1.start ») aux positions réelles dans l'éditeur.
  const visible = { ...cv };
  const positions = {};
  for (const s of LIST_SECTIONS) {
    const list = Array.isArray(cv[s]) ? cv[s] : [];
    positions[s] = list.map((it, i) => (it.hidden ? -1 : i)).filter((i) => i >= 0);
    visible[s] = list.filter((it) => !it.hidden);
  }
  const result = checkVisible(visible, templateOrId, opts);
  const remap = (str) => (typeof str === 'string'
    ? str.replace(/\b([a-z]+)\.(\d+)(?=\.|$)/g, (m, s, i) => (positions[s] && positions[s][Number(i)] !== undefined ? `${s}.${positions[s][Number(i)]}` : m))
    : str);
  for (const is of result.issues) {
    is.id = remap(is.id);
    is.target = remap(is.target);
    is.fix = remap(is.fix);
  }
  return result;
}

function checkVisible(cv, templateOrId, opts = {}) {
  const template = typeof templateOrId === 'object' && templateOrId ? templateOrId : getTemplate(templateOrId || cv.meta.templateId);
  const today = opts.today || new Date();
  const now = todayYM(today);
  const lang = template.lang || cv.meta.lang;
  const isUS = template.id === 'us-resume';
  const isAnglo = Boolean(template.noPersonal);
  const issues = [];
  const add = (id, severity, message, extra = {}) => issues.push({ id, severity, message, ...extra });
  const idn = cv.identity;
  const anonymous = cv.meta.anonymous;
  const country = COUNTRY_PROFILES[cv.meta.country] || null;
  const paper = template.forceFormat ? template.format : cv.meta.paper || 'A4';

  // ——— Identité et coordonnées ———
  if (!anonymous && !(idn.firstName || idn.lastName)) add('identity.name', 'error', 'Indiquez votre prénom et votre nom.', { target: 'identity.firstName' });
  if (!anonymous && !idn.email) add('identity.email.missing', 'error', 'Ajoutez une adresse e-mail : c\'est le premier moyen de contact du recruteur.', { target: 'identity.email' });
  else if (idn.email && !EMAIL_RE.test(idn.email)) add('identity.email.invalid', 'error', `Adresse e-mail invalide : « ${idn.email} ».`, { target: 'identity.email' });
  else if (idn.email) {
    const local = idn.email.split('@')[0];
    if (UNPRO_EMAIL.test(local) || /\d{4,}/.test(local) || !/[a-z]/i.test(local)) {
      add('identity.email.unprofessional', 'warning', 'Adresse e-mail peu professionnelle : préférez le format prenom.nom@…', {
        target: 'identity.email',
        advice: 'Créez une adresse dédiée à vos candidatures, sans surnom ni suite de chiffres.',
      });
    }
  }
  if (!anonymous && !idn.phone) add('identity.phone', 'warning', 'Ajoutez un numéro de téléphone (avec l\'indicatif, ex. +221).', { target: 'identity.phone' });
  for (const key of ['phone', 'phone2']) {
    const phone = idn[key];
    if (!phone) continue;
    const digits = phoneDigits(phone).replace(/^\+/, '');
    const sn = parseSenegalPhone(phone);
    const target = `identity.${key}`;
    const suffix = key === 'phone2' ? '.2' : '';
    if (/[^\d\s+().\-/]/.test(phone) || digits.length < 8 || digits.length > 15) {
      add(`identity.phone.invalid${suffix}`, 'warning', `Numéro de téléphone « ${phone} » incomplet ou illisible (8 à 15 chiffres attendus).`, { target });
    } else if (sn && sn.invalid) {
      add(`identity.phone.sn${suffix}`, 'warning', `Numéro sénégalais « ${phone} » incorrect : 9 chiffres après +221, commençant par 70, 75, 76, 77, 78 (mobile) ou 33 (fixe).`, { target });
    } else if (!/^\s*(\+|00)/.test(phone)) {
      const ex = country ? country.phone : '+221 / +33';
      add(`identity.phone.intl${suffix}`, 'info', `Téléphone sans indicatif international : écrivez-le au format ${ex} … pour être joignable depuis l'étranger.`, sn
        ? { target, fix: `phone:${key}`, fixLabel: `Écrire ${formatSenegalPhone(phone)}` }
        : { target });
    } else {
      if (sn && formatSenegalPhone(phone) !== phone.trim()) {
        add(`identity.phone.format${suffix}`, 'info', `Écrivez le numéro au format international, par groupes de chiffres : ${formatSenegalPhone(phone)}.`, {
          target, fix: `phone:${key}`, fixLabel: 'Mettre en forme',
        });
      }
      if (key === 'phone' && country && !phoneDigits(phone).replace(/^00/, '+').startsWith(country.phone) && !anonymous) {
        add('identity.phone.country', 'info', `Numéro étranger pour une candidature ${country.inName} : précisez votre disponibilité ou ajoutez un numéro local (${country.phone}).`, { target });
      }
    }
  }
  if (!anonymous && !idn.city) add('identity.city', 'info', 'Indiquez votre ville : les recruteurs filtrent souvent par localisation.', { target: 'identity.city' });

  // ——— Titre et accroche ———
  if (!cv.targetTitle.trim()) add('targetTitle', 'warning', 'Ajoutez le titre du poste visé en tête du CV.', { target: 'targetTitle' });
  else if (cv.targetTitle.length > 70) add('targetTitle.long', 'info', 'Titre visé trop long : visez un intitulé de poste court.', { target: 'targetTitle' });
  const summary = cv.summary.trim();
  if (!summary) add('summary.missing', 'warning', 'Ajoutez une accroche de 2 à 4 lignes (qui vous êtes, ce que vous apportez, ce que vous visez).', { target: 'summary' });
  else {
    if (summary.length > 500) add('summary.long', 'warning', `Accroche trop longue (${summary.length} caractères) : 500 au maximum, idéalement 250 à 400.`, { target: 'summary' });
    else if (summary.length < 80) add('summary.short', 'info', 'Accroche très courte : développez en 2 à 4 lignes.', { target: 'summary' });
    if (lang === 'fr' && /(^|[\s.])(je|j'|moi)\b/i.test(summary)) add('summary.pronoun', 'info', 'Évitez « je » dans l\'accroche : style nominal attendu (ex. « Comptable, 5 ans d\'expérience… »).', { target: 'summary' });
  }

  // ——— Rubriques vides ———
  if (!cv.experiences.length) add('experiences.empty', 'warning', 'Aucune expérience : ajoutez stages, emplois, missions ou alternance.', { target: 'experiences' });
  if (!cv.education.length) add('education.empty', 'warning', 'Aucune formation renseignée.', { target: 'education' });
  if (!cv.skills.length) add('skills.empty', 'warning', 'Aucune compétence : ajoutez des mots-clés repris de l\'offre d\'emploi (lus par les ATS).', { target: 'skills' });
  if (!cv.languages.length) add('languages.empty', 'info', 'Aucune langue renseignée.', { target: 'languages' });

  // ——— Éléments incomplets et dates ———
  const dated = ['experiences', 'education', 'volunteering'];
  let hasYearOnly = false;
  let hasMonth = false;
  for (const s of dated) {
    cv[s].forEach((it, i) => {
      const p = `${s}.${i}`;
      const title = it.position || it.degree || it.role || `élément ${i + 1}`;
      if (s === 'experiences') {
        if (!it.position) add(`${p}.position`, 'error', `Expérience n° ${i + 1} : intitulé du poste manquant.`, { target: `${p}.position` });
        if (!it.employer) add(`${p}.employer`, 'warning', `« ${title} » : employeur manquant.`, { target: `${p}.employer` });
      }
      if (s === 'education' && !it.degree) add(`${p}.degree`, 'error', `Formation n° ${i + 1} : diplôme manquant.`, { target: `${p}.degree` });
      for (const k of ['start', 'end']) {
        const v = it[k];
        if (!v) continue;
        if (/^\d{4}$/.test(v)) hasYearOnly = true;
        else if (MONTH_RE.test(v)) hasMonth = true;
        else add(`${p}.${k}.format`, 'error', `« ${title} » : date « ${v} » illisible (format attendu mois/année).`, { target: `${p}.${k}` });
      }
      if (s !== 'education' && !it.start) add(`${p}.start`, 'warning', `« ${title} » : date de début manquante.`, { target: `${p}.start` });
      if (it.start && it.start > now) add(`${p}.start.future`, 'warning', `« ${title} » : la date de début est dans le futur.`, { target: `${p}.start` });
      if (it.end && !it.current && it.end > now && s !== 'education') add(`${p}.end.future`, 'warning', `« ${title} » : date de fin dans le futur — cochez « en cours » si c'est votre poste actuel.`, { target: `${p}.end` });
      if (it.start && it.end && it.end < it.start) add(`${p}.end.before`, 'error', `« ${title} » : la date de fin précède la date de début.`, { target: `${p}.end` });
      if (it.current && it.end) add(`${p}.current.end`, 'warning', `« ${title} » : marqué « en cours » mais une date de fin est saisie.`, { target: `${p}.end` });
      if (s === 'experiences' && it.start && !it.end && !it.current) add(`${p}.end.missing`, 'warning', `« ${title} » : date de fin manquante (ou cochez « poste actuel »).`, { target: `${p}.end` });
    });
  }
  if (hasYearOnly && hasMonth) add('dates.mixed', 'warning', 'Dates hétérogènes : utilisez partout le même format (mois/année).', { target: 'experiences' });

  // ——— Ordre antéchronologique ———
  for (const s of ['experiences', 'education', 'volunteering']) {
    const list = cv[s];
    for (let i = 1; i < list.length; i += 1) {
      const a = recencyKey(list[i - 1]);
      const b = recencyKey(list[i]);
      if (a && b && b > a) {
        add(`${s}.order`, 'warning', `${s === 'experiences' ? 'Expériences' : s === 'education' ? 'Formations' : 'Bénévolat'} : l'ordre n'est pas antéchronologique (le plus récent d'abord).`, {
          target: s,
          fix: `sort:${s}`,
          fixLabel: 'Trier automatiquement',
        });
        break;
      }
    }
  }

  // ——— Trous et chevauchements dans le parcours ———
  for (const g of findGaps(cv, now).slice(0, 3)) {
    add(`gap.${g.from}`, 'info', `Période sans activité de ${g.months} mois (${ymLabel(g.from)} – ${ymLabel(g.to)}) : les recruteurs la remarqueront. Ajoutez l'activité correspondante (formation, projet, mobilité, bénévolat) ou préparez une explication.`, {
      target: 'experiences',
    });
  }
  for (const o of findOverlaps(cv, now).slice(0, 3)) {
    const ta = cv.experiences[o.a].position || `Expérience ${o.a + 1}`;
    const tb = cv.experiences[o.b].position || `Expérience ${o.b + 1}`;
    add(`overlap.${o.a}.${o.b}`, 'info', `« ${ta} » et « ${tb} » se chevauchent sur ${o.months} mois : vérifiez les dates, ou précisez « temps partiel » / « en parallèle ».`, {
      target: `experiences.${o.b}.start`,
    });
  }

  // ——— Verbes d'action, résultats chiffrés, formulations faibles ———
  const lines = cv.experiences.flatMap((e) => bulletLines(e.description));
  if (lines.length >= 3) {
    const withVerb = lines.filter((l) => startsWithActionVerb(l, lang)).length;
    if (withVerb / lines.length < 0.5) {
      add('experiences.verbs', 'warning', lang === 'en'
        ? `Only ${withVerb} of ${lines.length} bullet points start with an action verb (led, built, increased…).`
        : `Seules ${withVerb} lignes sur ${lines.length} commencent par un verbe d'action (piloter, développer, augmenter…).`, {
        target: 'experiences',
        advice: 'Une ligne = une réalisation : verbe d\'action + tâche + résultat chiffré.',
      });
    }
    if (!lines.some((l) => /\d/.test(l))) add('experiences.numbers', 'info', 'Aucun résultat chiffré : ajoutez des chiffres (%, volumes, budget, effectifs).', { target: 'experiences' });
    const weak = lines.find((l) => (lang === 'en' ? WEAK_EN : WEAK_FR).test(l));
    if (weak) add('experiences.weak', 'info', `Formulation faible : « ${weak.slice(0, 40)}… » — commencez par un verbe d'action.`, { target: 'experiences' });
  }
  // Verbes répétés en début de ligne
  if (lines.length >= 4) {
    const counts = new Map();
    for (const l of lines) {
      if (!startsWithActionVerb(l, lang)) continue;
      const w = firstWord(l);
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    const repeated = [...counts].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0];
    if (repeated) {
      add('experiences.repeated', 'info', `Le verbe « ${repeated[0]} » ouvre ${repeated[1]} lignes : variez (${lang === 'en' ? 'led, delivered, improved…' : 'piloter, conduire, améliorer…'}).`, { target: 'experiences' });
    }
  }
  // Temps verbaux homogènes au sein d'une même expérience
  const mixed = cv.experiences.findIndex((e) => {
    const tenses = new Set(bulletLines(e.description).map((l) => verbTense(l, lang)).filter(Boolean));
    return lang === 'en' ? tenses.has('past') && tenses.has('base') : tenses.has('inf') && tenses.has('part');
  });
  if (mixed >= 0) {
    add('experiences.tense', 'info', lang === 'en'
      ? `« ${cv.experiences[mixed].position || 'Experience'} » mixes tenses: use the past tense for past roles (present tense only for your current role).`
      : `« ${cv.experiences[mixed].position || 'Expérience'} » mélange infinitifs et participes passés (« Piloter » / « Piloté ») : choisissez une seule forme.`, {
      target: `experiences.${mixed}.description`,
    });
  }

  // ——— Ponctuation, majuscules, espaces ———
  const allLines = [...lines, ...cv.volunteering.flatMap((v) => bulletLines(v.description))];
  if (allLines.length >= 3) {
    const withDot = allLines.filter((l) => /[.;!]$/.test(l)).length;
    if (withDot && withDot < allLines.length) {
      add('style.punctuation', 'info', `Ponctuation hétérogène : ${withDot} ligne(s) sur ${allLines.length} finissent par un point. Choisissez une règle (avec ou sans point final) et appliquez-la partout.`, { target: 'experiences' });
    }
    const lower = allLines.filter((l) => /^[a-zàâçéèêëîïôûùüÿœ]/.test(l)).length;
    if (lower && lower < allLines.length) {
      add('style.capitals', 'info', `Majuscules hétérogènes : ${lower} ligne(s) commencent par une minuscule. Commencez chaque ligne par une majuscule.`, { target: 'experiences' });
    }
  }
  if (textFields(cv).some((v) => / {2,}|\t/.test(v.replace(/^\s+|\s+$/gm, '')))) {
    add('style.spaces', 'info', 'Doubles espaces détectés dans le texte : ils créent des décalages dans le PDF.', { target: 'summary', fix: 'clean:spaces', fixLabel: 'Supprimer les doubles espaces' });
  }

  // ——— Exemples insérés depuis l'aide à la rédaction, pas encore personnalisés ———
  const placeholderRe = /\[[^\]\n]{1,40}\]/;
  if (textFields(cv).some((v) => placeholderRe.test(v))) {
    add('placeholder', 'warning', 'Il reste des passages entre crochets [ … ] (exemples à compléter) : remplacez-les par vos chiffres et informations réels.', {
      target: findField(cv, placeholderRe) || 'experiences',
    });
  }

  // ——— Mots creux ———
  const prose = `${cv.summary}\n${cv.experiences.map((e) => e.description).join('\n')}`.toLowerCase();
  const buzz = (lang === 'en' ? BUZZ_EN : BUZZ_FR).filter((w) => new RegExp(`(^|[^a-zàâçéèêëîïôûùüÿœ])${w.replace(/[-']/g, '[-\' ]')}($|[^a-zàâçéèêëîïôûùüÿœ])`, 'i').test(prose));
  if (buzz.length) {
    add('style.buzzwords', 'info', `Mots creux : « ${buzz.slice(0, 4).join(' », « ')} ». Remplacez-les par un fait qui le prouve (ex. « motivé » → « 3 certifications obtenues en 1 an »).`, { target: 'summary' });
  }

  cv.experiences.forEach((e, i) => {
    if (e.description.length > 900) add(`experiences.${i}.long`, 'info', `« ${e.position || 'Expérience'} » : description très longue, gardez 3 à 6 lignes.`, { target: `experiences.${i}.description` });
  });

  // ——— Langues (CECRL) ———
  cv.languages.forEach((l, i) => {
    if (!l.level) add(`languages.${i}.level`, 'warning', `Langue « ${l.name || i + 1} » sans niveau : indiquez un niveau CECRL (A1 à C2) ou « langue maternelle ».`, { target: `languages.${i}.level` });
    else if (!CEFR_LEVELS.includes(l.level)) add(`languages.${i}.level`, 'warning', `Langue « ${l.name} » : niveau « ${l.level} » hors CECRL.`, { target: `languages.${i}.level` });
  });

  // ——— Champs sensibles et photo ———
  const p = cv.privacy;
  if (!anonymous) {
    const shown = [];
    if (p.showBirthDate && idn.birthDate) shown.push('date de naissance');
    if (p.showBirthPlace && idn.birthPlace) shown.push('lieu de naissance');
    if (p.showMaritalStatus && idn.maritalStatus) shown.push('situation familiale');
    if (p.showNationality && idn.nationality) shown.push('nationalité');
    const personalOk = country && ['accepted', 'forbidden'].includes(country.personal);
    if (shown.length && !isAnglo && !personalOk) {
      add('sensitive.shown', 'info', `Informations facultatives affichées (${shown.join(', ')}) : aucun recruteur ne peut les exiger ; elles peuvent exposer à une discrimination.`, {
        target: 'privacy',
        fix: 'hide:sensitive',
        fixLabel: 'Masquer ces informations',
      });
    }
    if (isAnglo && (shown.length || (p.showPhoto && idn.photo))) {
      add('sensitive.anglo', 'error', 'Format anglo-saxon : photo, âge, nationalité et situation familiale sont à proscrire (ils sont masqués automatiquement dans ce modèle).', {
        target: 'privacy',
        fix: 'hide:sensitive',
        fixLabel: 'Masquer ces informations',
      });
    } else if (p.showPhoto && idn.photo && template.ats) {
      add('photo.ats', 'info', 'Photo sur un modèle ATS : elle n\'est pas lue par les logiciels de tri et peut être retirée.', { target: 'privacy', fix: 'hide:photo', fixLabel: 'Retirer la photo' });
    } else if (p.showPhoto && idn.photo && !template.photo) {
      add('photo.unsupported', 'info', 'Ce modèle n\'affiche pas de photo.', { target: 'privacy' });
    }
  }

  // ——— Âge déductible (année du baccalauréat ou équivalent) ———
  const hidesAge = anonymous || !p.showBirthDate || isAnglo || (country && country.personal === 'forbidden');
  if (hidesAge && cv.education.length >= 2) {
    const i = cv.education.findIndex((e) => SECONDARY_RE.test(`${e.degree} ${e.school}`) && (e.end || e.start));
    if (i >= 0) {
      add('age.deducible', anonymous ? 'warning' : 'info', `L'année de « ${cv.education[i].degree} » permet de déduire votre âge : avec un diplôme supérieur, retirez cette ligne ou sa date.`, {
        target: `education.${i}.end`,
      });
    }
  }

  // ——— Profil du pays visé ———
  if (country) {
    const c = country.name;
    if (paper !== country.paper) {
      add('country.paper', 'warning', `Format de papier ${paper} : le format ${country.paper} est la norme ${country.inName}.`, template.forceFormat
        ? { target: 'template' }
        : { target: 'meta.paper', fix: `paper:${country.paper}`, fixLabel: `Passer en ${country.paper}` });
    }
    if (country.lang && lang !== country.lang) {
      add('country.lang', 'warning', `Candidature ${country.inName} : rédigez le CV en ${country.lang === 'en' ? 'anglais' : 'français'} (langue des rubriques et du contenu).`, { target: 'meta.lang' });
    }
    const photoShown = !anonymous && p.showPhoto && idn.photo && template.photo;
    if (country.photo === 'forbidden' && photoShown && !isAnglo) {
      add('country.photo', 'error', `${c} : pas de photo sur le CV (usage anti-discrimination).`, { target: 'privacy', fix: 'hide:photo', fixLabel: 'Retirer la photo' });
    }
    if (country.photo === 'accepted' && !photoShown && !anonymous && cv.meta.country === 'DE') {
      add('country.photo.de', 'info', 'Allemagne : une photo professionnelle reste d\'usage sur le Lebenslauf, mais elle est facultative (loi AGG).', { target: 'privacy' });
    }
    if (country.personal === 'forbidden' && !isAnglo && !anonymous && (p.showBirthDate || p.showBirthPlace || p.showNationality || p.showMaritalStatus)) {
      add('country.personal', 'error', `${c} : date de naissance, nationalité et situation familiale ne doivent pas figurer sur le CV.`, { target: 'privacy', fix: 'hide:sensitive', fixLabel: 'Masquer ces informations' });
    }
    if (cv.meta.country === 'US' && !template.excludeSections?.includes('interests') && (cv.interests.length || cv.references.length || cv.referencesOnRequest)) {
      add('country.us.sections', 'info', 'États-Unis : les centres d\'intérêt et les références ne figurent pas sur un résumé.', { target: 'interests' });
    }
    if (country.templates && !country.templates.includes(template.id) && ['forbidden'].includes(country.photo)) {
      add('country.template', 'info', `${capitalize(country.inName)}, les modèles conseillés sont : ${country.templates.map((id) => getTemplate(id).name).join(', ')}.`, { target: 'template' });
    }
  }

  // ——— Réalités sénégalaises : montants en FCFA, diplômes, dossier de concours ———
  const abroad = (country && !country.local && !country.cfa) || (!country && lang === 'en');
  if (abroad) {
    const cur = (country && country.currency) || (lang === 'en' ? 'USD' : 'EUR');
    const texts = [cv.summary, ...cv.experiences.map((e) => e.description), ...cv.projects.map((e) => e.description)];
    const found = texts.flatMap(findCFAAmounts).filter((a) => a.amount >= 1000);
    const noted = texts.some((t) => /€|\beuros?\b|\$|\bUSD\b|\bEUR\b/i.test(t));
    if (found.length && !noted) {
      const ex = found[0];
      add('money.cfa', 'info', `Montant en francs CFA (« ${ex.text} ») : un recruteur ${country ? country.inName : 'étranger'} ne le situera pas. Ajoutez l'équivalent : ≈ ${convertCFA(ex.amount, cur)}.`, {
        target: 'experiences',
        advice: `Parité fixe : 1 € = 655,957 FCFA${cur === 'USD' ? ' (dollar : taux indicatif, à vérifier)' : ''}. Exemple : « 45 millions FCFA (≈ 69 000 €) ».`,
      });
    }
  }
  if (abroad || cv.meta.country === 'FR') {
    const i = cv.education.findIndex((e) => foreignDiplomas(e.degree).length && !hasEquivalentNote(e.degree));
    if (i >= 0) {
      const { diploma, equivalent } = foreignDiplomas(cv.education[i].degree, lang)[0];
      add(`education.${i}.equivalent`, 'info', `« ${cv.education[i].degree} » : le sigle ${diploma.label.split(' ')[0]} est peu connu hors du Sénégal. Précisez l'équivalent (${equivalent}).`, {
        target: `education.${i}.degree`,
        fix: `equiv:education.${i}`,
        fixLabel: 'Ajouter l\'équivalence',
      });
    }
  }
  if (country && country.dossier) {
    const done = (cv.meta.dossier || []).filter((id) => DOSSIER_ITEMS.some((d) => d.id === id)).length;
    if (done < DOSSIER_ITEMS.length) {
      add('dossier.incomplete', 'info', `Dossier de concours : ${done} pièce${done > 1 ? 's' : ''} prête${done > 1 ? 's' : ''} sur ${DOSSIER_ITEMS.length}. Cochez-les au fur et à mesure (l'avis de concours fait foi).`, {
        target: 'dossier', penalty: 0,
      });
    }
  }

  // ——— Informations à ne jamais faire figurer ———
  const everything = [...textFields(cv), idn.nationality, idn.maritalStatus, idn.address].join('\n');
  // Religion / ethnie : pas dans les noms d'établissements ou d'employeurs (« Université catholique… »).
  const personalText = [cv.targetTitle, cv.summary, idn.nationality, idn.maritalStatus, idn.address,
    ...cv.interests.map((i) => i.name), ...cv.skills.flatMap((g) => [g.name, ...g.keywords]), ...cv.volunteering.map((v) => `${v.role}\n${v.description}`)].join('\n');
  const disc = personalText.match(DISCRIMINATORY_RE);
  if (disc) {
    add('sensitive.religion', 'warning', `« ${disc[2]} » : religion, confrérie, ethnie ou caste n'ont pas leur place sur un CV (critères de discrimination interdits). Retirez cette mention.`, {
      target: findField(cv, DISCRIMINATORY_RE, ['interests', 'skills', 'volunteering']) || 'interests',
      advice: 'Un engagement associatif peut rester, décrit par ce que vous y faites (ex. « Trésorier d\'une association de quartier, 120 membres »).',
    });
  }
  if (ID_NUMBER_RE.test(everything)) {
    add('sensitive.idnumber', 'warning', 'Numéro de pièce d\'identité ou de sécurité sociale détecté : ne le mettez jamais sur un CV (risque d\'usurpation d\'identité). Il ne se donne qu\'au moment de l\'embauche.', {
      target: findField(cv, ID_NUMBER_RE) || 'identity.address',
    });
  }
  if (PHYSICAL_RE.test(everything)) {
    add('sensitive.physical', 'info', 'Taille et poids n\'ont pas à figurer sur un CV (sauf exigence légale explicite du métier dans l\'annonce).', { target: findField(cv, PHYSICAL_RE) || 'summary' });
  }

  // ——— Langue du contenu ———
  if (lang === 'en' && looksFrench(`${cv.summary} ${cv.experiences.map((e) => e.description).join(' ')}`)) {
    add('lang.mismatch', 'warning', 'Le modèle est en anglais mais le contenu semble rédigé en français : traduisez l\'accroche et les expériences.', { target: 'summary' });
  }

  // ——— Longueur ———
  const pages = opts.pages || estimatePages(cv);
  const years = yearsOfExperience(cv, today);
  const maxPages = country ? country.maxPages : 2;
  const onePageUnder = country ? country.onePageUnder : 10;
  const strictOnePage = isUS || cv.meta.country === 'US';
  if (template.longForm) {
    if (pages > 6) add('length.academic', 'info', `CV académique de ${pages} pages : sélectionnez les publications les plus significatives.`, { target: 'publications' });
  } else if (pages > maxPages) {
    add('length.max', 'error', `Le CV fait ${pages} pages : ${maxPages} pages au maximum. Raccourcissez les descriptions anciennes.`, { target: 'experiences', fix: `fit:${maxPages}`, fixLabel: `Ajuster à ${maxPages} pages` });
  } else if (pages >= 2 && onePageUnder && years < onePageUnder) {
    add('length.junior', strictOnePage ? 'warning' : 'info', `Le CV fait ${pages} pages pour ${Math.round(years)} an(s) d'expérience : visez 1 page en dessous de ${onePageUnder} ans d'expérience.`, {
      target: 'experiences',
      fix: 'fit:1',
      fixLabel: 'Ajuster à 1 page',
    });
  }

  // ——— Divers ———
  if (!template.ats) add('template.ats', 'info', 'Modèle créatif à colonnes : moins bien lu par les logiciels de tri. Pour une candidature en ligne, préférez un modèle « ATS ».', { target: 'template' });
  if (anonymous) add('anonymous.on', 'info', 'Mode CV anonyme activé : nom, photo, coordonnées, adresse et âge sont masqués.', { fix: 'anonymous:off', fixLabel: 'Désactiver', penalty: 0 });
  cv.interests.forEach((it, i) => {
    if (/^(sport|lecture|musique|voyages?|cin[ée]ma|internet|reading|music|travel(l?ing)?|sports?)$/i.test(it.name.trim())) {
      add(`interests.${i}.vague`, 'info', `Centre d'intérêt trop vague : « ${it.name} » — précisez (discipline, niveau, engagement).`, { target: `interests.${i}.name` });
    }
  });

  const penalty = issues.reduce((sum, is) => sum + (is.penalty ?? SEVERITY_WEIGHT[is.severity]), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const order = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, issues, pages, years };
}

/** Chemin du premier champ texte (rubriques, titre, accroche) qui correspond à une expression. */
function findField(cv, re, sections = LIST_SECTIONS) {
  if (re.test(cv.targetTitle)) return 'targetTitle';
  if (re.test(cv.summary)) return 'summary';
  for (const s of sections) {
    for (let i = 0; i < cv[s].length; i += 1) {
      for (const [k, v] of Object.entries(cv[s][i])) if (k !== 'id' && typeof v === 'string' && re.test(v)) return `${s}.${i}.${k}`;
    }
  }
  for (const k of ['address', 'nationality', 'maritalStatus']) if (re.test(cv.identity[k] || '')) return `identity.${k}`;
  return '';
}

/** Tous les champs texte saisis par l'utilisateur (pour les contrôles de typographie). */
function textFields(cv) {
  const out = [cv.targetTitle, cv.summary];
  for (const s of LIST_SECTIONS) {
    for (const it of cv[s]) for (const v of Object.values(it)) if (typeof v === 'string') out.push(v);
  }
  return out;
}

/** Remplace les espaces multiples et tabulations par une espace (préserve les retours à la ligne). */
export function cleanSpaces(text) {
  return String(text).split('\n').map((l) => l.replace(/[ \t]{2,}/g, ' ').replace(/\t/g, ' ').trim()).join('\n');
}

/**
 * Applique une correction automatique proposée par le contrôleur. Modifie le CV et le renvoie.
 * Actions : « sort:<rubrique> », « hide:sensitive », « hide:photo », « anonymous:on|off »,
 * « paper:A4|Letter », « clean:spaces ». (« fit » est géré par l'éditeur : il faut mesurer l'aperçu.)
 */
export function applyFix(cv, fix) {
  const [action, ...rest] = String(fix || '').split(':');
  const arg = rest.join(':');
  if (action === 'sort' && Array.isArray(cv[arg])) cv[arg] = sortAntichronological(cv[arg]);
  else if (action === 'hide' && arg === 'photo') cv.privacy.showPhoto = false;
  else if (action === 'hide' && arg === 'sensitive') {
    Object.assign(cv.privacy, { showPhoto: false, showBirthDate: false, showBirthPlace: false, showNationality: false, showMaritalStatus: false });
  } else if (action === 'anonymous') cv.meta.anonymous = arg !== 'off';
  else if (action === 'paper' && ['A4', 'Letter'].includes(arg)) cv.meta.paper = arg;
  else if (action === 'phone' && ['phone', 'phone2'].includes(arg)) cv.identity[arg] = formatSenegalPhone(cv.identity[arg]);
  else if (action === 'equiv') {
    const m = String(arg).match(/^education\.(\d+)$/);
    const item = m && cv.education[Number(m[1])];
    const lang = cv.meta.lang === 'en' ? 'en' : 'fr';
    const found = item && foreignDiplomas(item.degree, lang)[0];
    if (found && !hasEquivalentNote(item.degree)) item.degree = `${item.degree} (${found.equivalent})`;
  }
  else if (action === 'clean' && arg === 'spaces') {
    cv.targetTitle = cleanSpaces(cv.targetTitle);
    cv.summary = cleanSpaces(cv.summary);
    for (const s of LIST_SECTIONS) {
      for (const it of cv[s]) for (const [k, v] of Object.entries(it)) if (typeof v === 'string' && k !== 'id') it[k] = cleanSpaces(v);
    }
  }
  return cv;
}
