// Famille « colonne latérale » : modèles créatifs à deux colonnes (moins adaptés aux ATS).
// L'ordre HTML reste logique : en-tête (nom, titre), colonne latérale, puis colonne principale.

import { head, section, sections, sectionTitle, contactList, photo, esc, fullName } from './parts.js';
import { palettes } from './palettes.js';

const SIDE = ['skills', 'languages', 'certifications', 'interests'];

function split(view) {
  return {
    side: view.order.filter((k) => SIDE.includes(k)),
    main: view.order.filter((k) => !SIDE.includes(k)),
  };
}

/** Rubrique « Coordonnées » de la colonne latérale. */
export function sideContact(view) {
  const list = contactList(view);
  return list ? `<section class="cv-section cv-s-contact">${sectionTitle(view, 'contact')}${list}</section>` : '';
}

const tags = (k) => (k === 'skills' || k === 'interests' ? 'tags' : 'default');

/** Nom et titre en tête de page, sur toute la largeur ; photo et coordonnées dans la colonne. */
function renderTopName(view) {
  const { side, main } = split(view);
  const aside = `<aside class="cv-side">${photo(view)}${sideContact(view)}${sections(view, side, tags)}</aside>`;
  const mainCol = `<div class="cv-main">${section(view, 'summary')}${sections(view, main)}</div>`;
  // L'ordre HTML suit l'ordre visuel : colonne latérale à droite => rendue après la principale.
  const cols = view.template.sidePosition === 'right' ? mainCol + aside : aside + mainCol;
  return `${head(view, { contact: 'none', withPhoto: false })}<div class="cv-cols">${cols}</div>`;
}

/** Nom dans la colonne latérale (colonne pleine hauteur). */
function renderSideName(view) {
  const { side, main } = split(view);
  const name = fullName(view);
  return `<div class="cv-cols"><aside class="cv-side">${photo(view)}<div class="cv-head">${name ? `<h1 class="cv-name">${esc(name)}</h1>` : ''}${
    view.targetTitle ? `<p class="cv-title">${esc(view.targetTitle)}</p>` : ''
  }</div>${sideContact(view)}${sections(
    view,
    side,
    tags,
  )}</aside><div class="cv-main">${section(view, 'summary')}${sections(view, main)}</div></div>`;
}

const base = { family: 'sidebar', category: 'Créatif', ats: false, columns: 2, photo: true, format: 'A4' };

export const templates = [
  {
    ...base,
    id: 'dakar',
    name: 'Dakar',
    sideStyle: 'light',
    palettes: palettes('ocre', 'ocean', 'foret', 'prune', 'brique'),
    description: 'Colonne gauche ocre avec photo, compétences en pastilles. Chaleureux et moderne.',
    render: renderTopName,
  },
  {
    ...base,
    id: 'ocean',
    name: 'Océan',
    sideStyle: 'light',
    palettes: palettes('ocean', 'petrole', 'indigo', 'corail'),
    sidePosition: 'right',
    description: 'Colonne droite bleu océan, nom en tête : commerce, tourisme, relation client.',
    render: renderTopName,
  },
  {
    ...base,
    id: 'ardoise',
    name: 'Ardoise',
    sideStyle: 'dark',
    palettes: palettes('ardoise', 'bleu-nuit', 'bordeaux', 'emeraude', 'noir'),
    description: 'Colonne pleine hauteur gris ardoise, nom dans la colonne : profils techniques et numériques.',
    render: renderSideName,
  },
  {
    ...base,
    id: 'savane',
    name: 'Savane',
    sideStyle: 'dark',
    palettes: palettes('foret', 'ocre', 'petrole', 'prune'),
    description: 'Colonne vert savane pleine hauteur, typographie humaniste : ONG, agriculture, environnement.',
    render: renderSideName,
  },
  {
    ...base,
    id: 'casamance',
    name: 'Casamance',
    sideStyle: 'light',
    sidePosition: 'right',
    palettes: palettes('emeraude', 'ocre', 'indigo', 'bordeaux'),
    description: 'Colonne droite teintée émeraude, typographie Montserrat : tourisme, culture, événementiel, associatif.',
    render: renderTopName,
  },
];
