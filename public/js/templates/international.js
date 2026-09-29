// Famille « internationale » : résumé américain (US resume) et CV britannique (UK CV).
// Rubriques en anglais, jamais de photo ni de date de naissance / nationalité / situation familiale
// (pratique anti-discrimination aux États-Unis et au Royaume-Uni). Une colonne, compatible ATS.

import { head, section, sections } from './parts.js';
import { palettes } from './palettes.js';

const US_ORDER = ['experiences', 'education', 'skills', 'certifications', 'awards', 'publications', 'projects', 'volunteering', 'languages'];

function renderUS(view) {
  const order = US_ORDER.filter((k) => view.order.includes(k));
  return `${head(view, { contact: 'inline', withPhoto: false })}${section(view, 'summary')}${sections(view, order)}`;
}

function renderUK(view) {
  return `${head(view, { contact: 'inline', withPhoto: false })}${section(view, 'summary')}${sections(view, view.order)}`;
}

export const templates = [
  {
    id: 'us-resume',
    name: 'Résumé US',
    family: 'international',
    category: 'International',
    ats: true,
    columns: 1,
    photo: false,
    format: 'Letter',
    forceFormat: true,
    lang: 'en',
    noPersonal: true,
    excludeSections: ['interests', 'references'],
    dateStyle: 'long',
    palettes: palettes('noir', 'marine', 'bleu-nuit'),
    labels: { en: { experiences: 'Professional Experience', volunteering: 'Volunteer Experience' } },
    description: 'Format américain : papier Letter, en anglais, sans photo ni date de naissance, 1 page conseillée.',
    render: renderUS,
  },
  {
    id: 'uk-cv',
    name: 'CV britannique',
    family: 'international',
    category: 'International',
    ats: true,
    columns: 1,
    photo: false,
    format: 'A4',
    forceFormat: true,
    lang: 'en',
    noPersonal: true,
    excludeSections: [],
    palettes: palettes('marine', 'noir', 'bordeaux', 'foret'),
    labels: { en: { summary: 'Personal Profile', experiences: 'Employment History' } },
    description: 'Format britannique : A4, en anglais, sans photo ni informations personnelles, 2 pages maximum.',
    render: renderUK,
  },
];
