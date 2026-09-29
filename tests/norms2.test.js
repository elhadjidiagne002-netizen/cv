// Cycle 2 : nouvelles règles de conformité et profils par pays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCV, applyFix, findGaps, findOverlaps, monthsBetween, verbTense, phoneDigits, cleanSpaces, COUNTRY_PROFILES,
} from '../public/js/norms.js';
import { createSampleCV, createSampleCVEnglish, createItem, COUNTRIES } from '../public/js/model.js';

const TODAY = new Date('2026-09-29T12:00:00Z');
const NOW = '2026-09';
const ids = (r) => r.issues.map((i) => i.id);
const check = (cv, tpl = 'sobre', opts = {}) => checkCV(cv, tpl, { today: TODAY, pages: 1, ...opts });
const has = (cv, id, tpl) => ids(check(cv, tpl)).some((x) => x === id || x.startsWith(`${id}.`));

test('les exemples restent à 100/100 avec toutes les nouvelles règles', () => {
  assert.equal(check(createSampleCV()).score, 100, ids(check(createSampleCV())).join());
  assert.equal(check(createSampleCVEnglish(), 'us-resume').score, 100, ids(check(createSampleCVEnglish(), 'us-resume')).join());
});

test('monthsBetween', () => {
  assert.equal(monthsBetween('2020-01', '2020-07'), 6);
  assert.equal(monthsBetween('2019-11', '2020-02'), 3);
});

test('trou de plus de 6 mois détecté, comblé par une formation', () => {
  const cv = createSampleCV();
  cv.experiences[1].start = '2020-09'; // fin du stage 07/2019 → reprise 09/2020 : 13 mois
  cv.volunteering[0].start = '2021-01'; // le bénévolat comblerait sinon une partie de la période
  const gaps = findGaps(cv, NOW);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].months, 13);
  assert.ok(has(cv, 'gap'));
  cv.education.unshift(createItem('education', { degree: 'Certificat Google Ads', school: 'ISM', start: '2019-09', end: '2020-06' }));
  assert.equal(findGaps(cv, NOW).length, 0, 'formation comble la période');
  const short = createSampleCV();
  short.experiences[1].start = '2019-12'; // 4 mois : toléré
  assert.equal(findGaps(short, NOW).length, 0);
});

test('chevauchement de deux expériences', () => {
  const cv = createSampleCV();
  cv.experiences[1].end = '2022-10'; // chevauche le poste actuel débuté en 03/2022
  const o = findOverlaps(cv, NOW);
  assert.equal(o.length, 1);
  assert.equal(o[0].months, 8);
  assert.ok(has(cv, 'overlap'));
  assert.equal(findOverlaps(createSampleCV(), NOW).length, 0);
});

test('verbes répétés en début de ligne', () => {
  const cv = createSampleCV();
  cv.experiences[0].description = 'Gérer le budget de 45 M FCFA\nGérer une équipe de 4 personnes\nGérer les agences\nAugmenter les ventes de 38 %';
  assert.ok(has(cv, 'experiences.repeated'));
});

test('temps verbaux mélangés dans une même expérience', () => {
  assert.equal(verbTense('Piloter un budget', 'fr'), 'inf');
  assert.equal(verbTense('Piloté un budget', 'fr'), 'part');
  assert.equal(verbTense('Managed a team', 'en'), 'past');
  assert.equal(verbTense('Led a team', 'en'), 'past');
  assert.equal(verbTense('Manage a team', 'en'), 'base');
  const cv = createSampleCV();
  cv.experiences[1].description = 'Organiser 12 opérations\nRédigé les contenus : +65 000 abonnés\nSuivre les indicateurs';
  assert.ok(has(cv, 'experiences.tense'));
});

test('mots creux dans l\'accroche', () => {
  const cv = createSampleCV();
  cv.summary = 'Jeune femme dynamique et motivée, dotée d\'un bon relationnel et d\'un esprit d\'équipe, 6 ans en marketing.';
  const is = check(cv).issues.find((i) => i.id === 'style.buzzwords');
  assert.ok(is);
  assert.match(is.message, /dynamique/);
  assert.match(is.message, /motivée/);
  const en = createSampleCVEnglish();
  en.summary = 'Hardworking team player with 6 years of experience in digital marketing and analytics for retail brands.';
  assert.ok(has(en, 'style.buzzwords', 'us-resume'));
});

test('ponctuation, majuscules et doubles espaces homogènes (+ correction)', () => {
  const cv = createSampleCV();
  cv.experiences[0].description = 'Piloter un budget de 45 M FCFA.\nAugmenter les ventes de 38 %\nencadrer 2 assistants';
  const r = ids(check(cv));
  assert.ok(r.includes('style.punctuation'));
  assert.ok(r.includes('style.capitals'));
  cv.summary = 'Chargée de  marketing digital, 6 ans  d\'expérience au Sénégal : campagnes, analyse, acquisition client.';
  const sp = check(cv).issues.find((i) => i.id === 'style.spaces');
  assert.equal(sp.fix, 'clean:spaces');
  applyFix(cv, sp.fix);
  assert.doesNotMatch(cv.summary, / {2}/);
  assert.equal(ids(check(cv)).includes('style.spaces'), false);
  assert.equal(cleanSpaces('a  b\n  c\t d'), 'a b\nc d');
});

