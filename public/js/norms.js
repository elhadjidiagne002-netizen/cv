// Contrôleur de conformité aux normes du recrutement.
// checkCV(cv, template, { pages }) → { score /100, issues: [{ id, severity, message, advice, target, fix }] }
// target : chemin du champ à corriger (« experiences.0.start ») — l'éditeur y amène l'utilisateur.
// fix : action corrective automatique proposée (« sort:experiences », « anonymous », « hide:photo »…).

import { MONTH_RE, EMAIL_RE, CEFR_LEVELS, recencyKey, sortAntichronological } from './model.js';
import { getTemplate } from './templates/index.js';

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
    if (p.showMaritalStatus && idn.maritalStatus) shown.push('situation familiale');
    if (p.showNationality && idn.nationality) shown.push('nationalité');
    if (shown.length && !isAnglo) {
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

  // ——— Langue du contenu ———
  if (lang === 'en' && looksFrench(`${cv.summary} ${cv.experiences.map((e) => e.description).join(' ')}`)) {
    add('lang.mismatch', 'warning', 'Le modèle est en anglais mais le contenu semble rédigé en français : traduisez l\'accroche et les expériences.', { target: 'summary' });
  }

  // ——— Longueur ———
  const pages = opts.pages || estimatePages(cv);
  const years = yearsOfExperience(cv, today);
  if (pages > 2) add('length.max', 'error', `Le CV fait ${pages} pages : 2 pages au maximum. Raccourcissez les descriptions anciennes.`, { target: 'experiences' });
  else if (pages === 2 && (isUS ? years < 10 : years < 10)) {
    add('length.junior', isUS ? 'warning' : 'info', `Le CV fait 2 pages pour ${Math.round(years)} an(s) d'expérience : visez 1 page en dessous de 10 ans d'expérience.`, { target: 'experiences' });
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

/**
 * Applique une correction automatique proposée par le contrôleur. Modifie le CV et le renvoie.
 * Actions : « sort:<rubrique> », « hide:sensitive », « hide:photo », « anonymous:on|off ».
 */
export function applyFix(cv, fix) {
  const [action, arg] = String(fix || '').split(':');
  if (action === 'sort' && Array.isArray(cv[arg])) cv[arg] = sortAntichronological(cv[arg]);
  else if (action === 'hide' && arg === 'photo') cv.privacy.showPhoto = false;
  else if (action === 'hide' && arg === 'sensitive') {
    Object.assign(cv.privacy, { showPhoto: false, showBirthDate: false, showNationality: false, showMaritalStatus: false });
  } else if (action === 'anonymous') cv.meta.anonymous = arg !== 'off';
  return cv;
}
