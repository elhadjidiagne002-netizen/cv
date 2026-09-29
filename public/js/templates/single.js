// Famille « une colonne » : modèles optimisés pour les logiciels de tri (ATS).
// Une seule colonne, ordre HTML = ordre visuel, aucun tableau, aucune icône porteuse d'information,
// titres de rubriques standard, polices système standard.

import { head, section, sections } from './parts.js';

function renderSingle(view) {
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
    description: 'Une colonne, police sans empattement, titres soulignés. Le choix le plus sûr pour les logiciels de tri.',
  },
  {
    ...base,
    id: 'classique',
    name: 'Classique',
    category: 'ATS',
    photo: true,
    description: 'Une colonne, police à empattements (Georgia), titres en petites capitales. Sobre et traditionnel.',
  },
  {
    ...base,
    id: 'moderne-ats',
    name: 'Moderne ATS',
    category: 'ATS',
    photo: false,
    description: 'Une colonne, bandeau d\'accent bleu pétrole sous les titres, dates alignées à droite.',
  },
  {
    ...base,
    id: 'compact',
    name: 'Compact',
    category: 'ATS',
    photo: false,
    description: 'Une colonne dense, marges réduites : idéal pour tenir sur une page avec un parcours riche.',
  },
  {
    ...base,
    id: 'executif',
    name: 'Exécutif',
    category: 'ATS',
    photo: true,
    description: 'Une colonne, nom en grand, filets bordeaux : pour cadres et profils expérimentés (2 pages).',
  },
  {
    ...base,
    id: 'elegant',
    name: 'Élégant',
    category: 'Classique',
    photo: true,
    description: 'Une colonne centrée, typographie Palatino, filets fins : administration, juridique, enseignement.',
  },
];
