// Famille « fonctionnelle » : CV par compétences, pour une reconversion ou un parcours discontinu.
// Les compétences passent avant le parcours. Une colonne, titres standard : compatible ATS.

import { head, section, sections, reorder, sectionTitle, sectionBody, hasContent } from './parts.js';
import { palettes } from './palettes.js';

/** Parcours condensé (poste, employeur, dates) : les réalisations sont regroupées par compétence. */
function renderFunctional(view) {
  const rest = reorder(view, ['skills', 'experiences']).filter((k) => k !== 'skills' && k !== 'experiences');
  const exp = hasContent(view, 'experiences')
    ? `<section class="cv-section cv-s-experiences" data-section="experiences">${sectionTitle(view, 'experiences')}${sectionBody(view, 'experiences', 'compact')}</section>`
    : '';
  return `${head(view, { contact: 'inline' })}${section(view, 'summary')}${section(view, 'skills', 'groups')}${exp}${sections(view, rest)}`;
}

/** Hybride : compétences d'abord, puis expériences détaillées (réalisations conservées). */
function renderHybrid(view) {
  return `${head(view, { contact: 'inline' })}${section(view, 'summary')}${sections(view, reorder(view, ['skills', 'experiences']), (k) => (k === 'skills' ? 'groups' : 'default'))}`;
}

const base = { family: 'functional', category: 'Reconversion', ats: true, columns: 1, format: 'A4' };
const labels = { fr: { skills: 'Compétences clés' }, en: { skills: 'Key Skills' } };

export const templates = [
  {
    ...base,
    id: 'fonctionnel',
    name: 'Fonctionnel',
    photo: true,
    labels,
    palettes: palettes('emeraude', 'bleu-nuit', 'prune', 'ocre'),
    description: 'CV par compétences : savoir-faire en tête, parcours condensé ensuite. Pour une reconversion ou des périodes d\'inactivité.',
    render: renderFunctional,
  },
  {
    ...base,
    id: 'reconversion',
    name: 'Reconversion',
    photo: true,
    labels,
    palettes: palettes('indigo', 'petrole', 'corail', 'foret', 'anthracite'),
    description: 'CV hybride : compétences transférables d\'abord, puis expériences détaillées. Idéal pour changer de métier.',
    render: renderHybrid,
  },
];
