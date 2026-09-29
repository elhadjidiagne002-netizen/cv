// Référentiel « Sénégal » (100 % local, sans serveur) : diplômes et équivalences, établissements,
// villes, langues nationales, téléphone (+221), montants en francs CFA, dossier de concours.
// Module pur (aucun DOM) : utilisé par l'éditeur (suggestions), le contrôleur (norms.js) et les tests.

/**
 * Diplômes du système sénégalais (et courants en Afrique de l'Ouest francophone), avec leur
 * équivalence lisible par un recruteur étranger. `re` détecte le sigle dans un intitulé saisi.
 * `foreign` : sigle peu connu hors du Sénégal → une précision est conseillée sur un CV international.
 */
export const DIPLOMAS = [
  { id: 'cfee', label: 'CFEE (Certificat de fin d\'études élémentaires)', re: /\bCFEE\b/i, foreign: true, secondary: true,
    fr: 'fin du cycle élémentaire (école primaire)', en: 'primary school leaving certificate' },
  { id: 'bfem', label: 'BFEM (Brevet de fin d\'études moyennes)', re: /\bBFEM\b/i, foreign: true, secondary: true,
    fr: 'équivalent du brevet des collèges (fin du cycle moyen)', en: 'lower secondary school certificate (Grade 10 equivalent)' },
  { id: 'cap', label: 'CAP (Certificat d\'aptitude professionnelle)', re: /\bCAP\b/, foreign: false,
    fr: 'diplôme professionnel de niveau 3', en: 'vocational certificate (EQF level 3)' },
  { id: 'bep', label: 'BEP (Brevet d\'études professionnelles)', re: /\bBEP\b/, foreign: false,
    fr: 'diplôme professionnel de niveau 3', en: 'vocational certificate (EQF level 3)' },
  { id: 'bt', label: 'BT (Brevet de technicien)', re: /\bBT\b/, foreign: true,
    fr: 'diplôme de technicien, niveau baccalauréat', en: 'technician diploma (high school level)' },
  { id: 'bac', label: 'Baccalauréat (séries L, S1, S2, S3, G, T…)', re: /\bbac(calaur[ée]at)?\b/i, foreign: false, secondary: true,
    fr: 'diplôme de fin d\'études secondaires', en: 'high school diploma (French-system baccalaureate)' },
  { id: 'bts', label: 'BTS (Brevet de technicien supérieur)', re: /\bBTS\b/, foreign: false,
    fr: 'Bac + 2', en: 'two-year higher technical diploma (Associate degree equivalent)' },
  { id: 'dut', label: 'DUT (Diplôme universitaire de technologie)', re: /\bDUT\b/, foreign: false,
    fr: 'Bac + 2', en: 'two-year university technology diploma (Associate degree equivalent)' },
  { id: 'dts', label: 'DTS (Diplôme de technicien supérieur)', re: /\bDTS\b/, foreign: true,
    fr: 'Bac + 2, équivalent du BTS', en: 'two-year higher technical diploma (Associate degree equivalent)' },
  { id: 'duel', label: 'DUEL / DUES (Diplôme universitaire d\'études littéraires / scientifiques)', re: /\bDUE[LS]\b/, foreign: true,
    fr: 'Bac + 2 (ancien premier cycle universitaire)', en: 'two-year university diploma' },
  { id: 'licence', label: 'Licence (LMD)', re: /\blicence\b/i, foreign: false,
    fr: 'Bac + 3', en: 'Bachelor\'s degree (3 years)' },
  { id: 'licence-pro', label: 'Licence professionnelle', re: /licence pro/i, foreign: false,
    fr: 'Bac + 3', en: 'Professional Bachelor\'s degree (3 years)' },
  { id: 'maitrise', label: 'Maîtrise', re: /\bma[iî]trise\b/i, foreign: true,
    fr: 'Bac + 4 (ancien système)', en: '4-year university degree (pre-LMD system)' },
  { id: 'master', label: 'Master (LMD)', re: /\bmaster\b/i, foreign: false,
    fr: 'Bac + 5', en: 'Master\'s degree' },
  { id: 'dea', label: 'DEA / DESS', re: /\bDE[AS]S?\b/, foreign: true,
    fr: 'Bac + 5 (ancien système)', en: 'postgraduate diploma, Master\'s level (pre-LMD system)' },
  { id: 'ingenieur', label: 'Diplôme d\'ingénieur (ESP, EPT, ENSA…)', re: /\bing[ée]nieur\b/i, foreign: false,
    fr: 'Bac + 5', en: 'Master\'s-level engineering degree' },
  { id: 'doctorat', label: 'Doctorat', re: /\bdoctorat\b|\bph\.?d\b/i, foreign: false,
    fr: 'Bac + 8', en: 'PhD' },
  { id: 'caem', label: 'CAEM (Certificat d\'aptitude à l\'enseignement moyen)', re: /\bCAEM\b/, foreign: true,
    fr: 'diplôme professionnel de professeur de collège (FASTEF)', en: 'lower secondary teaching qualification' },
  { id: 'caes', label: 'CAES (Certificat d\'aptitude à l\'enseignement secondaire)', re: /\bCAES\b/, foreign: true,
    fr: 'diplôme professionnel de professeur de lycée (FASTEF)', en: 'upper secondary teaching qualification' },
  { id: 'ceap', label: 'CEAP (Certificat élémentaire d\'aptitude pédagogique)', re: /\bCEAP\b/, foreign: true,
    fr: 'diplôme professionnel d\'instituteur', en: 'primary teaching qualification' },
  { id: 'dfe', label: 'Diplôme d\'État (infirmier, sage-femme — ENDSS)', re: /dipl[oô]me d'[ée]tat/i, foreign: false,
    fr: 'diplôme d\'État paramédical (Bac + 3)', en: 'State nursing / midwifery diploma (3 years)' },
];

