// Registre de tous les modèles. Chaque modèle déclare ses métadonnées :
// id, name, category, ats (lisible par les logiciels de tri), columns, photo (photo possible),
// format (A4 | Letter), et éventuellement lang (langue imposée), labels, excludeSections…

import { templates as single } from './single.js';
import { templates as europass } from './europass.js';
import { templates as international } from './international.js';
import { templates as sidebar } from './sidebar.js';
import { templates as banner } from './banner.js';
import { templates as dates } from './dates.js';
import { templates as academic } from './academic.js';
import { templates as functional } from './functional.js';
import { templates as student } from './student.js';
import { templates as trades } from './trades.js';
import { templates as national } from './national.js';
import { templates as refined } from './refined.js';

export const TEMPLATES = [
  ...single, ...dates, ...europass, ...international, ...national, ...academic, ...functional, ...student, ...trades, ...refined, ...sidebar, ...banner,
];

export const DEFAULT_TEMPLATE_ID = 'sobre';

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);
}

/** Métadonnées publiques (sans la fonction de rendu), pour la galerie et les tests. */
export function templateMeta(t) {
  const { render, ...meta } = t;
  return meta;
}
