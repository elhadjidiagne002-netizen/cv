// Famille « académique » : CV long de chercheur, d'enseignant-chercheur ou de doctorant.
// Formation en tête, puis expériences, publications et distinctions. Plusieurs pages admises
// (longForm) : le contrôleur n'exige pas la limite de 2 pages. Une colonne, compatible ATS.

import { head, section, sections, reorder } from './parts.js';
import { palettes } from './palettes.js';

const ACADEMIC_FIRST = ['education', 'experiences', 'publications', 'awards', 'projects', 'certifications'];

function renderAcademic(view) {
  return `${head(view, { contact: 'inline' })}${section(view, 'summary')}${sections(view, reorder(view, ACADEMIC_FIRST))}`;
}

const base = { family: 'academic', category: 'Académique', ats: true, columns: 1, format: 'A4', longForm: true, educationFirst: true, render: renderAcademic };

export const templates = [
  {
    ...base,
    id: 'academique',
    name: 'Académique',
    photo: false,
    palettes: palettes('marine', 'bordeaux', 'foret', 'anthracite'),
    labels: { fr: { summary: 'Thématiques de recherche', education: 'Formation et diplômes' }, en: { summary: 'Research Interests' } },
    description: 'CV long de chercheur ou d\'enseignant : formation en tête, publications numérotées, distinctions. Plusieurs pages admises.',
  },
  {
    ...base,
    id: 'chercheur',
    name: 'Chercheur',
    photo: false,
    palettes: palettes('anthracite', 'bleu-nuit', 'prune', 'bronze'),
    description: 'Variante académique sobre (Garamond, en-tête centré) : candidatures doctorales, postdoctorales et bourses.',
  },
];
