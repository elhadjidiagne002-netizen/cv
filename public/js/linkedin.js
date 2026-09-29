// Import du profil LinkedIn à partir de l'archive officielle « Obtenir une copie de vos données »
// (Paramètres → Confidentialité des données). Tout est lu sur l'appareil : rien n'est envoyé.
// Fichiers reconnus : Profile.csv, Positions.csv, Education.csv, Skills.csv, Languages.csv, Certifications.csv,
// Email Addresses.csv, PhoneNumbers.csv, Projects.csv, Honors.csv, Volunteering.csv (noms FR ou EN des colonnes).

import { createEmptyCV, createItem, normalizeCV } from './model.js';
import { looksFrench } from './norms.js';
import { formatSenegalPhone, parseSenegalPhone } from './senegal.js';

/** Analyse CSV (RFC 4180 : guillemets, guillemets doublés, retours à la ligne dans les champs). */
export function parseCSV(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/**
 * Lignes d'un CSV sous forme d'objets. `expect` : noms de colonnes attendus ; la ligne d'en-tête est cherchée
 * (LinkedIn place parfois des notes avant). Les clés sont normalisées (minuscules, sans accents ni espaces).
 */
export function csvObjects(text, expect = []) {
  const rows = parseCSV(text);
  const norm = (h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  let h = 0;
  if (expect.length) {
    const found = rows.findIndex((r) => expect.some((e) => r.map(norm).includes(norm(e))));
    if (found >= 0) h = found;
  }
  if (!rows[h]) return [];
  const header = rows[h].map(norm);
  return rows.slice(h + 1).map((r) => Object.fromEntries(header.map((k, i) => [k, (r[i] || '').trim()])));
}

const MONTHS = {
  jan: 1, janv: 1, janvier: 1, january: 1, feb: 2, fev: 2, fevr: 2, fevrier: 2, february: 2, mar: 3, mars: 3, march: 3,
  apr: 4, avr: 4, avril: 4, april: 4, may: 5, mai: 5, jun: 6, juin: 6, june: 6, jul: 7, juil: 7, juillet: 7, july: 7,
  aug: 8, aou: 8, aout: 8, august: 8, sep: 9, sept: 9, septembre: 9, september: 9, oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12,
};

/** « Mar 2022 », « mars 2022 », « 2022-03 », « 03/2022 », « 2022 » → « 2022-03 » (ou « 2022 »). */
export function linkedInDate(value) {
  const s = String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '');
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^([a-z]+)\s+(\d{4})$/);
  if (m && MONTHS[m[1]]) return `${m[2]}-${String(MONTHS[m[1]]).padStart(2, '0')}`;
  m = s.match(/(\d{4})/);
  return m ? m[1] : '';
}

/** Niveaux de langue LinkedIn → CECRL (approximation documentée, à vérifier par l'utilisateur). */
export function levelFromLinkedIn(proficiency) {
  const s = String(proficiency || '').toLowerCase();
  if (/native|bilingu|maternelle/.test(s)) return 'native';
  if (/full professional|professionnelle compl/.test(s)) return 'C1';
  if (/professional working|professionnelle/.test(s)) return 'B2';
  if (/limited working|limit/.test(s)) return 'B1';
  if (/elementary|notions|élémentaire|elementaire/.test(s)) return 'A2';
  return '';
}

const pick = (o, ...keys) => {
  for (const k of keys) if (o[k]) return o[k];
  return '';
};

/** Fichier de l'archive par nom (sans tenir compte du dossier ni de la casse). */
function file(files, ...names) {
  const wanted = names.map((n) => n.toLowerCase());
  const key = Object.keys(files).find((k) => wanted.includes(k.split('/').pop().toLowerCase()));
  return key ? files[key] : '';
}

/**
 * Convertit les fichiers CSV de l'export LinkedIn ({ 'Positions.csv': texte, … }) en CV.
 * Renvoie { cv, found: [noms des fichiers exploités], notes: [points à vérifier] }.
 */
