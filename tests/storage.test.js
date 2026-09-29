import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createMemoryStorage, exportJSON, importJSON, createAutosaver, QuotaError } from '../public/js/storage.js';
import { createSampleCV, createEmptyCV } from '../public/js/model.js';

test('sauvegarde, liste, chargement et suppression de plusieurs CV', () => {
  const store = createStore(createMemoryStorage());
  const a = createSampleCV();
  const b = createEmptyCV({ meta: { title: 'Second' } });
  store.save(a);
  store.save(b);
  assert.equal(store.list().length, 2);
  assert.equal(store.load(a.id).identity.lastName, 'Ndiaye');
  a.identity.city = 'Thiès';
  store.save(a);
  assert.equal(store.list().length, 2, 'pas de doublon dans l\'index');
  assert.equal(store.load(a.id).identity.city, 'Thiès');
  store.setActiveId(a.id);
  store.remove(a.id);
  assert.equal(store.load(a.id), null);
  assert.equal(store.getActiveId(), null);
  assert.deepEqual(store.list().map((e) => e.title), ['Second']);
});

test('dupliquer crée un nouveau CV indépendant', () => {
  const store = createStore(createMemoryStorage());
  const a = store.save(createSampleCV());
  const copy = store.duplicate(a.id);
  assert.notEqual(copy.id, a.id);
  assert.match(copy.meta.title, /copie/);
  assert.equal(store.list().length, 2);
});

test('un stockage corrompu ne fait pas planter l\'application', () => {
  const mem = createMemoryStorage();
  mem.setItem('cvapp.v1.index', '{pas du json');
  mem.setItem('cvapp.v1.doc.x', '{');
  const store = createStore(mem);
  assert.deepEqual(store.list(), []);
  assert.equal(store.load('x'), null);
});

test('stockage plein : erreur explicite en français', () => {
  const full = createMemoryStorage();
  full.setItem = () => {
    const e = new Error('quota');
    e.name = 'QuotaExceededError';
    throw e;
  };
  const store = createStore(full);
  assert.throws(() => store.save(createSampleCV()), QuotaError);
});

test('export puis import JSON : aller-retour fidèle, nouvel identifiant', () => {
  const cv = createSampleCV();
  const text = exportJSON(cv);
  const data = JSON.parse(text);
  assert.equal(data.format, 'cv-en-ligne');
  const { cv: back, warnings } = importJSON(text);
  assert.notEqual(back.id, cv.id, 'un import n\'écrase jamais un CV existant');
  assert.deepEqual(warnings, []);
  assert.deepEqual(back.experiences.map((e) => e.position), cv.experiences.map((e) => e.position));
  assert.equal(back.summary, cv.summary);
});

test('import d\'un CV brut (sans enveloppe) et d\'un fichier invalide', () => {
  const { cv } = importJSON(JSON.stringify({ identity: { firstName: 'Fatou' }, experiences: [] }));
  assert.equal(cv.identity.firstName, 'Fatou');
  assert.throws(() => importJSON('pas du json'), /illisible/);
  assert.throws(() => importJSON('[1,2]'), /CV reconnu/);
  assert.throws(() => importJSON('{"a":1}'), /CV reconnu/);
});

test('import : les données douteuses sont signalées', () => {
  const { warnings } = importJSON(JSON.stringify({ identity: { email: 'x@' }, experiences: [{ position: 'A', start: 'hier' }] }));
  assert.ok(warnings.some((w) => w.path === 'identity.email'));
  assert.ok(warnings.some((w) => w.path === 'experiences.0.start'));
});

test('sauvegarde automatique différée (anti-rebond)', async () => {
  const calls = [];
  const saver = createAutosaver((v) => calls.push(v), 20);
  saver.schedule(1);
  saver.schedule(2);
  saver.schedule(3);
  assert.equal(saver.pending, true);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, [3]);
  saver.schedule(4);
  saver.flush();
  assert.deepEqual(calls, [3, 4]);
  assert.equal(saver.pending, false);
});
