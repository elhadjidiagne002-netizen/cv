// Assistant IA : ce qui part vers le serveur (jamais d'identité), lecture des réponses, erreurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSampleCV } from '../public/js/model.js';
import {
  AI_ENDPOINT, profileForAI, letterMessages, adviceMessages, parseAIJson, normalizeLetterAnswer, normalizeAdviceAnswer, callAI, AIError,
} from '../public/js/ai.js';

function sampleWithEverything() {
  const cv = createSampleCV();
  Object.assign(cv.identity, { firstName: 'Awa', lastName: 'Ndiaye', email: 'awa.ndiaye@example.com', phone: '+221 77 123 45 67', address: '12 rue Carnot', birthDate: '1995-03-14', nationality: 'Sénégalaise', familyStatus: 'Mariée', photo: 'data:image/jpeg;base64,AAAA' });
  return cv;
}

test('aucune donnée d\'identité ni coordonnée n\'est envoyée à l\'IA', () => {
  const cv = sampleWithEverything();
  const sent = JSON.stringify([...letterMessages(cv, { offer: 'Poste de chargé marketing' }), ...adviceMessages(cv)]);
  for (const secret of ['Ndiaye', 'awa.ndiaye@example.com', '77 123 45 67', '12 rue Carnot', '1995-03-14', 'Sénégalaise', 'Mariée', 'base64']) {
    assert.ok(!sent.includes(secret), `« ${secret} » ne doit jamais partir vers l'IA`);
  }
  const p = profileForAI(cv);
  assert.deepEqual(Object.keys(p).sort(), ['accroche', 'benevolat', 'centres_interet', 'certifications', 'competences', 'experiences', 'formations', 'langue', 'langues', 'pays', 'poste_vise', 'projets'].sort());
  assert.ok(p.experiences.length > 0 && p.experiences[0].poste);
});

test('les éléments masqués du CV ne sont pas envoyés', () => {
  const cv = createSampleCV();
  cv.experiences[0].hidden = true;
  cv.experiences[0].position = 'POSTE-MASQUE-XYZ';
  const p = profileForAI(cv);
  assert.ok(!JSON.stringify(p).includes('POSTE-MASQUE-XYZ'));
  assert.equal(p.experiences.length, cv.experiences.length - 1);
});

test('lecture d\'une réponse JSON entourée de texte ou de ```', () => {
  assert.deepEqual(parseAIJson('Voici :\n```json\n{"objet":"A","corps":"B { } \\"x\\""}\n```'), { objet: 'A', corps: 'B { } "x"' });
  assert.equal(parseAIJson('pas de JSON'), null);
  assert.equal(parseAIJson('{"a": 1'), null);
});

test('réponse « lettre » : corps obligatoire, conseils bornés', () => {
  const body = 'Paragraphe un assez long pour une vraie lettre de motivation.\n\nParagraphe deux, avec [un chiffre] à compléter par la candidate.';
  const a = normalizeLetterAnswer({ objet: 'Candidature', corps: body, conseils: ['a', 'b', 'c', 'd', 'e'] });
  assert.equal(a.subject, 'Candidature');
  assert.equal(a.body, body);
  assert.equal(a.tips.length, 4);
  assert.equal(normalizeLetterAnswer({ corps: 'trop court' }), null);
  assert.equal(normalizeLetterAnswer(null), null);
});

test('réponse « conseils » : tri par priorité, réécritures limitées aux expériences existantes', () => {
  const cv = createSampleCV();
  const a = normalizeAdviceAnswer({
    accroche: 'Chargée de marketing digital, 5 ans d\'expérience.',
    conseils: [{ rubrique: 'Langues', priorite: 'basse', conseil: 'Précisez le certificat.' }, { rubrique: 'Expérience professionnelle', priorite: 'haute', conseil: 'Chiffrez vos résultats.' }, { conseil: '' }],
    missions: [{ index: 0, missions: 'Piloter les campagnes [chiffre] €' }, { index: 99, missions: 'hors limite' }, { index: 'x', missions: 'invalide' }],
    competences_manquantes: ['Google Analytics'],
  }, cv);
  assert.deepEqual(a.tips.map((t) => t.priority), ['haute', 'basse']);
  assert.equal(a.rewrites.length, 1);
  assert.equal(a.rewrites[0].id, cv.experiences[0].id);
  assert.equal(a.rewrites[0].before, cv.experiences[0].description);
  assert.deepEqual(a.missingSkills, ['Google Analytics']);
});

test('appel : bonne adresse, réponse lue, erreurs claires en français', async () => {
  let seen;
  const ok = await callAI([{ role: 'user', content: 'x' }], { fetchImpl: async (url, init) => { seen = { url, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] }), { status: 200 }); } });
  assert.equal(ok, '{"a":1}');
  assert.equal(seen.url, AI_ENDPOINT);
  assert.ok(seen.body.max_tokens <= 2500); // plafond du service NEXUS
  await assert.rejects(callAI([], { fetchImpl: async () => new Response('', { status: 429 }) }), (e) => e instanceof AIError && /minute/.test(e.message));
  await assert.rejects(callAI([], { fetchImpl: async () => new Response('', { status: 502 }) }), (e) => e instanceof AIError && /indisponible/.test(e.message));
  await assert.rejects(callAI([], { fetchImpl: async () => { throw new TypeError('network'); } }), (e) => e instanceof AIError && /connexion/.test(e.message));
});

test('la seule origine externe autorisée est le service d\'IA, partout où la CSP est déclarée', () => {
  for (const f of ['public/_headers', 'public/app.html', 'public/index.html']) {
    const s = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(s, /connect-src 'self' https:\/\/nexusmarket\.sn;/, f);
  }
  assert.ok(AI_ENDPOINT.startsWith('https://nexusmarket.sn/'));
});
