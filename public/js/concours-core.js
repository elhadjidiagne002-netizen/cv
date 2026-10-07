// Préparation aux concours (fonction publique, Sénégal) : familles de concours, pièces du dossier, calendrier
// personnel (rappels .ics), lettre de demande de candidature. Module pur (testé).
// Contenu INDICATIF : conditions, limites d'âge, pièces et dates changent à chaque session — l'avis officiel fait foi.
import { DOSSIER_ITEMS } from './senegal.js';

export const STORE_KEY = 'cv-concours-v1';

/** Familles de concours. `extra` = pièces souvent ajoutées ; `epreuves` = types d'épreuves habituels (à vérifier). */
export const FAMILIES = {
  ena: { label: 'ENA (administration, diplomatie, finances, justice…)', authority: 'Monsieur le Directeur de l’École nationale d’administration',
    epreuves: ['Composition de culture générale', 'Épreuves de spécialité selon la section', 'Note de synthèse', 'Oral devant un jury'], extra: [] },
  police: { label: 'Police nationale', authority: 'Monsieur le Directeur de l’École nationale de Police',
    epreuves: ['Culture générale et français', 'Tests psychotechniques', 'Épreuves sportives', 'Visite médicale d’aptitude', 'Entretien'], extra: ['Certificat d’aptitude physique', 'Mensurations (taille), si l’avis le demande'] },
  douane: { label: 'Douanes', authority: 'Monsieur le Directeur général des Douanes',
    epreuves: ['Culture générale', 'Mathématiques ou économie selon le grade', 'Épreuves sportives', 'Visite médicale', 'Oral'], extra: ['Certificat d’aptitude physique'] },
  enseignement: { label: 'Enseignement (instituteurs, professeurs)', authority: 'Monsieur le Ministre de l’Éducation nationale',
    epreuves: ['Dissertation ou culture générale', 'Épreuve de la discipline', 'Psychopédagogie (selon le concours)', 'Oral ou leçon'], extra: [] },
  gendarmerie: { label: 'Gendarmerie / Armées', authority: 'Monsieur le Haut Commandant de la Gendarmerie nationale',
    epreuves: ['Culture générale', 'Tests psychotechniques', 'Épreuves sportives', 'Visite médicale', 'Entretien'], extra: ['Certificat d’aptitude physique'] },
  sante: { label: 'Santé (infirmiers, sages-femmes, techniciens)', authority: 'Monsieur le Directeur de l’École nationale de développement sanitaire et social',
    epreuves: ['Culture générale', 'Sciences (biologie, chimie selon le concours)', 'Oral'], extra: [] },
  autre: { label: 'Autre concours ou recrutement', authority: 'Monsieur le Directeur', epreuves: ['Selon l’avis de concours'], extra: [] },
};

export const CHECKLIST = DOSSIER_ITEMS;

