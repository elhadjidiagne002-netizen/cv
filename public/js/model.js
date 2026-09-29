// Schéma des données d'un CV, création, normalisation, validation et données d'exemple.
// Module ES pur (aucune dépendance au DOM) : utilisable dans le navigateur et sous Node (tests).

export const SCHEMA_VERSION = 1;

/** Niveaux de langue du Cadre européen commun de référence (CECRL) + langue maternelle. */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'];

/** Rubriques « listes » du CV, dans l'ordre par défaut (ordre modifiable par l'utilisateur). */
export const LIST_SECTIONS = [
  'experiences',
  'education',
  'skills',
  'languages',
  'certifications',
  'awards',
  'publications',
  'projects',
  'volunteering',
  'interests',
  'references',
];

/**
 * Pays visés (profils de règles de conformité) : '' = générique.
 * SNFP = Sénégal, fonction publique et concours (dossier administratif).
 */
export const COUNTRIES = ['FR', 'SN', 'SNFP', 'CI', 'MA', 'BE', 'CH', 'CA', 'UK', 'US', 'DE'];

/** Usage d'une langue : '' (écrit et oral) ou 'oral' (langue parlée, peu ou pas écrite — fréquent pour les langues nationales). */
export const LANGUAGE_MODES = ['', 'oral'];

/** Niveau maximal de l'ajustement « tenir sur 1 page » (0 = taille normale). */
export const MAX_FIT = 4;