test('téléphone : format international, numéro incomplet, indicatif du pays', () => {
  assert.equal(phoneDigits('+221 77-123.45 67'), '+221771234567');
  const cv = createSampleCV();
  cv.identity.phone = '77 123 45 67';
  assert.ok(has(cv, 'identity.phone.intl'));
  cv.identity.phone = '12 34';
  assert.ok(has(cv, 'identity.phone.invalid'));
  cv.identity.phone = '00221 77 123 45 67';
  assert.equal(has(cv, 'identity.phone'), false);
  cv.meta.country = 'FR';
  assert.ok(has(cv, 'identity.phone.country'), 'numéro sénégalais pour la France');
});

test('âge déductible par l\'année du baccalauréat', () => {
  const cv = createSampleCV();
  cv.education.push(createItem('education', { degree: 'Baccalauréat série S2', school: 'Lycée Blaise Diagne', end: '2014-07' }));
  const is = check(cv).issues.find((i) => i.id === 'age.deducible');
  assert.ok(is);
  assert.equal(is.severity, 'info');
  assert.equal(is.target, 'education.2.end');
  cv.meta.anonymous = true;
  assert.equal(check(cv).issues.find((i) => i.id === 'age.deducible').severity, 'warning');
  cv.meta.anonymous = false;
  cv.education[2].end = '';
  assert.equal(has(cv, 'age.deducible'), false, 'sans date, rien à déduire');
});

test('profils pays : 6 pays, cohérents avec le modèle de données', () => {
  assert.deepEqual(Object.keys(COUNTRY_PROFILES).sort(), [...COUNTRIES].sort());
  for (const p of Object.values(COUNTRY_PROFILES)) {
    assert.ok(['A4', 'Letter'].includes(p.paper));
    assert.match(p.phone, /^\+\d+$/);
  }
});

test('profil États-Unis / Canada : papier Letter, photo et données personnelles interdites', () => {
  const cv = createSampleCV();
  cv.identity.photo = 'data:image/jpeg;base64,AAAA';
  cv.identity.birthDate = '1995-04-12';
  cv.privacy.showPhoto = true;
  cv.privacy.showBirthDate = true;
  cv.meta.country = 'CA';
  const r = check(cv, 'classique');
  const paper = r.issues.find((i) => i.id === 'country.paper');
  assert.equal(paper.fix, 'paper:Letter');
  assert.equal(r.issues.find((i) => i.id === 'country.photo').severity, 'error');
  assert.equal(r.issues.find((i) => i.id === 'country.personal').severity, 'error');
  assert.ok(ids(r).includes('country.template'));
  applyFix(cv, 'paper:Letter');
  applyFix(cv, 'hide:sensitive');
  const r2 = ids(check(cv, 'classique'));
  for (const id of ['country.paper', 'country.photo', 'country.personal']) assert.equal(r2.includes(id), false, id);
  // Le modèle Québec respecte déjà tout : aucune alerte pays.
  cv.meta.paper = 'A4';
  assert.equal(ids(check(cv, 'quebec')).some((x) => x.startsWith('country.')), false);

  const us = createSampleCV();
  us.meta.country = 'US';
  const ru = ids(check(us, 'sobre'));
  assert.ok(ru.includes('country.lang'));
  assert.ok(ru.includes('country.us.sections'));
});

test('profils Sénégal / Allemagne : informations personnelles admises ; photo d\'usage en Allemagne', () => {
  const cv = createSampleCV();
  cv.identity.birthDate = '1995-04-12';
  cv.privacy.showBirthDate = true;
  assert.ok(has(cv, 'sensitive.shown'), 'profil général : conseil');
  cv.meta.country = 'SN';
  assert.equal(has(cv, 'sensitive.shown'), false);
  cv.meta.country = 'DE';
  assert.equal(has(cv, 'sensitive.shown'), false);
  assert.ok(has(cv, 'country.photo.de', 'lebenslauf'));
});

test('longueur selon le pays et le modèle académique ; correction « ajuster »', () => {
  const cv = createSampleCV();
  const r = check(cv, 'sobre', { pages: 2 });
  assert.equal(r.issues.find((i) => i.id === 'length.junior').fix, 'fit:1');
  cv.meta.country = 'UK';
  assert.equal(ids(check(cv, 'uk-cv', { pages: 2 })).includes('length.junior'), false, 'Royaume-Uni : 2 pages normales');
  const three = check(createSampleCV(), 'sobre', { pages: 3 }).issues.find((i) => i.id === 'length.max');
  assert.equal(three.fix, 'fit:2');
  assert.equal(ids(check(createSampleCV(), 'academique', { pages: 4 })).includes('length.max'), false, 'CV académique long admis');
});
