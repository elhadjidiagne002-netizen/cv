// Cycle 5 : import LinkedIn (CSV, archive ZIP compressée), suivi des candidatures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseCSV, csvObjects, linkedInDate, levelFromLinkedIn, fromLinkedIn } from '../public/js/linkedin.js';
import { readZipAsync, crc32 } from '../public/js/zip.js';
import {
  createApplication, normalizeApplication, setStatus, dueFollowUps, sortApplications, stats, toCSV, addDays, createApplicationStore, STATUSES,
} from '../public/js/applications.js';
import { createMemoryStorage } from '../public/js/storage.js';
import { checkCV } from '../public/js/norms.js';

const TODAY = new Date(2026, 8, 29, 12);

/** Archive ZIP compressée (méthode 8), comme celle que produit LinkedIn. */
function deflateZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [n, text] of Object.entries(files)) {
    const name = enc.encode(n);
    const data = enc.encode(text);
    const comp = deflateRawSync(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc32(data), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    parts.push(h, name, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc32(data), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + comp.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, ...central, end]));
}

const LINKEDIN = {
  'Profile.csv': 'First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers\n'
    + 'Awa,Ndiaye,,,,Chargée de marketing digital,"Marketing digital, 6 ans d\'expérience dans la distribution et les services au Sénégal.",Marketing,,"Dakar, Sénégal",,[PORTFOLIO:https://awa.example.com],\n',
  'Positions.csv': 'Company Name,Title,Description,Location,Started On,Finished On\n'
    + 'Teranga Distribution,Chargée de marketing digital,"Piloter les campagnes Meta\nAugmenter les ventes en ligne de 38 %","Dakar, Sénégal",Mar 2022,\n'
    + 'Baobab Mobile Services,Assistante marketing,,Dakar,sept. 2019,févr. 2022\n',
  'Education.csv': 'School Name,Start Date,End Date,Notes,Degree Name,Activities\nInstitut Supérieur de Management,2017,2019,,Master Marketing,Bureau des étudiants\n',
  'Skills.csv': 'Name\nSEO\nGoogle Analytics\n"Publicité ""Meta"""\n',
  'Languages.csv': 'Name,Proficiency\nFrançais,Native or bilingual proficiency\nAnglais,Professional working proficiency\nWolof,\n',
  'Email Addresses.csv': 'Email Address,Confirmed,Primary,Updated On\nancienne@example.com,Yes,No,\nawa.ndiaye@example.com,Yes,Yes,\n',
  'PhoneNumbers.csv': 'Extension,Number,Type\n,771234567,Mobile\n',
  'Certifications.csv': 'Name,Url,Authority,Started On,Finished On,License Number\nMeta Certified Digital Marketing Associate,,Meta,Nov 2022,,\n',
};

// ——— CSV et dates ———

test('CSV : guillemets, guillemets doublés, retours à la ligne, BOM, lignes vides', () => {
  assert.deepEqual(parseCSV('﻿a,b\r\n"x, y","il a dit ""oui"""\n\n"multi\nligne",2'), [['a', 'b'], ['x, y', 'il a dit "oui"'], ['multi\nligne', '2']]);
  const rows = csvObjects('Notes:\nExporté le 29/09\n\nCompany Name,Title\nACME,Comptable\n', ['Company Name']);
  assert.deepEqual(rows, [{ companyname: 'ACME', title: 'Comptable' }]);
});

test('dates LinkedIn (anglais, français, numériques) et niveaux de langue', () => {
  assert.equal(linkedInDate('Mar 2022'), '2022-03');
  assert.equal(linkedInDate('sept. 2019'), '2019-09');
  assert.equal(linkedInDate('févr. 2022'), '2022-02');
  assert.equal(linkedInDate('août 2020'), '2020-08');
  assert.equal(linkedInDate('2019'), '2019');
  assert.equal(linkedInDate('2021-07-01'), '2021-07');
  assert.equal(linkedInDate('03/2018'), '2018-03');
  assert.equal(linkedInDate(''), '');
  assert.equal(levelFromLinkedIn('Native or bilingual proficiency'), 'native');
  assert.equal(levelFromLinkedIn('Full professional proficiency'), 'C1');
  assert.equal(levelFromLinkedIn('Professional working proficiency'), 'B2');
  assert.equal(levelFromLinkedIn('Limited working proficiency'), 'B1');
  assert.equal(levelFromLinkedIn('Elementary proficiency'), 'A2');
  assert.equal(levelFromLinkedIn(''), '');
});

// ——— Import LinkedIn ———

test('import LinkedIn : profil, postes, formation, compétences, langues, contacts', () => {
  const { cv, found, notes } = fromLinkedIn(LINKEDIN);
  assert.equal(found.length, 8);
  assert.equal(cv.identity.firstName, 'Awa');
  assert.equal(cv.identity.email, 'awa.ndiaye@example.com', 'adresse principale');
  assert.equal(cv.identity.phone, '+221 77 123 45 67', 'numéro sénégalais mis au format international');
  assert.equal(cv.identity.city, 'Dakar');
  assert.equal(cv.identity.country, 'Sénégal');
  assert.equal(cv.identity.website, 'https://awa.example.com');
  assert.equal(cv.targetTitle, 'Chargée de marketing digital');
  assert.equal(cv.experiences[0].current, true);
  assert.equal(cv.experiences[0].start, '2022-03');
  assert.equal(cv.experiences[0].description, 'Piloter les campagnes Meta\nAugmenter les ventes en ligne de 38 %');
  assert.equal(cv.experiences[1].end, '2022-02');
  assert.equal(cv.education[0].degree, 'Master Marketing');
  assert.deepEqual(cv.skills[0].keywords, ['SEO', 'Google Analytics', 'Publicité "Meta"']);
  assert.deepEqual(cv.languages.map((l) => l.level), ['native', 'B2', '']);
  assert.equal(cv.certifications[0].date, '2022-11');
  assert.equal(cv.meta.lang, 'fr');
  assert.ok(notes.some((n) => /CECRL/.test(n)));
  const r = checkCV(cv, 'sobre', { today: TODAY, pages: 1 });
  assert.equal(r.issues.filter((i) => i.severity === 'error').length, 0, r.issues.map((i) => i.id).join());
});

