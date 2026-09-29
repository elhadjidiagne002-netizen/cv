// Famille « étudiant / premier emploi » : formation et projets avant l'expérience (stages, jobs).
// Une colonne, titres standard : compatible ATS. Une page.

import { head, section, sections, reorder } from './parts.js';
import { palettes } from './palettes.js';

const STUDENT_FIRST = ['education', 'projects', 'experiences', 'skills', 'languages', 'volunteering'];

function renderStudent(view) {
  return `${head(view, { contact: 'inline' })}${section(view, 'summary')}${sections(view, reorder(view, STUDENT_FIRST))}`;
}

function renderFirstJob(view) {
  return `${head(view, { contact: 'inline', extraClass: 'cv-head-soft' })}${section(view, 'summary')}${sections(view, reorder(view, STUDENT_FIRST), (k) => (k === 'interests' ? 'tags' : 'default'))}`;
}

const base = { family: 'student', category: 'Étudiant', ats: true, columns: 1, format: 'A4', educationFirst: true };

export const templates = [
  {
    ...base,
    id: 'etudiant',
    name: 'Étudiant',
    photo: false,
    palettes: palettes('ocean', 'emeraude', 'indigo', 'corail'),
    description: 'Formation et projets en tête, puis stages et jobs : pour un stage, une alternance ou un premier poste.',
    render: renderStudent,
  },
  {
    ...base,
    id: 'premier-emploi',
    name: 'Premier emploi',
    photo: true,
    palettes: palettes('indigo', 'ocean', 'foret', 'prune', 'brique'),
    description: 'En-tête teinté, formation d\'abord, centres d\'intérêt en pastilles : jeunes diplômés et volontariat.',
    render: renderFirstJob,
  },
];