/** Établissements d'enseignement supérieur et de formation (suggestions de saisie). */
export const SCHOOLS = [
  'Université Cheikh Anta Diop de Dakar (UCAD)',
  'Université Gaston Berger de Saint-Louis (UGB)',
  'Université Assane Seck de Ziguinchor (UASZ)',
  'Université Alioune Diop de Bambey (UADB)',
  'Université Iba Der Thiam de Thiès (UIDT)',
  'Université du Sine Saloum El-Hâdj Ibrahima Niass (USSEIN)',
  'Université Amadou Mahtar Mbow (UAM)',
  'Université numérique Cheikh Hamidou Kane (UN-CHK, ex-UVS)',
  'École supérieure polytechnique (ESP)',
  'École polytechnique de Thiès (EPT)',
  'École nationale de la statistique et de l\'analyse économique (ENSAE)',
  'École nationale d\'administration (ENA)',
  'École nationale supérieure d\'agriculture (ENSA)',
  'Faculté des sciences et technologies de l\'éducation et de la formation (FASTEF)',
  'École nationale de développement sanitaire et social (ENDSS)',
  'École supérieure multinationale des télécommunications (ESMT)',
  'Centre africain d\'études supérieures en gestion (CESAG)',
  'Institut supérieur de management (ISM)',
  'Groupe Sup de Co Dakar',
  'Bordeaux École de management — BEM Dakar',
  'Institut africain de management (IAM)',
  'Université catholique de l\'Afrique de l\'Ouest (UCAO)',
  'Institut supérieur d\'enseignement professionnel (ISEP)',
  'École supérieure d\'économie appliquée (ESEA, ex-ENEA)',
  'Centre de formation professionnelle et technique Sénégal-Japon',
  'Lycée technique Seydina Limamou Laye',
  'Lycée d\'excellence Mariama Bâ',
  'Prytanée militaire de Saint-Louis',
];