/** Champs d'identité sensibles : facultatifs, masqués par défaut (non-discrimination). */
export const SENSITIVE_FIELDS = ['photo', 'birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'drivingLicence'];

/**
 * Description des champs de chaque rubrique (sert à l'éditeur et à la normalisation).
 * type : text | textarea | month | checkbox | select | email | tel | url | list
 */
export const ITEM_FIELDS = {
  experiences: [
    { key: 'position', label: 'Intitulé du poste', type: 'text', required: true },
    { key: 'employer', label: 'Employeur', type: 'text', required: true },
    { key: 'city', label: 'Ville', type: 'text' },
    { key: 'start', label: 'Début', type: 'month', required: true },
    { key: 'end', label: 'Fin', type: 'month' },
    { key: 'current', label: 'Poste actuel', type: 'checkbox' },
    {
      key: 'description',
      label: 'Missions et réalisations (une par ligne, commencez par un verbe d\'action)',
      type: 'textarea',
    },
  ],
  education: [
    { key: 'degree', label: 'Diplôme / intitulé', type: 'text', required: true },
    { key: 'school', label: 'Établissement', type: 'text', required: true },
    { key: 'city', label: 'Ville', type: 'text' },
    { key: 'start', label: 'Début', type: 'month' },
    { key: 'end', label: 'Fin (ou date d\'obtention)', type: 'month' },
    { key: 'current', label: 'En cours', type: 'checkbox' },
    { key: 'description', label: 'Détails (mention, spécialité, mémoire…)', type: 'textarea' },
  ],
  skills: [
    { key: 'name', label: 'Catégorie (ex. : Techniques, Outils, Savoir-être)', type: 'text', required: true },
    { key: 'keywords', label: 'Compétences (séparées par des virgules)', type: 'list' },
  ],
  languages: [
    { key: 'name', label: 'Langue', type: 'text', required: true },
    { key: 'level', label: 'Niveau CECRL', type: 'select', options: ['', ...CEFR_LEVELS] },
    {
      key: 'mode',
      label: 'Usage',
      type: 'select',
      options: LANGUAGE_MODES,
      optionLabels: { '': 'Écrit et oral', oral: 'À l\'oral uniquement' },
    },
    { key: 'certificate', label: 'Certificat (ex. : DELF B2, TOEIC 850)', type: 'text' },
  ],
  certifications: [
    { key: 'name', label: 'Certification', type: 'text', required: true },
    { key: 'issuer', label: 'Organisme', type: 'text' },
    { key: 'date', label: 'Date', type: 'month' },
  ],
  awards: [
    { key: 'name', label: 'Distinction (prix, bourse, concours, mention)', type: 'text', required: true },
    { key: 'issuer', label: 'Décernée par', type: 'text' },
    { key: 'date', label: 'Date', type: 'month' },
    { key: 'description', label: 'Précision (facultatif)', type: 'textarea' },
  ],
  publications: [
    { key: 'title', label: 'Titre de la publication', type: 'text', required: true },
    { key: 'authors', label: 'Auteurs (ex. : Ndiaye A., Sow M.)', type: 'text' },
    { key: 'venue', label: 'Revue, conférence ou éditeur', type: 'text' },
    { key: 'date', label: 'Date de publication', type: 'month' },
    { key: 'url', label: 'Lien (DOI, HAL…)', type: 'url' },
  ],
  projects: [
    { key: 'name', label: 'Projet', type: 'text', required: true },
    { key: 'role', label: 'Rôle', type: 'text' },
    { key: 'date', label: 'Date', type: 'month' },
    { key: 'url', label: 'Lien', type: 'url' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  volunteering: [
    { key: 'role', label: 'Rôle', type: 'text', required: true },
    { key: 'organization', label: 'Organisation', type: 'text', required: true },
    { key: 'start', label: 'Début', type: 'month' },
    { key: 'end', label: 'Fin', type: 'month' },
    { key: 'current', label: 'En cours', type: 'checkbox' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  interests: [{ key: 'name', label: 'Centre d\'intérêt (précis : « Basket en club », pas « Sport »)', type: 'text', required: true }],
  references: [
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'position', label: 'Fonction', type: 'text' },
    { key: 'company', label: 'Entreprise', type: 'text' },
    { key: 'contact', label: 'Contact (e-mail ou téléphone)', type: 'text' },
  ],
};

export const IDENTITY_FIELDS = [
  { key: 'firstName', label: 'Prénom', type: 'text', autocomplete: 'given-name' },
  { key: 'lastName', label: 'Nom', type: 'text', autocomplete: 'family-name' },
  { key: 'email', label: 'E-mail', type: 'email', autocomplete: 'email' },
  { key: 'phone', label: 'Téléphone (avec l\'indicatif, ex. +221 77 123 45 67)', type: 'tel', autocomplete: 'tel' },
  { key: 'phone2', label: 'Second téléphone (facultatif)', type: 'tel' },
  { key: 'whatsapp', label: 'Premier numéro joignable sur WhatsApp', type: 'checkbox' },
  { key: 'city', label: 'Ville', type: 'text', autocomplete: 'address-level2' },
  { key: 'country', label: 'Pays', type: 'text', autocomplete: 'country-name' },
  { key: 'address', label: 'Adresse (facultatif — la ville suffit)', type: 'text', autocomplete: 'street-address' },
  { key: 'linkedin', label: 'LinkedIn (URL)', type: 'url' },
  { key: 'website', label: 'Site / portfolio (URL)', type: 'url' },
];

export const SENSITIVE_IDENTITY_FIELDS = [
  { key: 'birthDate', label: 'Date de naissance', type: 'date' },
  { key: 'birthPlace', label: 'Lieu de naissance', type: 'text' },
  { key: 'nationality', label: 'Nationalité', type: 'text' },
  { key: 'maritalStatus', label: 'Situation familiale', type: 'text' },
  { key: 'drivingLicence', label: 'Permis de conduire (ex. : Permis B)', type: 'text' },
];

let idCounter = 0;
/** Identifiant court, unique dans la session. */
export function uid(prefix = 'id') {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${rand}`;
}

function emptyItem(section) {
  const item = { id: uid(section.slice(0, 3)), hidden: false };
  for (const f of ITEM_FIELDS[section]) {
    item[f.key] = f.type === 'checkbox' ? false : f.type === 'list' ? [] : '';
  }
  return item;
}

/** Crée un élément vide pour une rubrique donnée. */
export function createItem(section, values = {}) {
  if (!ITEM_FIELDS[section]) throw new Error(`Rubrique inconnue : ${section}`);
  return normalizeItem(section, { ...emptyItem(section), ...values });
}

/** CV vide, valide, prêt à remplir. */
export function createEmptyCV(overrides = {}) {
  const now = new Date().toISOString();
  const cv = {
    schemaVersion: SCHEMA_VERSION,
    id: uid('cv'),
    meta: {
      title: 'Mon CV',
      templateId: 'sobre',
      lang: 'fr',
      paper: 'A4',
      dateStyle: 'numeric',
      anonymous: false,
      accent: '',
      palette: '',
      country: '',
      fit: 0,
      jobOffer: '',
      dossier: [],
      sectionOrder: [...LIST_SECTIONS],
      createdAt: now,
      updatedAt: now,
    },
    identity: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      phone2: '',
      whatsapp: false,
      address: '',
      city: '',
      country: '',
      linkedin: '',
      website: '',
      photo: '',
      birthDate: '',
      birthPlace: '',
      nationality: '',
      maritalStatus: '',
      drivingLicence: '',
    },
    privacy: { showPhoto: false, showBirthDate: false, showBirthPlace: false, showNationality: false, showMaritalStatus: false, showDrivingLicence: false },
    letter: createLetter(),
    custom: [],
    targetTitle: '',
    summary: '',
    referencesOnRequest: false,
  };
  for (const s of LIST_SECTIONS) cv[s] = [];
  return normalizeCV({ ...cv, ...overrides });
}

const str = (v) => (v === null || v === undefined ? '' : String(v));

export function normalizeDate(v) {
  const s = str(v).trim();
  if (!s) return '';
  // Accepte AAAA-MM, AAAA, MM/AAAA, AAAA/MM.
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})[/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  return s; // laissé tel quel : la validation le signalera
}

function normalizeItem(section, raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const item = { id: str(src.id) || uid(section.slice(0, 3)), hidden: Boolean(src.hidden) };
  for (const f of ITEM_FIELDS[section]) {
    const v = src[f.key];
    if (f.type === 'checkbox') item[f.key] = Boolean(v);
    else if (f.key === 'mode') item[f.key] = LANGUAGE_MODES.includes(v) ? v : '';
    else if (f.type === 'list') {
      item[f.key] = (Array.isArray(v) ? v : str(v).split(','))
        .map((x) => str(x).trim())
        .filter(Boolean);
    } else if (f.type === 'month') item[f.key] = normalizeDate(v);
    else if (f.key === 'level') item[f.key] = normalizeLevel(v);
    else item[f.key] = str(v);
  }
  return item;
}

function normalizeLevel(v) {
  const s = str(v).trim();
  if (!s) return '';
  const up = s.toUpperCase();
  if (CEFR_LEVELS.includes(up)) return up;
  if (/^(native|maternelle|langue maternelle|mother tongue)$/i.test(s)) return 'native';
  return s;
}

// ————————————————————————— Rubriques personnalisées —————————————————————————

/**
 * Rubriques personnalisées : { id, title, items: [{ id, hidden, title, subtitle, start, end, current, description }] }.
 * Elles prennent place dans meta.sectionOrder sous la clé « custom:<id> ». Leur titre doit rester un intitulé
 * standard et reconnaissable (suggestions ci-dessous) : le contrôleur signale les libellés fantaisistes.
 */
export const CUSTOM_ITEM_FIELDS = [
  { key: 'title', label: 'Intitulé (ex. : Stage d\'assistant comptable, Mémoire de Master)', type: 'text', required: true },
  { key: 'subtitle', label: 'Organisme, lieu ou précision', type: 'text' },
  { key: 'start', label: 'Début', type: 'month' },
  { key: 'end', label: 'Fin (ou date)', type: 'month' },
  { key: 'current', label: 'En cours', type: 'checkbox' },
  { key: 'description', label: 'Détails (une ligne par point)', type: 'textarea' },
];

/** Intitulés standard proposés pour une rubrique personnalisée (FR / EN). */
export const CUSTOM_TITLES = [
  'Stages', 'Formations complémentaires', 'Mémoire et travaux de recherche', 'Vie associative', 'Engagements citoyens',
  'Missions ponctuelles', 'Service civique', 'Informatique', 'Permis et habilitations', 'Activités extra-professionnelles',
  'Conférences et interventions', 'Expositions', 'Affiliations professionnelles',
  'Internships', 'Additional Training', 'Memberships', 'Community Involvement', 'Technical Skills',
];

export const MAX_CUSTOM_SECTIONS = 6;

export const customKey = (section) => `custom:${section.id}`;

export function createCustomItem(values = {}) {
  return normalizeCustomItem({ id: uid('cit'), ...values });
}

export function createCustomSection(values = {}) {
  return normalizeCustomSection({ id: uid('cus'), title: '', items: [], ...values });
}

function normalizeCustomItem(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const item = { id: str(src.id) || uid('cit'), hidden: Boolean(src.hidden) };
  for (const f of CUSTOM_ITEM_FIELDS) {
    if (f.type === 'checkbox') item[f.key] = Boolean(src[f.key]);
    else if (f.type === 'month') item[f.key] = normalizeDate(src[f.key]);
    else item[f.key] = str(src[f.key]);
  }
  return item;
}

function normalizeCustomSection(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const id = /^[a-z0-9-]{1,60}$/i.test(str(src.id)) ? str(src.id) : uid('cus');
  return { id, title: str(src.title).slice(0, 80), items: (Array.isArray(src.items) ? src.items : []).map(normalizeCustomItem) };
}

/** Rubrique personnalisée correspondant à une clé d'ordre « custom:<id> » (ou undefined). */
export function findCustom(cv, key) {
  if (!String(key).startsWith('custom:')) return undefined;
  const id = key.slice(7);
  return (cv.custom || []).find((c) => c.id === id);
}

// ————————————————————————— Lettre de motivation —————————————————————————

/**
 * Styles de lettre : « standard » (lettre de motivation française), « administratif » (usage sénégalais :
 * « À Monsieur le Directeur… », objet, formule de haute considération), « en » (cover letter).
 */
export const LETTER_STYLES = ['standard', 'administratif', 'en'];

/** Types de lettre : candidature (motivation / demande d'emploi), demande de stage, relance, remerciement après entretien. */
export const LETTER_KINDS = ['candidature', 'stage', 'relance', 'remerciement'];

/** Champs de la lettre de motivation (éditeur + normalisation). */
export const LETTER_FIELDS = [
  { key: 'recipientTitle', label: 'Destinataire (fonction) — ex. : Monsieur le Directeur des ressources humaines', type: 'text' },
  { key: 'recipientName', label: 'Nom du destinataire (si connu)', type: 'text' },
  { key: 'organization', label: 'Entreprise ou administration', type: 'text' },
  { key: 'recipientAddress', label: 'Adresse du destinataire (ex. : BP 1234, Dakar)', type: 'text' },
  { key: 'place', label: 'Lieu d\'écriture (ex. : Dakar)', type: 'text' },
  { key: 'date', label: 'Date (vide = date du jour)', type: 'date' },
  { key: 'subject', label: 'Objet (ex. : Candidature au poste de comptable)', type: 'text' },
  { key: 'reference', label: 'Référence de l\'offre (facultatif)', type: 'text' },
  { key: 'salutation', label: 'Formule d\'appel (ex. : Madame, Monsieur,)', type: 'text' },
  { key: 'body', label: 'Corps de la lettre (laissez une ligne vide entre deux paragraphes)', type: 'textarea' },
  { key: 'closing', label: 'Formule de politesse', type: 'textarea' },
  { key: 'enclosures', label: 'Pièces jointes (ex. : CV, copies des diplômes)', type: 'text' },
];

export function createLetter(values = {}) {
  return normalizeLetter({ style: 'standard', salutation: 'Madame, Monsieur,', enclosures: 'Curriculum vitae', ...values });
}

export function normalizeLetter(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const letter = {
    style: LETTER_STYLES.includes(src.style) ? src.style : 'standard',
    kind: LETTER_KINDS.includes(src.kind) ? src.kind : 'candidature',
  };
  for (const f of LETTER_FIELDS) letter[f.key] = str(src[f.key]).slice(0, f.key === 'body' ? 8000 : 600);
  if (letter.date && !/^\d{4}-\d{2}-\d{2}$/.test(letter.date)) letter.date = '';
  return letter;
}

/**
 * Complète / assainit un CV (import JSON, ancienne version, données partielles).
 * Ne lève jamais d'exception ; conserve les valeurs incorrectes pour que validateCV les signale.
 */
export function normalizeCV(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const m = src.meta && typeof src.meta === 'object' ? src.meta : {};
  const now = new Date().toISOString();
  const custom = (Array.isArray(src.custom) ? src.custom : []).slice(0, MAX_CUSTOM_SECTIONS).map(normalizeCustomSection);
  const customKeys = custom.map(customKey);
  const known = [...LIST_SECTIONS, ...customKeys];
  const order = Array.isArray(m.sectionOrder) ? m.sectionOrder.filter((s, i, a) => known.includes(s) && a.indexOf(s) === i) : [];
  for (const s of known) if (!order.includes(s)) order.push(s);
  const id = src.identity && typeof src.identity === 'object' ? src.identity : {};
  const p = src.privacy && typeof src.privacy === 'object' ? src.privacy : {};
  const cv = {
    schemaVersion: SCHEMA_VERSION,
    id: str(src.id) || uid('cv'),
    meta: {
      title: str(m.title) || 'Mon CV',
      templateId: str(m.templateId) || 'sobre',
      lang: m.lang === 'en' ? 'en' : 'fr',
      paper: m.paper === 'Letter' ? 'Letter' : 'A4',
      dateStyle: m.dateStyle === 'long' ? 'long' : 'numeric',
      anonymous: Boolean(m.anonymous),
      accent: /^#[0-9a-f]{6}$/i.test(str(m.accent)) ? str(m.accent) : '',
      palette: /^[a-z0-9-]{1,40}$/.test(str(m.palette)) ? str(m.palette) : '',
      country: COUNTRIES.includes(str(m.country)) ? str(m.country) : '',
      fit: Number.isInteger(m.fit) && m.fit >= 0 && m.fit <= MAX_FIT ? m.fit : 0,
      jobOffer: str(m.jobOffer).slice(0, 20000),
      dossier: Array.isArray(m.dossier) ? m.dossier.map(str).filter((x) => /^[a-z-]{1,30}$/.test(x)) : [],
      sectionOrder: order,
      createdAt: str(m.createdAt) || now,
      updatedAt: str(m.updatedAt) || now,
    },
    identity: {},
    privacy: {
      showPhoto: Boolean(p.showPhoto),
      showBirthDate: Boolean(p.showBirthDate),
      showBirthPlace: Boolean(p.showBirthPlace),
      showNationality: Boolean(p.showNationality),
      showMaritalStatus: Boolean(p.showMaritalStatus),
      showDrivingLicence: Boolean(p.showDrivingLicence),
    },
    targetTitle: str(src.targetTitle),
    summary: str(src.summary),
    referencesOnRequest: Boolean(src.referencesOnRequest),
    letter: normalizeLetter(src.letter),
    custom,
  };
  for (const f of [...IDENTITY_FIELDS, ...SENSITIVE_IDENTITY_FIELDS]) {
    cv.identity[f.key] = f.type === 'checkbox' ? Boolean(id[f.key]) : str(id[f.key]).trim();
  }
  const photo = str(id.photo);
  cv.identity.photo = /^data:image\/(png|jpe?g|webp);base64,/i.test(photo) ? photo : '';
  for (const s of LIST_SECTIONS) {
    const list = Array.isArray(src[s]) ? src[s] : [];
    cv[s] = list.map((it) => normalizeItem(s, it));
  }
  return cv;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const URL_RE = /^(https?:\/\/)?[^\s/$.?#].[^\s]*\.[^\s]{2,}/i;

/** Compare deux dates AAAA-MM ; renvoie <0, 0, >0. */
export function compareMonths(a, b) {
  return a.localeCompare(b);
}

/**
 * Validation structurelle et de format. Renvoie { valid, errors: [{ path, message }] }.
 * (Les règles « métier » de recrutement sont dans norms.js.)
 */
export function validateCV(cv) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });
  if (!cv || typeof cv !== 'object') return { valid: false, errors: [{ path: '', message: 'CV absent ou illisible.' }] };
  if (!cv.meta || typeof cv.meta !== 'object') add('meta', 'Métadonnées manquantes.');
  if (!cv.identity || typeof cv.identity !== 'object') add('identity', 'Identité manquante.');
  else {
    const { email, linkedin, website, birthDate } = cv.identity;
    if (email && !EMAIL_RE.test(email)) add('identity.email', `Adresse e-mail invalide : « ${email} ».`);
    if (linkedin && !URL_RE.test(linkedin)) add('identity.linkedin', 'Lien LinkedIn invalide.');
    if (website && !URL_RE.test(website)) add('identity.website', 'Adresse du site invalide.');
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) add('identity.birthDate', 'Date de naissance invalide (AAAA-MM-JJ).');
  }
  if (cv.meta && !['fr', 'en'].includes(cv.meta.lang)) add('meta.lang', 'Langue du CV inconnue.');
  if (cv.meta && !['A4', 'Letter'].includes(cv.meta.paper)) add('meta.paper', 'Format de papier inconnu.');
  for (const s of LIST_SECTIONS) {
    if (!Array.isArray(cv[s])) {
      add(s, `La rubrique « ${s} » doit être une liste.`);
      continue;
    }
    cv[s].forEach((item, i) => {
      for (const f of ITEM_FIELDS[s]) {
        const v = item[f.key];
        const path = `${s}.${i}.${f.key}`;
        if (f.type === 'month' && v && !MONTH_RE.test(v)) add(path, `Date invalide « ${v} » (format attendu : mois/année).`);
        if (f.type === 'list' && !Array.isArray(v)) add(path, 'Liste attendue.');
        if (f.key === 'level' && v && !CEFR_LEVELS.includes(v)) add(path, `Niveau « ${v} » hors CECRL (A1 à C2 ou langue maternelle).`);
        if (f.type === 'url' && v && !URL_RE.test(v)) add(path, 'Lien invalide.');
      }
      if (item.start && item.end && MONTH_RE.test(item.start) && MONTH_RE.test(item.end) && item.end < item.start) {
        add(`${s}.${i}.end`, 'La date de fin précède la date de début.');
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

/** Copie profonde (les CV ne contiennent que du JSON). */
export function cloneCV(cv) {
  return JSON.parse(JSON.stringify(cv));
}

/** Lit une valeur par chemin « a.b.0.c ». */
export function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Écrit une valeur par chemin « a.b.0.c » (les intermédiaires doivent exister). */
export function setByPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (target == null) throw new Error(`Chemin introuvable : ${path}`);
  target[last] = value;
  return obj;
}

/** Clé de tri : un poste en cours est « le plus récent ». */
export function recencyKey(item) {
  if (item.current) return '9999-99';
  return item.end || item.start || item.date || '';
}

/** Trie une rubrique datée en ordre antéchronologique (le plus récent d'abord). */
export function sortAntichronological(list) {
  return [...list].sort((a, b) => {
    const k = recencyKey(b).localeCompare(recencyKey(a));
    return k !== 0 ? k : (b.start || '').localeCompare(a.start || '');
  });
}

/** Déplace un élément dans une liste (renvoie une nouvelle liste). */
export function moveItem(list, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= list.length) return [...list];
  const copy = [...list];
  const [it] = copy.splice(index, 1);
  copy.splice(to, 0, it);
  return copy;
}

/** Données d'exemple réalistes : profil sénégalais, en français. */
export function createSampleCV() {
  return createEmptyCV({
    meta: { title: 'Exemple — Awa Ndiaye', templateId: 'sobre', lang: 'fr', paper: 'A4' },
    identity: {
      firstName: 'Awa',
      lastName: 'Ndiaye',
      email: 'awa.ndiaye@example.com',
      phone: '+221 77 123 45 67',
      city: 'Dakar',
      country: 'Sénégal',
      address: '',
      linkedin: 'https://www.linkedin.com/in/awa-ndiaye',
      website: '',
      photo: '',
      birthDate: '',
      nationality: '',
      maritalStatus: '',
      drivingLicence: 'Permis B',
    },
    targetTitle: 'Chargée de marketing digital',
    summary:
      'Chargée de marketing digital, 6 ans d\'expérience dans la distribution et les services mobiles au Sénégal : ' +
      'campagnes multicanales, analyse de la performance, acquisition client.',
    experiences: [
      {
        position: 'Chargée de marketing digital',
        employer: 'Teranga Distribution',
        city: 'Dakar',
        start: '2022-03',
        current: true,
        description:
          'Piloter un budget publicitaire de 45 millions FCFA par an sur Facebook, Instagram et Google\n' +
          'Augmenter de 38 % les ventes en ligne en 18 mois grâce à des campagnes ciblées\n' +
          'Encadrer 2 assistants et une agence de création',
      },
      {
        position: 'Assistante marketing',
        employer: 'Baobab Mobile Services',
        city: 'Dakar',
        start: '2019-09',
        end: '2022-02',
        description:
          'Organiser 12 opérations promotionnelles en points de vente (Dakar, Thiès, Saint-Louis)\n' +
          'Rédiger les contenus des réseaux sociaux : communauté passée de 20 000 à 85 000 abonnés\n' +
          'Suivre les indicateurs de campagne et produire le reporting mensuel',
      },
      {
        position: 'Stagiaire communication',
        employer: 'Agence Sabar Conseil',
        city: 'Dakar',
        start: '2019-02',
        end: '2019-07',
        description: 'Concevoir des supports de communication pour 5 clients et animer les pages de l\'agence',
      },
    ],
    education: [
      {
        degree: 'Master Marketing et Communication',
        school: 'Institut Supérieur de Management (ISM)',
        city: 'Dakar',
        start: '2017-10',
        end: '2019-07',
        description: 'Mémoire : « L\'usage du mobile money dans le parcours d\'achat en ligne »',
      },
      {
        degree: 'Licence en Sciences économiques et de gestion',
        school: 'Université Cheikh Anta Diop',
        city: 'Dakar',
        start: '2014-10',
        end: '2017-07',
      },
    ],
    skills: [
      { name: 'Marketing', keywords: ['Stratégie social media', 'Publicité Meta et Google Ads', 'SEO', 'E-mailing', 'Analyse de données'] },
      { name: 'Outils', keywords: ['Google Analytics 4', 'Meta Business Suite', 'Canva', 'Excel (tableaux croisés)', 'HubSpot'] },
    ],
    languages: [
      { name: 'Wolof', level: 'native' },
      { name: 'Français', level: 'C2' },
      { name: 'Anglais', level: 'B2', certificate: 'TOEIC 845' },
    ],
    certifications: [
      { name: 'Meta Certified Digital Marketing Associate', issuer: 'Meta', date: '2022-11' },
    ],
    projects: [],
    volunteering: [
      {
        role: 'Formatrice bénévole en compétences numériques',
        organization: 'Association Jappo Liggey',
        start: '2020-01',
        current: true,
        description: 'Former chaque trimestre 20 jeunes femmes aux outils bureautiques et aux réseaux sociaux',
      },
    ],
    interests: [{ name: 'Basket-ball en club (ASC Jaraaf)' }, { name: 'Photographie de rue' }, { name: 'Lecture : littérature africaine' }],
    references: [],
    referencesOnRequest: true,
  });
}

/** Exemple « jeune diplômé » : BTS, stages, langues nationales à l'oral, format premier emploi (Sénégal). */
export function createSampleJunior() {
  return createEmptyCV({
    meta: { title: 'Exemple — Moussa Diop (jeune diplômé)', templateId: 'premier-emploi', lang: 'fr', paper: 'A4', country: 'SN' },
    identity: {
      firstName: 'Moussa',
      lastName: 'Diop',
      email: 'moussa.diop@example.com',
      phone: '+221 78 234 56 78',
      whatsapp: true,
      city: 'Thiès',
      country: 'Sénégal',
      drivingLicence: 'Permis B',
    },
    privacy: { showDrivingLicence: true },
    targetTitle: 'Technicien en électrotechnique',
    summary:
      'Technicien supérieur en électrotechnique (BTS 2025), 10 mois de stages en maintenance industrielle et en installation ' +
      'solaire. Disponible immédiatement, mobile sur Thiès, Dakar et Diamniadio.',
    experiences: [
      {
        position: 'Stagiaire technicien de maintenance',
        employer: 'Société Minière du Cayor',
        city: 'Mboro',
        start: '2025-03',
        end: '2025-08',
        description:
          'Réaliser la maintenance préventive de 25 moteurs électriques selon le planning\n' +
          'Diagnostiquer les pannes des armoires de commande avec les techniciens\n' +
          'Mettre à jour les fiches d\'intervention dans la GMAO',
      },
      {
        position: 'Stagiaire installateur photovoltaïque',
        employer: 'SolarTeranga',
        city: 'Thiès',
        start: '2024-07',
        end: '2024-10',
        description: 'Poser 12 kits solaires domestiques et 2 installations de pompage dans la région de Thiès',
      },
    ],
    education: [
      { degree: 'BTS Électrotechnique', school: 'Lycée technique Seydina Limamou Laye', city: 'Guédiawaye', start: '2023-10', end: '2025-07', description: 'Projet de fin d\'études : automatisation d\'une station de pompage (mention Bien)' },
      { degree: 'Baccalauréat série T1 (technique)', school: 'Lycée technique Maurice Delafosse', city: 'Dakar', end: '2023-07' },
    ],
    skills: [
      { name: 'Techniques', keywords: ['Maintenance préventive', 'Lecture de schémas électriques', 'Automates Schneider', 'Photovoltaïque', 'Habilitation électrique B1V'] },
      { name: 'Outils', keywords: ['AutoCAD Electrical', 'Excel', 'GMAO'] },
    ],
    languages: [
      { name: 'Wolof', level: 'native', mode: 'oral' },
      { name: 'Français', level: 'C1' },
      { name: 'Pulaar', level: 'B2', mode: 'oral' },
      { name: 'Anglais', level: 'A2' },
    ],
    certifications: [{ name: 'Habilitation électrique B1V-BR', issuer: 'ONFP', date: '2025-05' }],
    volunteering: [
      { role: 'Trésorier', organization: 'Association sportive et culturelle de mon quartier (ASC)', start: '2022-01', current: true, description: 'Gérer un budget annuel de 1,2 million FCFA et organiser le tournoi navétane' },
    ],
    interests: [{ name: 'Football en club (navétanes)' }, { name: 'Réparation de petit électroménager pour le voisinage' }],
    referencesOnRequest: true,
  });
}

/** Données d'exemple en anglais (résumé US / CV UK). */
export function createSampleCVEnglish() {
  const cv = createSampleCV();
  cv.meta.title = 'Sample — Awa Ndiaye (EN)';
  cv.meta.lang = 'en';
  cv.meta.templateId = 'us-resume';
  cv.meta.paper = 'Letter';
  cv.identity.drivingLicence = '';
  cv.targetTitle = 'Digital Marketing Specialist';
  cv.summary =
    'Digital marketing specialist with 6 years of experience in retail and mobile services in Senegal. ' +
    'Proven track record in multichannel campaigns and performance analysis.';
  cv.experiences[0].position = 'Digital Marketing Specialist';
  cv.experiences[0].description =
    'Managed an annual ad budget of USD 75,000 across Facebook, Instagram and Google\n' +
    'Increased online sales by 38% in 18 months through targeted campaigns\n' +
    'Supervised 2 assistants and a creative agency';
  cv.experiences[1].position = 'Marketing Assistant';
  cv.experiences[1].description =
    'Organized 12 in-store promotional events (Dakar, Thiès, Saint-Louis)\n' +
    'Grew the social media community from 20,000 to 85,000 followers\n' +
    'Tracked campaign KPIs and produced monthly reports';
  cv.experiences[2].position = 'Communications Intern';
  cv.experiences[2].description = 'Designed communication materials for 5 clients and managed the agency social media pages';
  cv.education[0].degree = 'Master of Marketing and Communication';
  cv.education[0].description = 'Thesis: "Mobile money in the online purchase journey"';
  cv.education[1].degree = 'Bachelor of Economics and Management';
  cv.skills = [
    createItem('skills', { name: 'Marketing', keywords: ['Social media strategy', 'Meta & Google Ads', 'SEO', 'Email marketing', 'Data analysis'] }),
    createItem('skills', { name: 'Tools', keywords: ['Google Analytics 4', 'Meta Business Suite', 'Canva', 'Excel', 'HubSpot'] }),
  ];
  cv.languages = [
    createItem('languages', { name: 'Wolof', level: 'native' }),
    createItem('languages', { name: 'French', level: 'C2' }),
    createItem('languages', { name: 'English', level: 'B2', certificate: 'TOEIC 845' }),
  ];
  cv.volunteering[0].role = 'Volunteer digital skills trainer';
  cv.volunteering[0].description = 'Train 20 young women each quarter in office software and social media';
  cv.interests = [createItem('interests', { name: 'Club basketball' }), createItem('interests', { name: 'Street photography' })];
  return cv;
}
