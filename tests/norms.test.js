import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCV, applyFix, estimatePages, yearsOfExperience, looksFrench } from '../public/js/norms.js';
import { createSampleCV, createSampleCVEnglish, createEmptyCV, createItem, cloneCV } from '../public/js/model.js';
import { TEMPLATES } from '../public/js/render.js';

const TODAY = new Date('2026-09-29T12:00:00Z');
const ids = (r) => r.issues.map((i) => i.id);
const check = (cv, tpl = 'sobre', opts = {}) => checkCV(cv, tpl, { today: TODAY, ...opts });

test('l\'exemple obtient un très bon score sur un modèle ATS', () => {
  const r = check(createSampleCV());
  assert.ok(r.score >= 90, `score ${r.score} : ${ids(r)}`);
  assert.equal(r.issues.filter((i) => i.severity === 'error').length, 0);
});

test('l\'exemple anglais est conforme au résumé US', () => {
  const r = check(createSampleCVEnglish(), 'us-resume', { pages: 1 });
  assert.ok(r.score >= 90, `score ${r.score} : ${ids(r)}`);
});

test('un CV vide obtient un score faible et des alertes précises', () => {
  const r = check(createEmptyCV());
  assert.ok(r.score < 50, `score ${r.score}`);
  for (const id of ['identity.name', 'identity.email.missing', 'targetTitle', 'summary.missing', 'experiences.empty', 'education.empty', 'skills.empty']) {
    assert.ok(ids(r).includes(id), id);
  }
});

test('chaque alerte a un message et une cible (cliquable) ou une correction', () => {
  const cv = createEmptyCV();
  cv.experiences.push(createItem('experiences', { position: '', start: '2030-01', end: '2020-01' }));
  cv.languages.push(createItem('languages', { name: 'Anglais' }));
  for (const is of check(cv).issues) {
    assert.ok(is.message.length > 10, is.id);
    assert.ok(['error', 'warning', 'info'].includes(is.severity), is.id);
    assert.ok(is.target || is.fix, `${is.id} sans cible`);
  }
});

test('e-mail peu professionnel détecté', () => {
  for (const email of ['bebe_love221@gmail.com', 'le.boss@yahoo.fr', 'moussa19951996@gmail.com', 'princesse.awa@hotmail.com']) {
    const cv = createSampleCV();
    cv.identity.email = email;
    assert.ok(ids(check(cv)).includes('identity.email.unprofessional'), email);
  }
  const ok = createSampleCV();
  ok.identity.email = 'moussa.diop@gmail.com';
  assert.equal(ids(check(ok)).includes('identity.email.unprofessional'), false);
});

test('ordre antéchronologique vérifié et corrigeable automatiquement', () => {
  const cv = createSampleCV();
  cv.experiences.reverse();
  const r = check(cv);
  const issue = r.issues.find((i) => i.id === 'experiences.order');
  assert.ok(issue);
  assert.equal(issue.fix, 'sort:experiences');
  applyFix(cv, issue.fix);
  assert.equal(ids(check(cv)).includes('experiences.order'), false);
  assert.equal(cv.experiences[0].current, true);
});

test('dates incohérentes : fin avant début, futur, en cours avec fin, fin manquante', () => {
  const cv = createSampleCV();
  cv.experiences[1].end = '2018-01';
  cv.experiences[2].start = '2027-05';
  cv.experiences[2].end = '';
  cv.experiences[0].end = '2024-01';
  const r = ids(check(cv));
  assert.ok(r.includes('experiences.1.end.before'));
  assert.ok(r.includes('experiences.2.start.future'));
  assert.ok(r.includes('experiences.0.current.end'));
  assert.ok(r.includes('experiences.2.end.missing'));
});

test('dates hétérogènes (année seule mélangée à mois/année)', () => {
  const cv = createSampleCV();
  cv.education[1].start = '2014';
  assert.ok(ids(check(cv)).includes('dates.mixed'));
});

test('langue sans niveau CECRL', () => {
  const cv = createSampleCV();
  cv.languages.push(createItem('languages', { name: 'Pulaar' }));
  const r = check(cv);
  const is = r.issues.find((i) => i.id === 'languages.3.level');
  assert.ok(is);
  assert.equal(is.target, 'languages.3.level');
});

test('accroche trop longue, trop courte, à la première personne', () => {
  const cv = createSampleCV();
  cv.summary = 'x'.repeat(620);
  assert.ok(ids(check(cv)).includes('summary.long'));
  cv.summary = 'Je suis motivée.';
  const r = ids(check(cv));
  assert.ok(r.includes('summary.short'));
  assert.ok(r.includes('summary.pronoun'));
});

test('verbes d\'action, chiffres et formulations faibles', () => {
  const cv = createSampleCV();
  cv.experiences[0].description = 'Responsable de la communication\nGestion des réseaux sociaux\nTâches diverses';
  cv.experiences[1].description = 'Participation aux salons\nRelation avec les clients';
  cv.experiences[2].description = '';
  const r = ids(check(cv));
  assert.ok(r.includes('experiences.verbs'));
  assert.ok(r.includes('experiences.numbers'));
  assert.ok(r.includes('experiences.weak'));
  assert.equal(ids(check(createSampleCV())).includes('experiences.verbs'), false, 'l\'exemple commence par des verbes');
});