/** Chefs-lieux des 14 régions et grandes villes. */
export const CITIES = [
  'Dakar', 'Pikine', 'Guédiawaye', 'Rufisque', 'Keur Massar', 'Diamniadio', 'Thiès', 'Mbour', 'Saly', 'Tivaouane',
  'Saint-Louis', 'Richard-Toll', 'Louga', 'Diourbel', 'Touba', 'Mbacké', 'Kaolack', 'Fatick', 'Kaffrine',
  'Ziguinchor', 'Bignona', 'Kolda', 'Sédhiou', 'Tambacounda', 'Kédougou', 'Matam', 'Ourossogui', 'Podor',
];

/** Langues nationales du Sénégal et langues de travail courantes (suggestions pour la rubrique Langues). */
export const LANGUAGES = [
  'Français', 'Anglais', 'Arabe', 'Espagnol', 'Portugais', 'Italien', 'Allemand', 'Chinois (mandarin)',
  'Wolof', 'Pulaar', 'Sérère', 'Diola (joola)', 'Mandinka', 'Soninké', 'Balante', 'Manjaque', 'Mancagne',
  'Bassari', 'Hassaniya', 'Noon', 'Saafi', 'Bambara',
];

/** Langues nationales (pour qui l'usage est souvent oral : l'éditeur propose « à l'oral »). */
export const NATIONAL_LANGUAGES = new Set(['wolof', 'pulaar', 'peul', 'fulfulde', 'sérère', 'serer', 'seereer', 'diola', 'joola', 'jola', 'mandinka', 'mandingue',
  'soninké', 'soninke', 'balante', 'manjaque', 'mancagne', 'bassari', 'hassaniya', 'noon', 'saafi', 'bambara', 'malinké', 'bédik', 'laalaa']);

export function isNationalLanguage(name) {
  const n = String(name || '').toLowerCase().replace(/\s*\(.*\)\s*/, '').trim();
  return NATIONAL_LANGUAGES.has(n);
}

// ————————————————————————— Téléphone —————————————————————————

/** Préfixes valides des numéros sénégalais à 9 chiffres (mobiles Orange, Free, Expresso, Promobile ; fixes 33). */
const SN_PREFIXES = ['70', '71', '75', '76', '77', '78', '33', '30'];

/**
 * Analyse un numéro sénégalais. Renvoie { national: '771234567' } si le numéro est sénégalais
 * (avec ou sans +221 / 00221), { invalid: true } s'il commence par +221 mais n'a pas la bonne forme,
 * ou null si ce n'est pas un numéro sénégalais.
 */
export function parseSenegalPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '').replace(/^00/, '+');
  let national = null;
  if (digits.startsWith('+221')) national = digits.slice(4);
  else if (digits.startsWith('221') && digits.length === 12) national = digits.slice(3);
  else if (!digits.startsWith('+') && digits.length === 9 && SN_PREFIXES.includes(digits.slice(0, 2))) national = digits;
  if (national === null) return null;
  if (national.length !== 9 || !SN_PREFIXES.includes(national.slice(0, 2))) return { invalid: true, national };
  return { national };
}

