// Famille « colonne de dates » : CV chronologique classique, dates dans une colonne étroite à gauche.
// Une seule colonne logique : dans le HTML, chaque élément garde l'ordre titre → dates → détails ;
// seule la mise en forme CSS (grille interne à l'élément) place les dates à gauche. Compatible ATS.

import { renderSingle } from './single.js';
import { palettes } from './palettes.js';

const base = { family: 'dates', layoutClass: 'dates-left', ats: true, columns: 1, format: 'A4', render: renderSingle };

export const templates = [
  {
    ...base,
    id: 'chronologique',
    name: 'Chronologique',
    category: 'ATS',
    photo: true,
    palettes: palettes('bleu-nuit', 'petrole', 'bordeaux', 'emeraude', 'anthracite'),
    description: 'Dates dans une colonne à gauche, parcours lisible d\'un coup d\'œil. Le CV chronologique classique.',
  },
  {
    ...base,
    id: 'registre',
    name: 'Registre',
    category: 'Classique',
    photo: true,
    palettes: palettes('anthracite', 'marine', 'bordeaux', 'foret'),
    description: 'Colonne de dates à gauche, typographie à empattements (Source Serif) : fonction publique, banque, droit.',
  },
];
