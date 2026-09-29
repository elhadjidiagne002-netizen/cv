// Famille « métiers techniques et manuels » : BTP, électricité, mécanique, logistique, chauffeurs,
// hôtellerie… Savoir-faire, habilitations et permis en tête, texte plus grand. Une colonne, compatible ATS.

import { head, section, sections, reorder } from './parts.js';
import { palettes } from './palettes.js';

const TRADES_FIRST = ['skills', 'certifications', 'experiences', 'education', 'languages'];

function renderTrades(view) {
  return `${head(view, { contact: 'inline' })}${section(view, 'summary')}${sections(view, reorder(view, TRADES_FIRST))}`;
}

const base = { family: 'trades', category: 'Métiers', ats: true, columns: 1, format: 'A4', render: renderTrades };

export const templates = [
  {
    ...base,
    id: 'metiers',
    name: 'Métiers',
    photo: true,
    palettes: palettes('ocre', 'bleu-nuit', 'foret', 'brique', 'anthracite'),
    description: 'Savoir-faire, habilitations et permis en premier, gros caractères : artisans, BTP, chauffeurs, restauration.',
  },
  {
    ...base,
    id: 'technicien',
    name: 'Technicien',
    photo: true,
    palettes: palettes('petrole', 'ardoise', 'ocean', 'emeraude'),
    description: 'Compétences techniques et certifications d\'abord, titres à barre latérale : maintenance, électricité, réseaux.',
  },
];
