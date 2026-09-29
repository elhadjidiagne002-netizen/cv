import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyCV, createSampleCV, createSampleCVEnglish, createItem, normalizeCV, validateCV, sortAntichronological,
  moveItem, setByPath, getByPath, LIST_SECTIONS, SENSITIVE_FIELDS, CEFR_LEVELS, ITEM_FIELDS, normalizeDate,
} from '../public/js/model.js';

test('un CV vide est valide et contient toutes les rubriques', () => {
  const cv = createEmptyCV();
  assert.equal(validateCV(cv).valid, true);
  for (const s of LIST_SECTIONS) assert.deepEqual(cv[s], []);
  assert.deepEqual(cv.meta.sectionOrder, LIST_SECTIONS);
  assert.equal(cv.meta.lang, 'fr');
  assert.equal(cv.meta.paper, 'A4');
});

test('le schéma couvre toutes les rubriques demandées', () => {
  for (const s of ['experiences', 'education', 'skills', 'languages', 'certifications', 'projects', 'volunteering', 'interests', 'references']) {
    assert.ok(ITEM_FIELDS[s], `rubrique ${s}`);
  }
  const cv = createEmptyCV();
  for (const k of ['firstName', 'lastName', 'email', 'phone', 'city', 'linkedin', ...SENSITIVE_FIELDS]) assert.ok(k in cv.identity, k);
  assert.ok('targetTitle' in cv && 'summary' in cv);
});

test('les champs sensibles sont masqués par défaut', () => {
  const cv = createEmptyCV();
  assert.ok(Object.values(cv.privacy).length >= 6);
  assert.ok(Object.values(cv.privacy).every((v) => v === false));
  const sample = createSampleCV();
  assert.equal(sample.privacy.showBirthDate, false);
  assert.equal(sample.identity.birthDate, '');
});

test('les données d\'exemple sont valides et réalistes (profil sénégalais)', () => {
  const cv = createSampleCV();
  assert.equal(validateCV(cv).valid, true, JSON.stringify(validateCV(cv).errors));
  assert.equal(cv.identity.country, 'Sénégal');
  assert.match(cv.identity.phone, /^\+221/);
  assert.ok(cv.experiences.length >= 3);
  assert.ok(cv.languages.some((l) => l.level === 'native'));
  const en = createSampleCVEnglish();
  assert.equal(validateCV(en).valid, true);
  assert.equal(en.meta.lang, 'en');
});

test('les identifiants des éléments sont uniques', () => {
  const cv = createSampleCV();
  const ids = LIST_SECTIONS.flatMap((s) => cv[s].map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('la validation détecte e-mail, dates et niveaux invalides', () => {
  const cv = createSampleCV();
  cv.identity.email = 'pas-un-email';
  cv.experiences[0].start = '2022-13';
  cv.experiences[1].end = '2018-01';
  cv.languages[0].level = 'Courant';
  const { valid, errors } = validateCV(cv);
  assert.equal(valid, false);
  const paths = errors.map((e) => e.path);
  assert.ok(paths.includes('identity.email'));
  assert.ok(paths.includes('experiences.0.start'));
  assert.ok(paths.includes('experiences.1.end'), 'fin avant début');
  assert.ok(paths.includes('languages.0.level'));
  assert.ok(errors.every((e) => typeof e.message === 'string' && e.message.length > 5));
});

test('validateCV résiste aux entrées absurdes', () => {
  assert.equal(validateCV(null).valid, false);
  assert.equal(validateCV({}).valid, false);
});

test('normalizeCV complète un CV partiel ou ancien', () => {
  const cv = normalizeCV({
    identity: { firstName: 'Moussa', photo: 'javascript:alert(1)' },
    experiences: [{ position: 'Comptable', start: '03/2020', current: 1 }],
    skills: [{ name: 'Outils', keywords: 'Sage, Excel ,  ' }],
    languages: [{ name: 'Wolof', level: 'maternelle' }, { name: 'Anglais', level: 'b1' }],
    meta: { lang: 'de', paper: 'A3', sectionOrder: ['skills', 'inconnu'] },
  });
  assert.equal(cv.identity.firstName, 'Moussa');
  assert.equal(cv.identity.photo, '', 'une photo non data:image est rejetée');
  assert.equal(cv.experiences[0].start, '2020-03');
  assert.equal(cv.experiences[0].current, true);
  assert.deepEqual(cv.skills[0].keywords, ['Sage', 'Excel']);
  assert.equal(cv.languages[0].level, 'native');
  assert.equal(cv.languages[1].level, 'B1');
  assert.equal(cv.meta.lang, 'fr');
  assert.equal(cv.meta.paper, 'A4');
  assert.equal(cv.meta.sectionOrder[0], 'skills');
  assert.equal(cv.meta.sectionOrder.length, LIST_SECTIONS.length);
  assert.equal(validateCV(cv).valid, true);
});

test('normalizeDate accepte plusieurs formats', () => {
  assert.equal(normalizeDate('2021-3'), '2021-03');
  assert.equal(normalizeDate('3/2021'), '2021-03');
  assert.equal(normalizeDate('2021/03'), '2021-03');
  assert.equal(normalizeDate('2021-03-15'), '2021-03');
  assert.equal(normalizeDate(''), '');
});

test('createItem produit un élément complet', () => {
  const it = createItem('languages', { name: 'Pulaar' });
  assert.equal(it.name, 'Pulaar');
  assert.equal(it.level, '');
  assert.ok(it.id);
  assert.throws(() => createItem('inconnue'));
});

test('tri antéchronologique : poste en cours d\'abord, puis fin la plus récente', () => {
  const list = [
    { id: 'a', start: '2015-01', end: '2017-01' },
    { id: 'b', start: '2020-01', current: true },
    { id: 'c', start: '2017-02', end: '2019-12' },
  ];
  assert.deepEqual(sortAntichronological(list).map((i) => i.id), ['b', 'c', 'a']);
});

test('moveItem, getByPath, setByPath', () => {
  assert.deepEqual(moveItem([1, 2, 3], 0, 1), [2, 1, 3]);
  assert.deepEqual(moveItem([1, 2, 3], 0, -1), [1, 2, 3]);
  const cv = createSampleCV();
  setByPath(cv, 'experiences.0.city', 'Thiès');
  assert.equal(getByPath(cv, 'experiences.0.city'), 'Thiès');
  assert.throws(() => setByPath(cv, 'inexistant.0.x', 1));
});

test('niveaux CECRL complets', () => {
  assert.deepEqual(CEFR_LEVELS, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native']);
});

test('cycle 2 : nouvelles rubriques et réglages (palette, pays, ajustement, offre)', () => {
  const cv = createEmptyCV();
  assert.deepEqual(cv.awards, []);
  assert.deepEqual(cv.publications, []);
  assert.equal(cv.meta.country, '');
  assert.equal(cv.meta.fit, 0);
  const n = normalizeCV({ meta: { palette: 'ocean', country: 'SN', jobOffer: 'Offre', sectionOrder: ['experiences'] }, publications: [{ title: 'Article', date: '05/2021' }] });
  assert.equal(n.meta.palette, 'ocean');
  assert.equal(n.meta.country, 'SN');
  assert.equal(n.meta.jobOffer, 'Offre');
  assert.equal(n.publications[0].date, '2021-05');
  assert.ok(n.meta.sectionOrder.includes('publications') && n.meta.sectionOrder.includes('awards'));
  const bad = normalizeCV({ meta: { palette: '<x>', country: 'XX' } });
  assert.equal(bad.meta.palette, '');
  assert.equal(bad.meta.country, '');
  assert.equal(validateCV(n).valid, true);
});