test('longueur : > 2 pages = erreur ; 2 pages sous 10 ans d\'expérience = conseil', () => {
  assert.ok(ids(check(createSampleCV(), 'sobre', { pages: 3 })).includes('length.max'));
  const two = check(createSampleCV(), 'sobre', { pages: 2 });
  assert.equal(two.issues.find((i) => i.id === 'length.junior').severity, 'info');
  const us = check(createSampleCVEnglish(), 'us-resume', { pages: 2 });
  assert.equal(us.issues.find((i) => i.id === 'length.junior').severity, 'warning', 'plus strict aux États-Unis');
  const senior = createSampleCV();
  senior.experiences.push(createItem('experiences', { position: 'Commercial', employer: 'X', start: '2008-01', end: '2018-12' }));
  assert.equal(ids(check(senior, 'sobre', { pages: 2 })).includes('length.junior'), false);
});

test('estimation des pages hors navigateur', () => {
  assert.equal(estimatePages(createEmptyCV()), 1);
  assert.equal(estimatePages(createSampleCV()), 1);
  const long = createSampleCV();
  for (let i = 0; i < 12; i += 1) long.experiences.push(cloneCV(long.experiences[0]));
  assert.ok(estimatePages(long) >= 3);
});

test('années d\'expérience', () => {
  const y = yearsOfExperience(createSampleCV(), TODAY);
  assert.ok(y > 6 && y < 9, String(y));
});

test('champs discriminants remplis et affichés : conseil + correction', () => {
  const cv = createSampleCV();
  cv.identity.birthDate = '1995-04-12';
  cv.identity.maritalStatus = 'Mariée';
  cv.privacy.showBirthDate = true;
  cv.privacy.showMaritalStatus = true;
  const is = check(cv, 'classique').issues.find((i) => i.id === 'sensitive.shown');
  assert.ok(is);
  assert.equal(is.fix, 'hide:sensitive');
  applyFix(cv, is.fix);
  assert.equal(check(cv, 'classique').issues.some((i) => i.id === 'sensitive.shown'), false);
});

test('photo sur un modèle US = erreur ; photo sur un modèle ATS = conseil', () => {
  const cv = createSampleCVEnglish();
  cv.identity.photo = 'data:image/jpeg;base64,AAAA';
  cv.privacy.showPhoto = true;
  const us = check(cv, 'us-resume', { pages: 1 }).issues.find((i) => i.id === 'sensitive.anglo');
  assert.equal(us.severity, 'error');
  const fr = createSampleCV();
  fr.identity.photo = 'data:image/jpeg;base64,AAAA';
  fr.privacy.showPhoto = true;
  assert.ok(ids(check(fr, 'classique')).includes('photo.ats'));
  assert.equal(ids(check(fr, 'dakar')).includes('photo.ats'), false);
});

test('contenu français sur un modèle anglais signalé', () => {
  assert.ok(ids(check(createSampleCV(), 'us-resume', { pages: 1 })).includes('lang.mismatch'));
  assert.equal(looksFrench('Managed a team of five and increased sales by 20% in the region'), false);
  assert.equal(looksFrench('Gestion de la relation client et suivi des ventes dans la région de Dakar'), true);
});

test('modèle créatif : avertissement ATS sans pénalité forte', () => {
  const r = check(createSampleCV(), 'dakar');
  assert.ok(ids(r).includes('template.ats'));
  assert.ok(r.score >= 90);
});

test('mode CV anonyme : pas d\'alerte sur nom/e-mail absents, avis non pénalisant', () => {
  const cv = createSampleCV();
  applyFix(cv, 'anonymous:on');
  assert.equal(cv.meta.anonymous, true);
  const r = check(cv);
  assert.ok(ids(r).includes('anonymous.on'));
  assert.equal(r.score, check(createSampleCV()).score);
  applyFix(cv, 'anonymous:off');
  assert.equal(cv.meta.anonymous, false);
});

test('centres d\'intérêt trop vagues', () => {
  const cv = createSampleCV();
  cv.interests.push(createItem('interests', { name: 'Sport' }));
  assert.ok(ids(check(cv)).includes('interests.3.vague'));
});

test('le score reste entre 0 et 100 pour tous les modèles', () => {
  const bad = createEmptyCV();
  for (let i = 0; i < 10; i += 1) bad.languages.push(createItem('languages', { name: `L${i}` }));
  for (const t of TEMPLATES) {
    for (const cv of [bad, createSampleCV(), createSampleCVEnglish()]) {
      const { score } = check(cv, t.id);
      assert.ok(score >= 0 && score <= 100, `${t.id} ${score}`);
    }
  }
  assert.equal(check(bad).score, 0);
});
