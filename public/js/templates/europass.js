// Famille Europass : structure et intitulés officiels du CV Europass (Union européenne, format 2020+).
// Une colonne ; rubriques dans l'ordre Europass ; langues séparées en « maternelle(s) » / « autre(s) ».

import { esc, head, section, sectionTitle } from './parts.js';
import { levelLabel } from '../i18n.js';
import { palettes } from './palettes.js';

const LABELS = {
  fr: {
    summary: 'À propos de moi',
    experiences: 'Expérience professionnelle',
    education: 'Éducation et formation',
    languages: 'Compétences linguistiques',
    skills: 'Compétences',
    certifications: 'Certifications',
    awards: 'Distinctions',
    publications: 'Publications',
    projects: 'Projets',
    volunteering: 'Activités bénévoles',
    interests: 'Loisirs et centres d\'intérêt',
    references: 'Références',
  },
  en: {
    summary: 'About me',
    experiences: 'Work experience',
    education: 'Education and training',
    languages: 'Language skills',
    skills: 'Skills',
    certifications: 'Certifications',
    awards: 'Honours and awards',
    publications: 'Publications',
    projects: 'Projects',
    volunteering: 'Volunteering',
    interests: 'Hobbies and interests',
    references: 'References',
  },
};

/** Ordre officiel Europass (les rubriques absentes de l'ordre utilisateur sont ignorées). */
const EUROPASS_ORDER = ['experiences', 'education', 'languages', 'skills', 'certifications', 'publications', 'awards', 'projects', 'volunteering', 'interests', 'references'];

function languagesEuropass(view) {
  const list = view.cv.languages;
  if (!list.length) return '';
  const native = list.filter((l) => l.level === 'native');
  const others = list.filter((l) => l.level !== 'native');
  const lab = (k) => (view.lang === 'en' ? { mother: 'Mother tongue(s)', other: 'Other language(s)' } : { mother: 'Langue(s) maternelle(s)', other: 'Autre(s) langue(s)' })[k];
  const colon = view.lang === 'fr' ? ' :' : ':';
  let body = '';
  if (native.length) body += `<p class="cv-ep-mother"><strong>${esc(lab('mother'))}${colon}</strong> ${esc(native.map((l) => l.name).join(', '))}</p>`;
  if (others.length) {
    body += `<p class="cv-ep-other-label"><strong>${esc(lab('other'))}${colon}</strong></p><ul class="cv-langs">${others
      .map((l) => `<li><span class="cv-lang-name">${esc(l.name)}</span>${l.level ? ` <span class="cv-lang-level">— ${esc(levelLabel(view.lang, l.level))}</span>` : ''}${
        l.certificate ? ` <span class="cv-lang-cert">(${esc(l.certificate)})</span>` : ''
      }</li>`)
      .join('')}</ul>`;
  }
  return `<section class="cv-section cv-s-languages" data-section="languages">${sectionTitle(view, 'languages')}${body}</section>`;
}

function renderEuropass(view) {
  const order = EUROPASS_ORDER.filter((k) => view.order.includes(k));
  const body = order.map((k) => (k === 'languages' ? languagesEuropass(view) : section(view, k))).join('');
  return `${head(view, { contact: 'list' })}${section(view, 'summary')}${body}`;
}

export const templates = [
  {
    id: 'europass',
    name: 'Europass',
    family: 'europass',
    category: 'Europass',
    ats: true,
    columns: 1,
    photo: true,
    format: 'A4',
    labels: LABELS,
    palettes: palettes('europe', 'marine', 'petrole', 'anthracite'),
    description: 'Structure et intitulés officiels du CV Europass de l\'Union européenne (études, mobilité, candidatures en Europe).',
    render: renderEuropass,
  },
];
