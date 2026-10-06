// Atelier de texte IA (public/js/aitext.js) : ce qui part vers l'IA, masquage des coordonnées,
// consignes par action, nettoyage des réponses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEXT_ACTIONS, MAX_TEXT, kindForPath, maskPersonal, unmaskPersonal, textMessages, normalizeTextAnswer, readTextAnswer,
} from '../public/js/aitext.js';
import { parseAIJson, callAI, AIError } from '../public/js/ai.js';

test('8 actions, identifiants uniques, libellés et aides en français', () => {
  assert.equal(TEXT_ACTIONS.length, 8);
  assert.equal(new Set(TEXT_ACTIONS.map((a) => a.id)).size, 8);
  for (const a of TEXT_ACTIONS) {
    assert.ok(a.label.length > 3 && a.hint.length > 10, a.id);
  }
  assert.deepEqual(TEXT_ACTIONS.map((a) => a.id), ['corriger', 'pro', 'raccourcir', 'developper', 'puces', 'simplifier', 'en', 'fr']);
});

test('kindForPath : nature du texte d\'après le champ édité', () => {
  assert.equal(kindForPath('summary'), 'accroche');
  assert.equal(kindForPath('letter.body'), 'lettre');
  assert.equal(kindForPath('experiences.0.description'), 'missions');
  assert.equal(kindForPath('experiences.12.description'), 'missions');
  assert.equal(kindForPath('education.1.description'), 'description');
  assert.equal(kindForPath('projects.0.description'), 'description');
  assert.equal(kindForPath(''), 'libre');
  assert.equal(kindForPath(undefined), 'libre');
});

test('maskPersonal masque e-mails et téléphones (Sénégal, France, international), puis unmask les remet', () => {
  const src = 'Contact : awa.diop@exemple.sn, tél. 77 123 45 67 ou +221 33 821 00 00, en France 06 12 34 56 78, US +1 202 555 0187.';
  const { masked, map } = maskPersonal(src);
  for (const v of ['awa.diop@exemple.sn', '77 123 45 67', '+221 33 821 00 00', '06 12 34 56 78', '+1 202 555 0187']) {
    assert.ok(!masked.includes(v), `${v} doit être masqué : ${masked}`);
    assert.ok(map.includes(v), `${v} doit être dans la table`);
  }
  assert.match(masked, /⟦1⟧/);
  assert.equal(unmaskPersonal(masked, map), src);
});

test('maskPersonal ne touche ni aux montants, ni aux dates, ni aux pourcentages, ni aux chiffres d\'un CV', () => {
  const src = 'Chiffre d\'affaires +15 % en 2023 ; 3 000 000 FCFA gérés ; équipe de 12 personnes ; 09/2019 – 06/2023 ; 250 clients.';
  const { masked, map } = maskPersonal(src);
  assert.equal(masked, src);
  assert.equal(map.length, 0);
});

test('unmaskPersonal laisse un repère inconnu tel quel (le modèle ne peut pas créer de coordonnées)', () => {
  assert.equal(unmaskPersonal('Écrire à ⟦1⟧ ou ⟦7⟧', ['a@b.sn']), 'Écrire à a@b.sn ou ⟦7⟧');
});

test('textMessages : seul le texte part (borné), avec la consigne de l\'action et les règles anti-invention', () => {
  const texte = 'Gestion de la caisse et des stocks.';
  const msgs = textMessages('developper', texte, { kind: 'missions' });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, 'system');
  assert.equal(msgs[1].role, 'user');
  assert.equal(msgs[1].content, texte);                        // rien d'autre que le texte
  assert.match(msgs[0].content, /n'invente aucun fait/);
  assert.match(msgs[0].content, /\[nombre de clients\]/);      // consigne « développer » : repères à compléter
  assert.match(msgs[0].content, /missions et réalisations/);   // nature du texte
  assert.match(msgs[0].content, /⟦1⟧/);                        // garder les repères masqués
  assert.match(msgs[0].content, /"texte"/);                    // format JSON demandé
  assert.equal(textMessages('corriger', 'x'.repeat(MAX_TEXT + 500))[1].content.length, MAX_TEXT);
});

