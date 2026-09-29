// Offres payantes côté candidat (public/js/premium.js) : droits par modèle, stockage local, configuration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_CONFIG, loadConfig, isPremium, isHidden, cheapest, fcfa, access, usable,
  listEntitlements, saveEntitlement, removeEntitlement, listOrders, saveOrder, forgetOrder,
} from '../public/js/premium.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

const cfg = { ...FREE_CONFIG, configured: true, monetization: true, premium_templates: ['prestige', 'goree'], hidden_templates: ['vieux'],
  offers: [{ id: 'a', price: 2000 }, { id: 'b', price: 500 }, { id: 'c', price: 0 }] };
const NOW = '2026-09-29T12:00:00.000Z';

test('sans monétisation (ou sans serveur), tout est gratuit', () => {
  assert.deepEqual(access(FREE_CONFIG, 'prestige'), { free: true });
  assert.deepEqual(access({ ...cfg, monetization: false }, 'prestige'), { free: true });
  assert.deepEqual(access(cfg, 'classique'), { free: true }, 'modèle non premium');
  assert.equal(isPremium(cfg, 'prestige'), true);
  assert.equal(isHidden(cfg, 'vieux'), true);
  assert.equal(isHidden(cfg, 'prestige'), false);
});

test('prix « dès » : plus petite offre payante ; montant en FCFA', () => {
  assert.equal(cheapest(cfg), 500);
  assert.equal(cheapest(FREE_CONFIG), 0);
  assert.equal(fcfa(2000), '2 000 FCFA');
});

test('droits : pass illimité avant crédits, portée par modèle, Word seulement si inclus', () => {
  const pass = { code: 'P', kind: 'pass', templates: ['*'], features: [], credits: null, expires_at: '2026-10-29T00:00:00.000Z' };
  const unit = { code: 'U', kind: 'template', templates: ['goree'], features: [], credits: null, expires_at: null };
  const credits = { code: 'C', kind: 'download', templates: ['*'], features: ['word'], credits: 2, expires_at: null };
  assert.equal(access(cfg, 'prestige', 'pdf', []), null, 'déblocage nécessaire');
  assert.deepEqual(access(cfg, 'prestige', 'pdf', [credits, pass], NOW), { ent: pass, consume: false });
  assert.deepEqual(access(cfg, 'prestige', 'docx', [credits, pass], NOW), { ent: credits, consume: true }, 'le pass sans Word ne couvre pas .docx');
  assert.deepEqual(access(cfg, 'goree', 'docx', [unit], NOW), { ent: unit, consume: false }, 'modèle à l\'unité : Word compris');
  assert.equal(access(cfg, 'prestige', 'pdf', [unit], NOW), null, 'modèle à l\'unité : pas les autres modèles');
});

test('codes expirés, épuisés ou révoqués : inutilisables', () => {
  assert.equal(usable({ code: 'X', expires_at: '2026-09-01T00:00:00.000Z', credits: null }, NOW), false);
  assert.equal(usable({ code: 'X', credits: 0 }, NOW), false);
  assert.equal(usable({ code: 'X', valid: false }, NOW), false);
  assert.equal(usable({ code: 'X', credits: 1, expires_at: null }, NOW), true);
  const expired = { code: 'E', kind: 'pass', templates: ['*'], features: [], credits: null, expires_at: '2026-01-01T00:00:00.000Z' };
  assert.equal(access(cfg, 'prestige', 'pdf', [expired], NOW), null);
});

test('stockage local : codes et commandes (remplacement, suppression, 10 commandes au plus)', () => {
  const s = memoryStorage();
  assert.deepEqual(listEntitlements(s), []);
  saveEntitlement({ code: 'A', credits: 3 }, s);
  saveEntitlement({ code: 'A', credits: 2 }, s);
  saveEntitlement({ code: 'B' }, s);
  assert.deepEqual(listEntitlements(s).map((e) => [e.code, e.credits]), [['A', 2], ['B', undefined]]);
  removeEntitlement('A', s);
  assert.deepEqual(listEntitlements(s).map((e) => e.code), ['B']);
  s.setItem('cvapp.v1.entitlements', '{corrompu');
  assert.deepEqual(listEntitlements(s), [], 'données illisibles : liste vide');
  for (let i = 0; i < 12; i += 1) saveOrder({ reference: `CV${i}` }, s);
  assert.equal(listOrders(s).length, 10);
  forgetOrder('CV11', s);
  assert.ok(!listOrders(s).some((o) => o.reference === 'CV11'));
});

test('configuration : réponse du serveur mémorisée, dernière connue hors ligne, sinon gratuit', async () => {
  const s = memoryStorage();
  const ok = async () => ({ ok: true, json: async () => ({ configured: true, monetization: true, premium_templates: ['prestige'] }) });
  const down = async () => { throw new Error('hors ligne'); };
  const notFound = async () => ({ ok: false, status: 404 });
  assert.equal((await loadConfig({ fetchImpl: down, storage: memoryStorage() })).monetization, false);
  assert.equal((await loadConfig({ fetchImpl: notFound, storage: memoryStorage() })).monetization, false);
  const c = await loadConfig({ fetchImpl: ok, storage: s });
  assert.equal(c.monetization, true);
  assert.deepEqual(c.hidden_templates, [], 'valeurs par défaut complétées');
  assert.equal((await loadConfig({ fetchImpl: down, storage: s })).monetization, true, 'dernière configuration connue');
});
