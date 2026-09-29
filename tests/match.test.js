// Correspondance CV ↔ offre d'emploi (locale).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractKeywords, matchOffer, stem, normalizeText, cvText } from '../public/js/match.js';
import { createSampleCV, createEmptyCV } from '../public/js/model.js';

const OFFER = `Teranga Retail recrute un(e) Responsable marketing digital H/F (CDI, Dakar)
Missions :
- Piloter la stratégie social media et les campagnes Google Ads et Meta
- Analyser la performance avec Google Analytics 4 et Power BI
- Encadrer une équipe de 3 personnes ; gestion de projet et gestion du budget
Profil : 5 ans d'expérience en marketing digital, maîtrise de SEO, SQL et HubSpot. Anglais courant (B2).
Gestion de projet agile appréciée.`;

const terms = (list) => list.map((k) => k.term.toLowerCase());

test('normalisation et racines', () => {
  assert.equal(normalizeText('Gestion d’Équipe'), "gestion d'equipe");
  assert.equal(stem('campagnes'), stem('campagne'));
  assert.equal(stem('Comptable'), stem('comptabilité'));
  assert.equal(stem('SQL'), 'sql');
});

test('extraction : expressions, sigles et outils ; pas de mots vides ni génériques', () => {
  const k = terms(extractKeywords(OFFER));
  for (const t of ['marketing digital', 'gestion de projet', 'power bi', 'google ads', 'sql', 'seo', 'hubspot']) assert.ok(k.includes(t), t);
  for (const t of ['de', 'et', 'la', 'cdi', 'h/f', 'profil', 'missions', 'expérience', 'b2', '5', 'power', 'bi']) assert.equal(k.includes(t), false, t);
  assert.ok(extractKeywords(OFFER, { max: 5 }).length <= 5);
  assert.deepEqual(extractKeywords(''), []);
});

test('correspondance : score, mots-clés présents et manquants', () => {
  const r = matchOffer(createSampleCV(), OFFER);
  assert.ok(r.score > 40 && r.score < 90, `score ${r.score}`);
  const ok = terms(r.matched);
  const miss = terms(r.missing);
  for (const t of ['marketing digital', 'google ads', 'seo', 'hubspot']) assert.ok(ok.includes(t), t);
  for (const t of ['sql', 'power bi', 'gestion de projet']) assert.ok(miss.includes(t), t);
  assert.equal(r.matched.length + r.missing.length, r.total);
});

test('ajouter les compétences manquantes augmente le score ; CV vide = 0', () => {
  const cv = createSampleCV();
  const before = matchOffer(cv, OFFER).score;
  cv.skills[1].keywords.push('SQL', 'Power BI', 'Gestion de projet');
  const after = matchOffer(cv, OFFER).score;
  assert.ok(after > before, `${before} → ${after}`);
  assert.equal(matchOffer(createEmptyCV(), OFFER).score, 0);
  assert.equal(matchOffer(cv, '   ').total, 0);
});

test('offre en anglais', () => {
  const offer = 'We are looking for a Data Analyst. Required: SQL, Python, Tableau, stakeholder management. Experience with Python and SQL is a plus.';
  const k = terms(extractKeywords(offer));
  for (const t of ['sql', 'python', 'tableau']) assert.ok(k.includes(t), t);
  assert.equal(k.includes('the'), false);
});

test('le texte indexé couvre toutes les rubriques', () => {
  const txt = cvText(createSampleCV());
  for (const s of ['Teranga Distribution', 'HubSpot', 'TOEIC 845', 'Meta Certified', 'Jappo Liggey']) assert.ok(txt.includes(s), s);
});