test('import LinkedIn : archive .zip compressée (deflate), dossiers et fichiers inconnus ignorés', async () => {
  const zip = deflateZip({ 'Basic_LinkedInDataExport/Positions.csv': LINKEDIN['Positions.csv'], 'Basic_LinkedInDataExport/Profile.csv': LINKEDIN['Profile.csv'], 'Connections.csv': 'x' });
  const entries = await readZipAsync(zip);
  assert.equal(Object.keys(entries).length, 3);
  const texts = Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, new TextDecoder().decode(v)]));
  const { cv, found } = fromLinkedIn(texts);
  assert.deepEqual(found.sort(), ['Positions.csv', 'Profile.csv']);
  assert.equal(cv.experiences.length, 2);
  const bad = zip.slice();
  bad[30 + 38 + 5] ^= 0xff; // données compressées du premier fichier (en-tête 30 + nom 38)
  await assert.rejects(() => readZipAsync(bad));
  assert.equal(fromLinkedIn({ 'autre.csv': 'a,b' }).found.length, 0);
});

// ——— Suivi des candidatures ———

test('candidature : statut « Envoyée » → date du jour et relance à J+10 ; statuts finaux sans relance', () => {
  assert.equal(addDays('2026-09-25', 10), '2026-10-05');
  assert.equal(addDays('2026-02-25', 5), '2026-03-02');
  let a = createApplication({ company: 'Sonatel', position: 'Chargée marketing' });
  assert.equal(a.status, 'a-envoyer');
  a = setStatus(a, 'envoyee', TODAY);
  assert.equal(a.sentOn, '2026-09-29');
  assert.equal(a.followUpOn, '2026-10-09');
  a = setStatus(a, 'relancee', new Date(2026, 9, 10));
  assert.equal(a.followUpOn, '2026-10-20');
  a = setStatus(a, 'entretien', TODAY);
  assert.equal(a.followUpOn, '');
  const kept = setStatus(createApplication({ company: 'X', sentOn: '2026-09-01' }), 'envoyee', TODAY);
  assert.equal(kept.sentOn, '2026-09-01', 'date d\'envoi saisie conservée');
  assert.equal(kept.followUpOn, '2026-09-11');
});

test('relances dues, tri, statistiques', () => {
  const apps = [
    normalizeApplication({ id: 'a', company: 'A', status: 'envoyee', sentOn: '2026-09-01', followUpOn: '2026-09-11' }),
    normalizeApplication({ id: 'b', company: 'B', status: 'envoyee', sentOn: '2026-09-25', followUpOn: '2026-10-05' }),
    normalizeApplication({ id: 'c', company: 'C', status: 'entretien', sentOn: '2026-09-20' }),
    normalizeApplication({ id: 'd', company: 'D', status: 'refus', sentOn: '2026-08-01', followUpOn: '2026-08-11' }),
    normalizeApplication({ id: 'e', company: 'E' }),
  ];
  assert.deepEqual(dueFollowUps(apps, TODAY).map((x) => x.id), ['a']);
  assert.equal(sortApplications(apps, TODAY)[0].id, 'a', 'relance due en tête');
  assert.deepEqual(stats(apps), { total: 5, sent: 4, active: 4, interviews: 1, responseRate: 50 });
  assert.equal(normalizeApplication({ status: 'inconnu', sentOn: 'hier', channel: 'Pigeon' }).status, 'a-envoyer');
  assert.equal(normalizeApplication({ sentOn: 'hier' }).sentOn, '');
  assert.equal(STATUSES.length, 7);
});

test('export CSV pour Excel : BOM, « ; », guillemets, formules neutralisées', () => {
  const csv = toCSV([normalizeApplication({ company: 'Port autonome; Dakar', position: '=HYPERLINK("x")', status: 'envoyee', notes: 'dit "oui"\npuis rien' })]);
  assert.ok(csv.startsWith('﻿Entreprise;Poste;'));
  const line = csv.split('\r\n')[1];
  assert.match(line, /^"Port autonome; Dakar";/);
  assert.match(line, /;"'=HYPERLINK\(""x""\)";/);
  assert.match(line, /Envoyée/);
  assert.match(csv, /"dit ""oui""\npuis rien"$/);
});

test('stockage des candidatures : ajout, modification, suppression, données corrompues', () => {
  const storage = createMemoryStorage();
  const st = createApplicationStore(storage);
  const a = st.save(createApplication({ company: 'Senelec' }));
  st.save({ ...a, position: 'Technicien' });
  assert.equal(st.list().length, 1);
  assert.equal(st.list()[0].position, 'Technicien');
  st.remove(a.id);
  assert.deepEqual(st.list(), []);
  storage.setItem('cvapp.v1.applications', '{pas du json');
  assert.deepEqual(st.list(), []);
});
