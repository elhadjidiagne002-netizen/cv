// Famille « une colonne » : modèles optimisés pour les logiciels de tri (ATS).
// Une seule colonne, ordre HTML = ordre visuel, aucun tableau, aucune icône porteuse d'information,
// titres de rubriques standard, polices standard (libres, embarquées dans public/fonts/).

import { head, section, sections } from './parts.js';
import { palettes } from './palettes.js';

export function renderSingle(view) {
  return `${head(view, { contact: 'inline' })}${section(view, 'summary')}${sections(view, view.order)}`;
}

const base = { family: 'single', ats: true, columns: 1, format: 'A4', render: renderSingle };

export const templates = [
  {
    ...base,
    id: 'sobre',
    name: 'Sobre',
    category: 'ATS',
    photo: false,
    palettes: palettes('bleu-nuit', 'petrole', 'bordeaux', 'foret', 'anthracite'),
    description: 'Une colonne, police sans empattement (Inter), titres soulignés. Le choix le plus sûr pour les logiciels de tri.',
  },
  {
    ...base,
    id: 'classique',
    name: 'Classique',
    category: 'ATS',
    photo: true,
    palettes: palettes('anthracite', 'bleu-nuit', 'bordeaux', 'marine'),
    description: 'Une colonne, police à empattements (Source Serif), titres en petites capitales. Sobre et traditionnel.',
  },
  {
    ...base,
    id: 'moderne-ats',
    name: 'Moderne ATS',
    category: 'ATS',
    photo: false,
    palettes: palettes('petrole', 'ocean', 'prune', 'foret', 'brique'),
    description: 'Une colonne, bandeau d\'accent bleu pétrole sous les titres, dates alignées à droite.',
  },
  {
    ...base,
    id: 'compact',
    name: 'Compact',
    category: 'ATS',
    photo: false,
    palettes: palettes('ardoise', 'bleu-nuit', 'emeraude', 'bordeaux'),
    description: 'Une colonne dense, marges réduites : idéal pour tenir sur une page avec un parcours riche.',
  },
  {
    ...base,
    id: 'executif',
    name: 'Exécutif',
    category: 'ATS',
    photo: true,
    palettes: palettes('bordeaux', 'marine', 'anthracite', 'foret'),
    description: 'Une colonne, nom en grand, filets bordeaux (Merriweather) : pour cadres et profils expérimentés (2 pages).',
  },
  {
    ...base,
    id: 'elegant',
    name: 'Élégant',
    category: 'Classique',
    photo: true,
    palettes: palettes('prune', 'bleu-nuit', 'bronze', 'anthracite'),
    description: 'Une colonne centrée, typographie Garamond, filets fins : administration, juridique, enseignement.',
  },
  {
    ...base,
    id: 'teranga',
    name: 'Teranga',
    category: 'ATS',
    photo: true,
    palettes: palettes('emeraude', 'ocre', 'bleu-nuit', 'prune', 'anthracite'),
    description: 'Une colonne chaleureuse (Lato), titres avec pastille de couleur : services, commerce, santé.',
  },
];
