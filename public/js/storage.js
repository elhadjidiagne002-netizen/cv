// Sauvegarde locale (localStorage) de plusieurs CV + export / import JSON.
// Les données ne quittent jamais le navigateur. Le stockage est injectable (tests sous Node).

import { normalizeCV, validateCV, uid, cloneCV, SCHEMA_VERSION } from './model.js';

const PREFIX = 'cvapp.v1.';
const INDEX_KEY = `${PREFIX}index`;
const ACTIVE_KEY = `${PREFIX}active`;
const docKey = (id) => `${PREFIX}doc.${id}`;

/** Stockage en mémoire, même interface que localStorage (tests, navigation privée bloquée). */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
  };
}

function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = `${PREFIX}probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return createMemoryStorage();
  }
}

export class QuotaError extends Error {
  constructor() {
    super('Espace de stockage du navigateur plein : retirez la photo ou exportez puis supprimez d\'anciens CV.');
    this.name = 'QuotaError';
  }
}

/** Crée un gestionnaire de CV lié à un stockage. */
export function createStore(storage = defaultStorage()) {
  const readJSON = (key, fallback) => {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) throw new QuotaError();
      throw e;
    }
  };

  const store = {
    /** Liste résumée des CV : [{ id, title, updatedAt, templateId }], plus récent d'abord. */
    list() {
      const index = readJSON(INDEX_KEY, []);
      return (Array.isArray(index) ? index : []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },
    load(id) {
      const raw = readJSON(docKey(id), null);
      return raw ? normalizeCV(raw) : null;
    },
    save(cv) {
      const doc = normalizeCV(cv);
      doc.meta.updatedAt = new Date().toISOString();
      write(docKey(doc.id), doc);
      const index = readJSON(INDEX_KEY, []).filter((e) => e && e.id !== doc.id);
      index.push({ id: doc.id, title: doc.meta.title, updatedAt: doc.meta.updatedAt, templateId: doc.meta.templateId });
      write(INDEX_KEY, index);
      cv.meta.updatedAt = doc.meta.updatedAt;
      return doc;
    },
    remove(id) {
      storage.removeItem(docKey(id));
      write(INDEX_KEY, readJSON(INDEX_KEY, []).filter((e) => e && e.id !== id));
      if (store.getActiveId() === id) storage.removeItem(ACTIVE_KEY);
    },
    duplicate(id) {
      const cv = store.load(id);
      if (!cv) return null;
      const copy = cloneCV(cv);
      copy.id = uid('cv');
      copy.meta.title = `${cv.meta.title} (copie)`;
      copy.meta.createdAt = new Date().toISOString();
      return store.save(copy);
    },
    getActiveId() {
      return storage.getItem(ACTIVE_KEY);
    },
    setActiveId(id) {
      storage.setItem(ACTIVE_KEY, id);
    },
  };
  return store;
}

/** Sérialise un CV pour l'export (fichier .json lisible). */
export function exportJSON(cv) {
  return JSON.stringify({ format: 'cv-en-ligne', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), cv }, null, 2);
}

/**
 * Lit un fichier JSON exporté (ou un CV brut). Renvoie un CV normalisé avec un NOUVEL identifiant
 * (un import n'écrase jamais un CV existant). Lève une erreur en français si le fichier est illisible.
 */
export function importJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible : ce n\'est pas un fichier JSON valide.');
  }
  const raw = data && typeof data === 'object' && data.cv ? data.cv : data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (!raw.identity && !raw.meta && !raw.experiences)) {
    throw new Error('Ce fichier ne contient pas de CV reconnu.');
  }
  const cv = normalizeCV(raw);
  cv.id = uid('cv');
  const { errors } = validateCV(cv);
  return { cv, warnings: errors };
}

/** Sauvegarde différée (anti-rebond) : appelle fn au plus une fois par `delay` ms d'inactivité. */
export function createAutosaver(fn, delay = 600) {
  let timer = null;
  let pending = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending !== null) {
      const v = pending;
      pending = null;
      fn(v);
    }
  };
  return {
    schedule(value) {
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    get pending() {
      return pending !== null;
    },
  };
}
