// Formats nationaux : Canada / Québec (sans photo ni données personnelles, papier Letter) et
// Allemagne (Lebenslauf : tableau chronologique, photo d'usage mais facultative, lieu, date et nom en fin).

import { head, section, sections, personalSection, esc, fullName } from './parts.js';
import { t } from '../i18n.js';
import { palettes } from './palettes.js';

function renderCanada(view) {
  return `${head(view, { contact: 'inline', withPhoto: false })}${section(view, 'summary')}${sections(view, view.order)}`;
}

/** Ligne finale du Lebenslauf : « Fait à Dakar, le 29/09/2026 » suivie du nom (tient lieu de signature). */
function placeDate(view) {
  if (view.anonymous) return '';
  const city = view.identity.city;
  const d = view.today;
  const date = view.lang === 'en'
    ? `${d.getDate()} ${t('en', 'months')[d.getMonth()]} ${d.getFullYear()}`
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const line = city ? t(view.lang, 'placeDate').replace('{city}', city).replace('{date}', date) : date;
  const name = fullName(view);
  return `<p class="cv-place-date">${esc(line)}${name ? `<span class="cv-signature">${esc(name)}</span>` : ''}</p>`;
}

function renderLebenslauf(view) {
  return `${head(view, { contact: 'list', withPersonal: false })}${personalSection(view)}${section(view, 'summary')}${sections(view, view.order)}${placeDate(view)}`;
}

const canada = { family: 'national', category: 'Canada', ats: true, columns: 1, photo: false, format: 'Letter', forceFormat: true, noPersonal: true, render: renderCanada };
const germany = { family: 'national', category: 'Allemagne', ats: true, columns: 1, photo: true, format: 'A4', layoutClass: 'dates-left', render: renderLebenslauf };

export const templates = [
  {
    ...canada,
    id: 'quebec',
    name: 'Québec',
    palettes: palettes('marine', 'petrole', 'bordeaux', 'anthracite'),
    description: 'Format québécois en français : papier Letter, sans photo, âge, nationalité ni situation familiale (Charte des droits).',
  },
  {
    ...canada,
    id: 'canada-en',
    name: 'Canada (anglais)',
    lang: 'en',
    dateStyle: 'long',
    palettes: palettes('brique', 'marine', 'anthracite', 'foret'),
    labels: { en: { summary: 'Professional Profile', experiences: 'Work Experience' } },
    description: 'Résumé canadien anglophone : Letter, en anglais, sans photo ni données personnelles, 2 pages maximum.',
  },
  {
    ...germany,
    id: 'lebenslauf',
    name: 'Lebenslauf',
    palettes: palettes('anthracite', 'marine', 'petrole', 'bordeaux'),
    description: 'Format allemand : tableau chronologique (dates à gauche), photo à droite (facultative), lieu, date et nom en fin de CV.',
  },
  {
    ...germany,
    id: 'lebenslauf-moderne',
    name: 'Lebenslauf moderne',
    palettes: palettes('petrole', 'indigo', 'foret', 'brique', 'anthracite'),
    description: 'Lebenslauf actualisé : filet de couleur, dates à gauche, informations personnelles regroupées.',
  },
];