export function fromLinkedIn(files) {
  const found = [];
  const notes = [];
  const read = (names, expect) => {
    const text = file(files, ...names);
    if (!text) return [];
    found.push(names[0]);
    return csvObjects(text, expect);
  };
  const profile = read(['Profile.csv', 'Profil.csv'], ['First Name', 'Prénom'])[0] || {};
  const emails = read(['Email Addresses.csv'], ['Email Address']);
  const phones = read(['PhoneNumbers.csv', 'Phone Numbers.csv'], ['Number']);
  const primary = emails.find((e) => /yes|oui/i.test(e.primary)) || emails[0];
  const rawPhone = phones[0] ? pick(phones[0], 'number', 'numero') : '';
  const phone = parseSenegalPhone(rawPhone) && !parseSenegalPhone(rawPhone).invalid ? formatSenegalPhone(rawPhone) : rawPhone;
  const geo = pick(profile, 'geolocation', 'localisation', 'location');
  const [city, ...country] = geo.split(',').map((x) => x.trim());
  const cv = createEmptyCV({
    meta: { title: `${[pick(profile, 'firstname', 'prenom'), pick(profile, 'lastname', 'nom')].filter(Boolean).join(' ') || 'Profil'} (LinkedIn)` },
    identity: {
      firstName: pick(profile, 'firstname', 'prenom'),
      lastName: pick(profile, 'lastname', 'nom'),
      email: primary ? pick(primary, 'emailaddress', 'adresseemail') : '',
      phone,
      city: city || '',
      country: country.join(', ').replace(/^S[ée]n[ée]gal$/i, 'Sénégal'),
      website: (pick(profile, 'websites', 'sitesweb').match(/https?:\/\/[^\s,\]]+/) || [''])[0],
    },
    targetTitle: pick(profile, 'headline', 'titre'),
    summary: pick(profile, 'summary', 'resume'),
  });
  const period = (o) => {
    const start = linkedInDate(pick(o, 'startedon', 'startdate', 'debut', 'datededebut'));
    const end = linkedInDate(pick(o, 'finishedon', 'enddate', 'fin', 'datedefin'));
    return { start, end, current: Boolean(start) && !end };
  };
  cv.experiences = read(['Positions.csv', 'Postes.csv'], ['Company Name', 'Title']).map((p) => createItem('experiences', {
    position: pick(p, 'title', 'titre', 'poste'), employer: pick(p, 'companyname', 'entreprise'), city: pick(p, 'location', 'lieu'),
    ...period(p), description: pick(p, 'description'),
  }));
  cv.education = read(['Education.csv', 'Formation.csv'], ['School Name']).map((e) => createItem('education', {
    degree: pick(e, 'degreename', 'diplome') || pick(e, 'fieldofstudy'), school: pick(e, 'schoolname', 'etablissement'), ...period(e),
    description: [pick(e, 'notes'), pick(e, 'activities', 'activites')].filter(Boolean).join('\n'),
  }));
  const skills = read(['Skills.csv', 'Competences.csv'], ['Name']).map((s) => pick(s, 'name', 'nom')).filter(Boolean);
  if (skills.length) cv.skills = [createItem('skills', { name: 'Compétences', keywords: skills.slice(0, 25) })];
  if (skills.length > 25) notes.push(`${skills.length} compétences LinkedIn : seules les 25 premières ont été reprises (gardez celles de l'offre).`);
  cv.languages = read(['Languages.csv', 'Langues.csv'], ['Name']).map((l) => createItem('languages', {
    name: pick(l, 'name', 'nom'), level: levelFromLinkedIn(pick(l, 'proficiency', 'niveau')),
  }));
  if (cv.languages.length) notes.push('Niveaux de langue LinkedIn convertis en CECRL de façon approximative : vérifiez-les.');
  cv.certifications = read(['Certifications.csv'], ['Name', 'Authority']).map((c) => createItem('certifications', {
    name: pick(c, 'name', 'nom'), issuer: pick(c, 'authority', 'organisme'), date: linkedInDate(pick(c, 'startedon', 'finishedon')),
  }));
  cv.projects = read(['Projects.csv', 'Projets.csv'], ['Title']).map((p) => createItem('projects', {
    name: pick(p, 'title', 'titre'), description: pick(p, 'description'), url: pick(p, 'url'), date: linkedInDate(pick(p, 'startedon')),
  }));
  cv.awards = read(['Honors.csv', 'Distinctions.csv'], ['Title']).map((h) => createItem('awards', {
    name: pick(h, 'title', 'titre'), description: pick(h, 'description'), date: linkedInDate(pick(h, 'issuedon')),
  }));
  cv.volunteering = read(['Volunteering.csv', 'Benevolat.csv'], ['Role', 'Company Name']).map((v) => createItem('volunteering', {
    role: pick(v, 'role'), organization: pick(v, 'companyname', 'organisation'), ...period(v), description: pick(v, 'description'),
  }));
  if (cv.experiences.some((e) => e.description && !e.description.includes('\n') && e.description.length > 200)) {
    notes.push('Descriptions LinkedIn en paragraphe : découpez-les en lignes courtes commençant par un verbe d\'action.');
  }
  const sample = [cv.summary, ...cv.experiences.map((e) => e.description)].join(' ');
  if (sample.split(/\s+/).length >= 6 && !looksFrench(sample)) cv.meta.lang = 'en';
  return { cv: normalizeCV(cv), found, notes };
}
