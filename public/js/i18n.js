// Libellés des rubriques du CV (FR / EN) et mise en forme des dates.
// Titres standard, reconnus par les logiciels de tri (ATS) — jamais de libellé fantaisiste.

export const LABELS = {
  fr: {
    summary: 'Profil',
    experiences: 'Expérience professionnelle',
    education: 'Formation',
    skills: 'Compétences',
    languages: 'Langues',
    certifications: 'Certifications',
    projects: 'Projets',
    volunteering: 'Bénévolat',
    interests: 'Centres d\'intérêt',
    references: 'Références',
    contact: 'Coordonnées',
    personal: 'Informations personnelles',
    present: 'Aujourd\'hui',
    referencesOnRequest: 'Références disponibles sur demande.',
    anonymousName: 'Candidature anonyme',
    anonymousContact: 'Coordonnées communiquées par l\'intermédiaire du recruteur',
    birthDate: 'Date de naissance',
    nationality: 'Nationalité',
    maritalStatus: 'Situation familiale',
    drivingLicence: 'Permis',
    motherTongue: 'Langue(s) maternelle(s)',
    otherLanguages: 'Autre(s) langue(s)',
    email: 'E-mail',
    phone: 'Téléphone',
    address: 'Adresse',
    website: 'Site',
    linkedin: 'LinkedIn',
    photoAlt: 'Photo du candidat',
    levels: {
      A1: 'A1 — Débutant',
      A2: 'A2 — Élémentaire',
      B1: 'B1 — Intermédiaire',
      B2: 'B2 — Avancé',
      C1: 'C1 — Autonome',
      C2: 'C2 — Maîtrise',
      native: 'Langue maternelle',
    },
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  en: {
    summary: 'Summary',
    experiences: 'Professional Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    certifications: 'Certifications',
    projects: 'Projects',
    volunteering: 'Volunteer Experience',
    interests: 'Interests',
    references: 'References',
    contact: 'Contact',
    personal: 'Personal Information',
    present: 'Present',
    referencesOnRequest: 'References available upon request.',
    anonymousName: 'Anonymous Candidate',
    anonymousContact: 'Contact details available through the recruiter',
    birthDate: 'Date of birth',
    nationality: 'Nationality',
    maritalStatus: 'Marital status',
    drivingLicence: 'Driving licence',
    motherTongue: 'Mother tongue(s)',
    otherLanguages: 'Other language(s)',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    website: 'Website',
    linkedin: 'LinkedIn',
    photoAlt: 'Candidate photo',
    levels: {
      A1: 'A1 — Beginner',
      A2: 'A2 — Elementary',
      B1: 'B1 — Intermediate',
      B2: 'B2 — Upper intermediate',
      C1: 'C1 — Advanced',
      C2: 'C2 — Proficient',
      native: 'Native',
    },
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};

export const SUPPORTED_LANGS = Object.keys(LABELS);

/** Libellé d'une clé pour une langue (repli sur le français). */
export function t(lang, key) {
  const dict = LABELS[lang] || LABELS.fr;
  return dict[key] ?? LABELS.fr[key] ?? key;
}

/** Libellé d'un niveau CECRL. */
export function levelLabel(lang, level) {
  const dict = (LABELS[lang] || LABELS.fr).levels;
  return dict[level] || level || '';
}

/**
 * Met en forme une date AAAA-MM (ou AAAA).
 * style « numeric » : 03/2022 ; « long » : mars 2022 / March 2022.
 * Format homogène pour tout le CV (norme de lisibilité ATS).
 */
export function formatDate(ym, lang = 'fr', style = 'numeric') {
  if (!ym) return '';
  const m = String(ym).match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!m) return String(ym);
  const [, year, month] = m;
  if (!month) return year;
  if (style === 'long') {
    const name = (LABELS[lang] || LABELS.fr).months[Number(month) - 1];
    return name ? `${name} ${year}` : `${month}/${year}`;
  }
  return `${month}/${year}`;
}

/** Période « début – fin » ; « Aujourd'hui / Present » pour un poste en cours. */
export function formatRange(start, end, current, lang = 'fr', style = 'numeric') {
  const a = formatDate(start, lang, style);
  const b = current ? t(lang, 'present') : formatDate(end, lang, style);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a || b || '';
}

/** Date de naissance JJ/MM/AAAA (FR) ou Month D, YYYY (EN). */
export function formatBirthDate(iso, lang = 'fr') {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso || '');
  if (lang === 'en') return `${LABELS.en.months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
