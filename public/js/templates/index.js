// Registre de tous les modèles. Chaque modèle déclare ses métadonnées :
// id, name, category, ats (lisible par les logiciels de tri), columns, photo (photo possible),
// format (A4 | Letter), et éventuellement lang (langue imposée), labels, excludeSections…

import { templates as single } from './single.js';
import { templates as europass } from './europass.js';
import { templates as international } from './international.js';
import { templates as sidebar } from './sidebar.js';
import { templates as banner } from './banner.js';

export const TEMPLATES = [...single, ...europass, ...international, ...sidebar, ...banner];

export const DEFAULT_TEMPLATE_ID = 'sobre';

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);
}

/** Métadonnées publiques (sans la fonction de rendu), pour la galerie et les tests. */
export function templateMeta(t) {
  const { render, ...meta } = t;
  return meta;
}
