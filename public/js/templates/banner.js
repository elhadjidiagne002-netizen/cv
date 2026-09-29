// Famille « bandeau » : en-tête coloré pleine largeur, puis une colonne (frise) ou deux colonnes.
// Modèles visuels, moins adaptés aux ATS (texte sur fond coloré, mise en page décorative).

import { head, section, sections } from './parts.js';
import { sideContact } from './sidebar.js';
import { palettes } from './palettes.js';

function renderTimeline(view) {
  return `${head(view, { contact: 'inline', extraClass: 'cv-banner' })}${section(view, 'summary')}${sections(view, view.order, (k) =>
    k === 'skills' || k === 'interests' ? 'tags' : 'default',
  )}`;
}

const SIDE = ['skills', 'languages', 'interests', 'references'];

function renderHorizon(view) {
  const side = view.order.filter((k) => SIDE.includes(k));
  const main = view.order.filter((k) => !SIDE.includes(k));
  return `${head(view, { contact: 'none', extraClass: 'cv-banner' })}<div class="cv-cols"><div class="cv-main">${section(view, 'summary')}${sections(
    view,
    main,
  )}</div><aside class="cv-side">${sideContact(view)}${sections(view, side, (k) => (k === 'skills' || k === 'interests' ? 'tags' : 'default'))}</aside></div>`;
}

/** Infographie modérée : bandeau, deux colonnes, jauges de langue décoratives (niveau CECRL toujours écrit). */
function renderInfographic(view) {
  const side = view.order.filter((k) => SIDE.includes(k));
  const main = view.order.filter((k) => !SIDE.includes(k));
  const variant = (k) => (k === 'languages' ? 'bars' : k === 'skills' || k === 'interests' ? 'tags' : 'default');
  return `${head(view, { contact: 'none', extraClass: 'cv-banner' })}<div class="cv-cols"><aside class="cv-side">${sideContact(view)}${sections(view, side, variant)}</aside><div class="cv-main">${section(
    view,
    'summary',
  )}${sections(view, main)}</div></div>`;
}

const base = { family: 'banner', category: 'Moderne', ats: false, photo: true, format: 'A4' };

export const templates = [
  {
    ...base,
    id: 'frise',
    name: 'Frise',
    palettes: palettes('indigo', 'petrole', 'bordeaux', 'emeraude', 'ardoise'),
    columns: 1,
    description: 'Bandeau indigo, parcours présenté en frise chronologique verticale. Lisible et dynamique.',
    render: renderTimeline,
  },
  {
    ...base,
    id: 'horizon',
    name: 'Horizon',
    sideStyle: 'light',
    palettes: palettes('corail', 'ocean', 'foret', 'prune'),
    columns: 2,
    description: 'Bandeau corail pleine largeur, colonne droite pour compétences et langues : communication, vente.',
    render: renderHorizon,
  },
  {
    ...base,
    id: 'minimal',
    name: 'Minimal',
    palettes: palettes('noir', 'bleu-nuit', 'bordeaux'),
    category: 'Moderne',
    columns: 1,
    description: 'Beaucoup d\'espace blanc, nom en très grand, accents noirs et une touche d\'or : design, architecture.',
    render: renderTimeline,
  },
  {
    ...base,
    id: 'infographie',
    name: 'Infographie',
    columns: 2,
    sideStyle: 'light',
    palettes: palettes('petrole', 'indigo', 'corail', 'foret', 'ardoise'),
    description: 'Bandeau, colonne gauche avec jauges de langues (le niveau CECRL reste écrit) : communication, marketing, design.',
    render: renderInfographic,
  },
];
