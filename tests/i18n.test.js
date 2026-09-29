import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, t, formatDate, formatRange, levelLabel, formatBirthDate } from '../public/js/i18n.js';

test('les deux langues ont exactement les mêmes clés', () => {
  assert.deepEqual(Object.keys(LABELS.fr).sort(), Object.keys(LABELS.en).sort());
  assert.deepEqual(Object.keys(LABELS.fr.levels), Object.keys(LABELS.en.levels));
});

test('titres de rubriques standard reconnus par les ATS', () => {
  assert.equal(t('fr', 'experiences'), 'Expérience professionnelle');
  assert.equal(t('fr', 'education'), 'Formation');
  assert.equal(t('fr', 'skills'), 'Compétences');
  assert.equal(t('fr', 'languages'), 'Langues');
  assert.equal(t('en', 'education'), 'Education');
  assert.equal(t('en', 'skills'), 'Skills');
  assert.equal(t('xx', 'skills'), 'Compétences', 'repli sur le français');
});

test('dates homogènes, « Aujourd\'hui / Present »', () => {
  assert.equal(formatDate('2022-03'), '03/2022');
  assert.equal(formatDate('2022-03', 'fr', 'long'), 'mars 2022');
  assert.equal(formatDate('2022-03', 'en', 'long'), 'March 2022');
  assert.equal(formatDate('2022'), '2022');
  assert.equal(formatRange('2020-01', '', true, 'fr'), '01/2020 – Aujourd\'hui');
  assert.equal(formatRange('2020-01', '', true, 'en', 'long'), 'January 2020 – Present');
  assert.equal(formatRange('2020-01', '2020-01', false), '01/2020');
  assert.equal(formatRange('', '2020-06', false), '06/2020');
});

test('niveaux CECRL et date de naissance', () => {
  assert.equal(levelLabel('fr', 'native'), 'Langue maternelle');
  assert.equal(levelLabel('en', 'B2'), 'B2 — Upper intermediate');
  assert.equal(formatBirthDate('1995-04-12', 'fr'), '12/04/1995');
  assert.equal(formatBirthDate('1995-04-12', 'en'), 'April 12, 1995');
});
