// 06/10/2026 : dossier de candidature en un seul PDF, attestations employeur, lettre en wolof (IA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentsHTML, contents, sendMessage } from '../public/js/dossier.js';
import { clean, checks, paragraphs, dateFr, fileName } from '../public/js/attestation-core.js';
import { letterMessages, normalizeLetterAnswer } from '../public/js/ai.js';
import { LETTER_STYLES } from '../public/js/model.js';

const cv = { identity: { firstName: 'Awa', lastName: 'Diop (exemple)', phone: '77 000 00 00', email: 'awa@exemple.sn' }, targetTitle: 'Comptable', letter: { organization: 'Entreprise (exemple)', subject: '' } };

test('dossier : pièces échappées, sommaire et message d’envoi', () => {
  const html = attachmentsHTML([{ label: 'Diplôme <script>', src: 'data:image/jpeg;base64,AAA' }]);
  assert.match(html, /Pièce 1 — Diplôme &lt;script&gt;/);
  assert.ok(!html.includes('<script>'));
  assert.deepEqual(contents({ hasLetter: true, items: [{ label: 'Copie du diplôme' }] }), ['Curriculum vitae', 'Lettre de motivation', 'Copie du diplôme']);
  const m = sendMessage(cv, { hasLetter: false, items: [{ label: 'Attestation de stage' }] });
  assert.equal(m.subject, 'Candidature — Comptable — Awa Diop (exemple)');
  assert.match(m.body, /au sein de Entreprise \(exemple\)/);
  assert.match(m.body, /- Curriculum vitae\n- Attestation de stage/);
  assert.ok(!m.body.includes('Lettre de motivation'), 'pas de lettre annoncée si elle n’est pas rédigée');
  assert.match(m.body, /77 000 00 00/);
});

test('attestation de travail : champs obligatoires, accords, toujours en poste', () => {
  assert.ok(checks(clean({})).length >= 4);
  const base = { type: 'travail', employer: { name: 'Société (exemple)' }, signer: { name: 'Responsable (exemple)', role: 'Gérant' },
    person: { civ: 'Mme', name: 'Fatou Sarr (exemple)' }, job: 'caissière', contract: 'CDD', start: '2024-01-01', end: '2026-06-30' };
  const a = clean(base);
  assert.deepEqual(checks(a), []);
  assert.match(paragraphs(clean({ ...base, person: { ...base.person, birth: '1995-05-02', birthPlace: 'Thiès' } }))[0], /née le 2 mai 1995 à Thiès, a été employée/);
  const p = paragraphs(a);
  assert.match(p[0], /atteste que Mme Fatou Sarr \(exemple\) a été employée au sein de notre structure du 1er janvier 2024 au 30 juin 2026, en qualité de caissière \(CDD\)\./);
  assert.match(p[1], /Elle quitte notre structure libre de tout engagement/);
  const encore = paragraphs(clean({ ...base, person: { civ: 'M.', name: 'Moussa (exemple)' }, end: '', ongoing: true }));
  assert.match(encore[0], /est employé au sein de notre structure depuis le 1er janvier 2024/);
  assert.ok(!encore.some((x) => /libre de tout engagement/.test(x)));
  assert.equal(checks(clean({ ...base, end: '2023-01-01' })).includes('La date de fin est avant la date de début'), true);
  assert.equal(fileName(a), 'attestation-travail-fatou-sarr-exemple');
});

test('attestations de stage et de formation', () => {
  const s = paragraphs(clean({ type: 'stage', employer: { name: 'ONG (exemple)' }, signer: { name: 'X' }, person: { civ: 'M.', name: 'Ibrahima (exemple)' },
    school: 'UCAD', start: '2026-03-01', end: '2026-05-31', missions: 'saisie comptable, rapprochements bancaires.' }));
  assert.match(s[0], /étudiant à UCAD, a effectué un stage au sein de notre structure du 1er mars 2026 au 31 mai 2026/);
  assert.match(s[1], /il a notamment : saisie comptable, rapprochements bancaires\./);
  const f = paragraphs(clean({ type: 'formation', employer: { name: 'Centre (exemple)' }, signer: { name: 'X' }, person: { name: 'Awa (exemple)' }, course: 'Excel avancé', hours: 24, start: '2026-09-07', end: '2026-09-11', result: 'Validée' }));
  assert.match(f[0], /a suivi la formation « Excel avancé » d’une durée de 24 heures, du 7 septembre 2026 au 11 septembre 2026\./);
  assert.equal(f[1], 'Résultat : Validée.');
  assert.equal(dateFr('2026-10-01'), '1er octobre 2026');
});

test('lettre en wolof : style accepté, consigne envoyée à l’IA, formules récupérées', () => {
  assert.ok(LETTER_STYLES.includes('wo'));
  const msgs = letterMessages({ ...cv, experience: [], education: [], skills: [], languages: [] }, { style: 'wo' });
  assert.match(msgs[0].content, /WOLOF/);
  assert.match(msgs[0].content, /« appel »/);
  const ans = normalizeLetterAnswer({ objet: 'Candidature', corps: 'x'.repeat(120), appel: 'Formule d’appel', politesse: 'Formule finale' });
  assert.equal(ans.salutation, 'Formule d’appel');
  assert.equal(ans.closing, 'Formule finale');
});