/** Écriture recommandée : « +221 77 123 45 67 » (lisible et joignable depuis l'étranger). */
export function formatSenegalPhone(phone) {
  const p = parseSenegalPhone(phone);
  if (!p || p.invalid) return String(phone || '');
  const n = p.national;
  return `+221 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

// ————————————————————————— Francs CFA —————————————————————————

/** Parité fixe : 1 euro = 655,957 francs CFA (UEMOA). */
export const XOF_PER_EUR = 655.957;

const MULT = { milliard: 1e9, milliards: 1e9, million: 1e6, millions: 1e6, millier: 1e3, milliers: 1e3, mille: 1e3, k: 1e3, m: 1e6, md: 1e9, mds: 1e9 };

/**
 * Trouve les montants exprimés en francs CFA dans un texte.
 * Renvoie [{ text, amount }] — ex. « 45 millions FCFA » → 45 000 000.
 */
export function findCFAAmounts(text) {
  const out = [];
  const re = /(\d{1,3}(?:[ .  ]\d{3})+|\d+(?:[.,]\d+)?)\s*(milliards?|millions?|milliers?|mille|mds?|md|k|m)?\s*(?:de\s+)?(?:F\.?\s?CFA|FCFA|francs?\s+CFA|XOF)\b/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const n = Number(m[1].replace(/[ .  ](?=\d{3}\b)/g, '').replace(',', '.'));
    const mult = m[2] ? MULT[m[2].toLowerCase()] || 1 : 1;
    if (Number.isFinite(n)) out.push({ text: m[0], amount: n * mult });
  }
  return out;
}

/** Montant arrondi lisible en euros ou en dollars (taux USD indicatif, précisé dans le conseil). */
export function convertCFA(amount, currency = 'EUR', usdPerEur = 1.1) {
  const eur = amount / XOF_PER_EUR;
  const v = currency === 'USD' ? eur * usdPerEur : eur;
  const round = (x) => {
    if (x >= 1e6) return `${(Math.round(x / 1e5) / 10).toLocaleString('fr-FR')} million${x >= 2e6 ? 's' : ''}`;
    if (x >= 1e4) return (Math.round(x / 1e3) * 1e3).toLocaleString('fr-FR').replace(/ /g, ' ');
    return (Math.round(x / 10) * 10).toLocaleString('fr-FR').replace(/ /g, ' ');
  };
  return `${round(v)} ${currency === 'USD' ? '$' : '€'}`;
}

// ————————————————————————— Diplômes —————————————————————————

/** Diplômes sénégalais peu connus à l'étranger trouvés dans un intitulé : [{ diploma, equivalent }]. */
export function foreignDiplomas(text, lang = 'fr') {
  const s = String(text || '');
  return DIPLOMAS.filter((d) => d.foreign && d.re.test(s)).map((d) => ({ diploma: d, equivalent: lang === 'en' ? d.en : d.fr }));
}

/** L'intitulé contient-il déjà une précision (parenthèse, « équivalent », « Bac + », « level »…) ? */
export function hasEquivalentNote(text) {
  return /\(|[ée]quivalent|bac\s*\+\s*\d|level|niveau|grade/i.test(String(text || ''));
}

// ————————————————————————— Dossier de concours (fonction publique) —————————————————————————

/**
 * Pièces habituellement demandées pour un concours de la fonction publique sénégalaise ou un
 * recrutement dans l'administration. Liste indicative : l'avis de concours fait foi.
 */
export const DOSSIER_ITEMS = [
  { id: 'demande', label: 'Demande manuscrite adressée à l\'autorité (ex. : Monsieur le Ministre…)' },
  { id: 'cv', label: 'Curriculum vitae daté et signé' },
  { id: 'naissance', label: 'Extrait d\'acte de naissance (ou copie littérale) de moins de 3 mois' },
  { id: 'nationalite', label: 'Certificat de nationalité sénégalaise' },
  { id: 'cni', label: 'Copie légalisée de la carte nationale d\'identité CEDEAO' },
  { id: 'diplomes', label: 'Copies certifiées conformes (légalisées) des diplômes et attestations' },
  { id: 'casier', label: 'Extrait du casier judiciaire (bulletin n° 3) de moins de 3 mois' },
  { id: 'medical', label: 'Certificat de visite et contre-visite médicale' },
  { id: 'photos', label: 'Photos d\'identité récentes (souvent 2 à 4)' },
  { id: 'timbre', label: 'Timbre fiscal ou quittance des droits d\'inscription, si l\'avis le prévoit' },
  { id: 'enveloppe', label: 'Enveloppes timbrées à votre adresse, si demandées' },
];
