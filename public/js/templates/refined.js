// Famille « Raffinés » : 12 modèles au design soigné, tous avec emplacement photo (facultative).
// Les modèles à une colonne restent compatibles ATS (texte réel, ordre de lecture = ordre visuel, titres standard) ;
// ceux à bandeau coloré ou à deux colonnes sont signalés « moins adaptés aux ATS », comme le reste du catalogue.

import { head, section, sections, photo, esc, fullName } from './parts.js';
import { sideContact } from './sidebar.js';
import { palettes } from './palettes.js';

const tags = (k) => (k === 'skills' || k === 'interests' ? 'tags' : 'default');

/** Une colonne : en-tête (photo, nom, titre, coordonnées), accroche, rubriques dans l'ordre choisi. */
function single(view) {
  return `${head(view, { contact: 'inline' })}${section(view, 'summary')}${sections(view, view.order)}`;
}

/** Bandeau coloré pleine largeur (nom, titre, coordonnées, photo), puis une colonne. */
function banner(view) {
  return `${head(view, { contact: 'inline', extraClass: 'cv-banner' })}${section(view, 'summary')}${sections(view, view.order, tags)}`;
}

const SIDE = ['skills', 'languages', 'certifications', 'interests'];

/**
 * Deux colonnes. nameInSide : nom et titre dans la colonne latérale (sinon en tête, pleine largeur).
 * L'ordre HTML suit l'ordre visuel (colonne de droite rendue après la principale).
 */
function columns(view, { nameInSide = false } = {}) {
  const side = view.order.filter((k) => SIDE.includes(k));
  const main = view.order.filter((k) => !SIDE.includes(k));
  const name = fullName(view);
  const sideHead = nameInSide
    ? `<div class="cv-head">${name ? `<h1 class="cv-name">${esc(name)}</h1>` : ''}${view.targetTitle ? `<p class="cv-title">${esc(view.targetTitle)}</p>` : ''}</div>`
    : '';
  const aside = `<aside class="cv-side">${photo(view)}${sideHead}${sideContact(view)}${sections(view, side, tags)}</aside>`;
  const mainCol = `<div class="cv-main">${section(view, 'summary')}${sections(view, main)}</div>`;
  const cols = view.template.sidePosition === 'right' ? mainCol + aside : aside + mainCol;
  return `${nameInSide ? '' : head(view, { contact: 'none', withPhoto: false })}<div class="cv-cols">${cols}</div>`;
}

/** Magazine : grand nom, photo portrait à droite de l'en-tête, colonne étroite à droite. */
function magazine(view) {
  const side = view.order.filter((k) => SIDE.includes(k));
  const main = view.order.filter((k) => !SIDE.includes(k));
  return `${head(view, { contact: 'inline' })}<div class="cv-cols"><div class="cv-main">${section(view, 'summary')}${sections(view, main)}</div><aside class="cv-side">${sections(view, side, tags)}</aside></div>`;
}

const base = { family: 'refined', category: 'Raffiné', photo: true, format: 'A4' };
const ats = { ...base, ats: true, columns: 1, render: single };

export const templates = [
  {
    ...ats,
    id: 'prestige',
    name: 'Prestige',
    palettes: palettes('bronze', 'marine', 'bordeaux', 'anthracite'),
    description: 'Garamond, nom en capitales espacées, photo centrée et filets or : direction, finance, droit, diplomatie. Compatible ATS.',
  },
  {
    ...ats,
    id: 'corporate',
    name: 'Corporate',
    palettes: palettes('marine', 'petrole', 'ardoise', 'bordeaux'),
    description: 'Filet de couleur en haut de page, photo à droite, titres sobres : banque, conseil, grandes entreprises. Compatible ATS.',
  },
  {
    ...ats,
    id: 'nordique',
    name: 'Nordique',
    palettes: palettes('anthracite', 'petrole', 'foret', 'indigo'),
    description: 'Titres de rubriques dans une marge à gauche, beaucoup d\'air, photo carrée discrète : design épuré scandinave. Compatible ATS.',
  },
  {
    ...ats,
    id: 'sante',
    name: 'Santé',
    palettes: palettes('emeraude', 'lagune', 'ocean', 'prune'),
    description: 'Titres sur bandes claires, lecture très nette, photo ronde : médecins, infirmiers, sages-femmes, pharmacie. Compatible ATS.',
  },
  {
    ...ats,
    id: 'atelier',
    name: 'Atelier',
    palettes: palettes('terracotta', 'indigo', 'emeraude', 'anthracite'),
    description: 'Bande verticale colorée en marge, titres Montserrat, photo arrondie : artisanat, métiers techniques, créatifs. Compatible ATS.',
  },
  {
    ...ats,
    id: 'goree',
    name: 'Gorée',
    layoutClass: 'dates-left',
    palettes: palettes('lagune', 'bordeaux', 'indigo', 'foret'),
    description: 'Parcours en frise : dates à gauche, points et fil de couleur, nom à empattements, photo ronde. Compatible ATS.',
  },
  {
    ...base,
    id: 'diplomate',
    name: 'Diplomate',
    ats: false,
    columns: 1,
    palettes: palettes('marine', 'bordeaux', 'foret', 'anthracite'),
    description: 'Bandeau bleu marine avec photo encadrée, titres à empattements : institutions, ONG, organisations internationales.',
    render: banner,
  },
  {
    ...base,
    id: 'sahel',
    name: 'Sahel',
    ats: false,
    columns: 1,
    palettes: palettes('terracotta', 'sable', 'bordeaux', 'prune'),
    description: 'Bandeau en dégradé terre cuite, photo cerclée de blanc, titres sur fond clair : commerce, tourisme, communication.',
    render: banner,
  },
  {
    ...base,
    id: 'baobab',
    name: 'Baobab',
    ats: false,
    columns: 2,
    sideStyle: 'light',
    palettes: palettes('sable', 'terracotta', 'foret', 'bordeaux'),
    description: 'Colonne sable avec motif discret, photo et nom en tête de colonne, accents or : profils polyvalents, entrepreneuriat.',
    render: (view) => columns(view, { nameInSide: true }),
  },
  {
    ...base,
    id: 'saint-louis',
    name: 'Saint-Louis',
    ats: false,
    columns: 2,
    sideStyle: 'light',
    sidePosition: 'right',
    palettes: palettes('lagune', 'ocean', 'prune', 'ardoise'),
    description: 'Colonne droite bleu pâle avec photo, petites capitales élégantes : enseignement, administration, relations clients.',
    render: (view) => columns(view),
  },
  {
    ...base,
    id: 'magazine',
    name: 'Magazine',
    ats: false,
    columns: 2,
    palettes: palettes('noir', 'bordeaux', 'marine', 'indigo'),
    description: 'Nom en très grand, photo portrait, filets épais et colonne étroite : journalisme, communication, mode.',
    render: magazine,
  },
  {
    ...base,
    id: 'ingenieur',
    name: 'Ingénieur',
    ats: false,
    columns: 2,
    sideStyle: 'dark',
    palettes: palettes('ardoise', 'indigo', 'petrole', 'anthracite'),
    description: 'Colonne sombre avec photo, compétences en étiquettes, titres techniques : informatique, télécoms, ingénierie.',
    render: (view) => columns(view, { nameInSide: true }),
  },
];