/** Jours restants avant une date AAAA-MM-JJ (0 = aujourd'hui ; négatif = passée). */
export function daysLeft(day, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return null;
  const [y, m, d] = day.split('-').map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

export function countdownText(n) {
  if (n === null) return '';
  if (n < 0) return 'passé';
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'demain';
  return `dans ${n} jours`;
}

/** Prochaine échéance d'un concours (dépôt du dossier, puis épreuves). */
export function nextDeadline(c, now = new Date()) {
  const items = [['Dépôt du dossier', c.deadline], ['Épreuves', c.exam]].map(([label, day]) => ({ label, day, n: daysLeft(day, now) })).filter((x) => x.n !== null && x.n >= 0);
  return items.sort((a, b) => a.n - b.n)[0] || null;
}

const icsDate = (day) => day.replace(/-/g, '');
const icsText = (s) => String(s || '').replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

/** Fichier agenda (.ics) : dépôt et épreuves en journée entière, rappel 3 jours avant. */
export function icsFor(c, stamp = new Date()) {
  const dt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = [['Dépôt du dossier', c.deadline], ['Épreuves', c.exam]].filter(([, d]) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')));
  const next = (day) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, ''); };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CV en ligne//Concours//FR', 'CALSCALE:GREGORIAN',
    ...events.flatMap(([label, day], i) => ['BEGIN:VEVENT', `UID:${icsText(c.id)}-${i}@cv.nexusmarket.sn`, `DTSTAMP:${dt}`, `DTSTART;VALUE=DATE:${icsDate(day)}`, `DTEND;VALUE=DATE:${next(day)}`,
      `SUMMARY:${icsText(`${label} — ${c.title}`)}`, c.place ? `LOCATION:${icsText(c.place)}` : null, `DESCRIPTION:${icsText('Vérifiez l’avis officiel du concours.')}`,
      'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`${label} dans 3 jours`)}`, 'END:VALARM', 'END:VEVENT'].filter(Boolean)),
    'END:VCALENDAR'].join('\r\n');
}

/** « Monsieur le Directeur général des Douanes » → « Monsieur le Directeur général » (formule d'appel). */
export function salutation(authority) {
  const a = String(authority || 'Monsieur le Directeur').trim();
  const cut = a.search(/\s(?:de|des|du)\s|\sd[’']/);
  return (cut > 0 ? a.slice(0, cut) : a).replace(/^À\s+/, '');
}

/** Lettre de demande de candidature (registre administratif sénégalais). identity = identité du CV. */
export function letterText(c, identity = {}, { city = '', date = new Date() } = {}) {
  const fam = FAMILIES[c.family] || FAMILIES.autre;
  // « Concours d’entrée… » → « au concours d’entrée… » au milieu de la phrase.
  const titre = (c.title || 'concours [intitulé exact]').replace(/^(Concours|Examen|Recrutement)\b/, (m) => m.toLowerCase());
  const name = [identity.firstName, identity.lastName].filter(Boolean).join(' ') || '[Prénom et nom]';
  const pieces = CHECKLIST.filter((d) => (c.done || []).includes(d.id) && d.id !== 'demande').map((d) => `- ${d.label.replace(/ \(.*\)$/, '')}`);
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    name,
    identity.address || '[Adresse]',
    [identity.phone, identity.email].filter(Boolean).join(' — ') || '[Téléphone — e-mail]',
    '',
    `${city || identity.city || '[Ville]'}, le ${day}`,
    '',
    `À ${c.authority || fam.authority}`,
    c.organisme ? c.organisme : '',
    '',
    `Objet : demande de candidature au ${titre}`,
    pieces.length ? `Pièces jointes : voir liste ci-dessous` : '',
    '',
    `${salutation(c.authority || fam.authority)},`,
    '',
    `J’ai l’honneur de solliciter auprès de votre haute bienveillance mon inscription au ${titre}${c.session ? `, session ${c.session}` : ''}.`,
    '',
    'Titulaire du [diplôme exigé par l’avis], je remplis les conditions fixées par l’avis de concours et souhaite mettre mes compétences au service de l’administration.',
    '',
    pieces.length ? 'Vous trouverez ci-joint les pièces constitutives de mon dossier :' : '',
    ...pieces,
    pieces.length ? '' : '',
    'Dans l’attente d’une suite favorable, je vous prie d’agréer, ' + `${salutation(c.authority || fam.authority)}, l’expression de ma très haute considération.`,
    '',
    '',
    name,
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}

export function cleanConcours(c = {}) {
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');
  const t = (v, n) => String(v ?? '').trim().slice(0, n);
  return { id: t(c.id, 40) || `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, family: FAMILIES[c.family] ? c.family : 'autre',
    title: t(c.title, 160), organisme: t(c.organisme, 160), authority: t(c.authority, 200), session: t(c.session, 40), deadline: day(c.deadline), exam: day(c.exam),
    place: t(c.place, 160), notes: t(c.notes, 1500), done: (Array.isArray(c.done) ? c.done : []).filter((id) => CHECKLIST.some((d) => d.id === id) || /^x-/.test(id)).slice(0, 40),
    epreuves: (Array.isArray(c.epreuves) ? c.epreuves : []).filter((x) => typeof x === 'string').slice(0, 20) };
}