test('textMessages : chaque action a sa consigne propre ; action inconnue refusée', () => {
  const sys = (id) => textMessages(id, 'Texte de test.')[0].content;
  assert.match(sys('corriger'), /UNIQUEMENT l'orthographe/);
  assert.match(sys('raccourcir'), /40 %/);
  assert.match(sys('puces'), /verbe d'action/);
  assert.match(sys('en'), /anglais professionnel/);
  assert.match(sys('fr'), /français professionnel/);
  assert.equal(new Set(TEXT_ACTIONS.map((a) => sys(a.id))).size, TEXT_ACTIONS.length);
  assert.throws(() => textMessages('pirater', 'x'), /Action inconnue/);
});

test('normalizeTextAnswer : réponse JSON du modèle (même entourée de texte) → texte + remarques bornées', () => {
  const brut = 'Voici le résultat :\n```json\n{"texte": "Gérer la caisse.\\nSuivre les stocks.", "remarques": ["Ajoutez un chiffre.", "", "a", "b", "c"]}\n```';
  const ans = normalizeTextAnswer(parseAIJson(brut));
  assert.equal(ans.text, 'Gérer la caisse.\nSuivre les stocks.');
  assert.deepEqual(ans.notes, ['Ajoutez un chiffre.', 'a', 'b']);
  assert.equal(normalizeTextAnswer({ texte: '   ' }), null);
  assert.equal(normalizeTextAnswer(null), null);
  assert.deepEqual(normalizeTextAnswer({ text: 'ok' }), { text: 'ok', notes: [] });
});

test('chaîne complète : masquer → (modèle) → démasquer redonne les vraies coordonnées', () => {
  const { masked, map } = maskPersonal('Joignable au 78 555 44 33 ou sur fatou.ndiaye@mail.com.');
  // Le modèle renvoie le texte retravaillé en conservant les repères.
  const reponse = JSON.stringify({ texte: masked.replace('Joignable au', 'Vous pouvez me joindre au'), remarques: [] });
  const ans = normalizeTextAnswer(parseAIJson(reponse));
  assert.equal(unmaskPersonal(ans.text, map), 'Vous pouvez me joindre au 78 555 44 33 ou sur fatou.ndiaye@mail.com.');
});

test('réponses réelles des modèles : retours à la ligne bruts dans le JSON, texte brut, JSON tronqué, appel en erreur', async () => {
  // Cause de la panne en production : le modèle met de VRAIS retours à la ligne dans la chaîne JSON.
  const brut = '{"texte": "Gérer la caisse.\nSuivre les stocks.\n\tCommander", "remarques": ["Ajoutez un chiffre."]}'.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  assert.ok(brut.includes('\n'), 'le test contient bien un vrai retour à la ligne');
  assert.deepEqual(readTextAnswer(brut, parseAIJson), { text: 'Gérer la caisse.\nSuivre les stocks.\n\tCommander', notes: ['Ajoutez un chiffre.'] });
  assert.deepEqual(parseAIJson('```json\n{"objet": "A", "corps": "ligne 1\nligne 2"}\n```'.replace('1\\nl', '1\nl')), { objet: 'A', corps: 'ligne 1\nligne 2' });
  // Le modèle a ignoré le format : on garde son texte (sans les balises de code).
  assert.deepEqual(readTextAnswer('```\nComptable rigoureux, 5 ans d’expérience.\n```', parseAIJson), { text: 'Comptable rigoureux, 5 ans d’expérience.', notes: [] });
  // JSON tronqué (réponse coupée) : rien plutôt qu'un morceau de JSON collé dans le CV.
  assert.equal(readTextAnswer('{"texte": "Début du texte coupé', parseAIJson), null);
  assert.equal(readTextAnswer('', parseAIJson), null);
  // Erreur du service : la raison donnée par le serveur est montrée (diagnostic à distance).
  await assert.rejects(callAI([{ role: 'user', content: 'x' }], { fetchImpl: async () => new Response(JSON.stringify({ error: 'Assistant indisponible', detail: 'model does not exist' }), { status: 500 }) }),
    (e) => e instanceof AIError && /indisponible/.test(e.message) && /model does not exist/.test(e.message));
});
