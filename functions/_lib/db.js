// Base de données du site CV (Cloudflare D1, liaison « DB ») : offres, commandes, codes de déblocage, réglages,
// statistiques anonymes, sessions et journal de l'administration.
// Le CONTENU DES CV N'EST JAMAIS stocké ici : il reste dans le navigateur du candidat.
// Le schéma est créé automatiquement au premier appel (aucune commande à lancer).

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 0, credits INTEGER NOT NULL DEFAULT 0, templates TEXT NOT NULL DEFAULT '[]',
  features TEXT NOT NULL DEFAULT '[]', description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, offer_id TEXT NOT NULL, offer TEXT NOT NULL, amount INTEGER NOT NULL,
  channel TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', template_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', code TEXT, admin TEXT, note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, decided_at TEXT);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at);
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY, offer_id TEXT NOT NULL DEFAULT '', offer_name TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL,
  templates TEXT NOT NULL DEFAULT '[]', features TEXT NOT NULL DEFAULT '[]', credits INTEGER, expires_at TEXT,
  order_id TEXT, note TEXT NOT NULL DEFAULT '', revoked INTEGER NOT NULL DEFAULT 0, uses INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, redeemed_at TEXT, last_used_at TEXT);
CREATE TABLE IF NOT EXISTS events (day TEXT NOT NULL, name TEXT NOT NULL, key TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name, key));
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_challenges (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL, method TEXT NOT NULL,
  code_hash TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, admin TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS portfolios (slug TEXT PRIMARY KEY, key_hash TEXT NOT NULL, data TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

/** Les 4 types de pass. */
export const OFFER_KINDS = {
  pass: 'Pass à durée (tous les modèles premium pendant N jours)',
  template: 'Modèle à l\'unité (un modèle premium, sans limite de durée)',
  download: 'Crédits de téléchargement (N PDF / Word avec les modèles premium)',
  subscription: 'Abonnement mensuel renouvelable (même code, prolongé à chaque paiement)',
};

export const FEATURES = { word: 'Export Word (.docx) des modèles premium' };

/** Réglages par défaut : monétisation DÉSACTIVÉE tant que l'administrateur ne l'active pas. */
export const DEFAULT_SETTINGS = {
  monetization: false,
  premium_templates: ['prestige', 'corporate', 'nordique', 'sante', 'atelier', 'goree', 'diplomate', 'sahel', 'baobab', 'saint-louis', 'magazine', 'ingenieur'],
  hidden_templates: [],
  payment: {
    wave: '',
    orange_money: '',
    instructions: 'Envoyez le montant exact avec la référence de la commande en commentaire. Votre code est délivré après vérification, en général sous une heure (8 h – 21 h).',
  },
  announcement: '',
  order_days_kept: 180,
};

/** Offres d'exemple créées DÉSACTIVÉES : l'administrateur ajuste prix et contenu puis les active. */
export const SEED_OFFERS = [
  { id: 'pass-30', name: 'Pass Premium 30 jours', kind: 'pass', price: 2000, days: 30, credits: 0, templates: ['*'], features: ['word'], sort: 1,
    description: 'Tous les modèles premium et l\'export Word pendant 30 jours, téléchargements illimités.' },
  { id: 'modele-unite', name: 'Un modèle premium', kind: 'template', price: 500, days: 0, credits: 0, templates: [], features: [], sort: 2,
    description: 'Le modèle premium de votre choix, pour toujours (PDF illimités avec ce modèle).' },
  { id: 'pack-3', name: 'Pack 3 téléchargements', kind: 'download', price: 1000, days: 0, credits: 3, templates: ['*'], features: ['word'], sort: 3,
    description: '3 téléchargements PDF ou Word avec n\'importe quel modèle premium.' },
  { id: 'abonnement', name: 'Abonnement mensuel', kind: 'subscription', price: 1500, days: 30, credits: 0, templates: ['*'], features: ['word'], sort: 4,
    description: 'Tous les modèles premium et l\'export Word, renouvelable chaque mois avec le même code.' },
];

const ready = new WeakMap();

/** Crée les tables (une fois par instance) et les données initiales si la base est neuve. */
export async function ensureSchema(db) {
  if (ready.get(db)) return;
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run();
  const count = await db.prepare('SELECT COUNT(*) AS n FROM offers').first();
  if (!count || !count.n) {
    const now = new Date().toISOString();
    for (const o of SEED_OFFERS) {
      await db.prepare('INSERT OR IGNORE INTO offers (id, name, kind, price, days, credits, templates, features, description, active, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
        .bind(o.id, o.name, o.kind, o.price, o.days, o.credits, JSON.stringify(o.templates), JSON.stringify(o.features), o.description, o.sort, now).run();
    }
  }
  ready.set(db, true);
}

const parse = (s, fallback) => {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

export async function getSettings(db) {
  const rows = (await db.prepare('SELECT key, value FROM settings').all()).results || [];
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) if (r.key in out) out[r.key] = parse(r.value, out[r.key]);
  return out;
}

export async function saveSetting(db, key, value) {
  await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, JSON.stringify(value)).run();
}

export function offerFromRow(r) {
  return {
    id: r.id, name: r.name, kind: r.kind, price: r.price, days: r.days, credits: r.credits,
    templates: parse(r.templates, []), features: parse(r.features, []), description: r.description, active: Boolean(r.active), sort: r.sort,
  };
}

export function codeFromRow(r) {
  return {
    code: r.code, offer_id: r.offer_id, offer_name: r.offer_name, kind: r.kind, templates: parse(r.templates, []), features: parse(r.features, []),
    credits: r.credits === null || r.credits === undefined ? null : Number(r.credits), expires_at: r.expires_at || null, order_id: r.order_id || null,
    note: r.note, revoked: Boolean(r.revoked), uses: r.uses, created_at: r.created_at, redeemed_at: r.redeemed_at, last_used_at: r.last_used_at,
  };
}

export async function audit(db, admin, action, target = '', detail = '') {
  await db.prepare('INSERT INTO audit (admin, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(admin, action, String(target).slice(0, 200), String(detail).slice(0, 500), new Date().toISOString()).run();
}

/** Limiteur simple (fenêtre fixe) : lève 429 au-delà de `max` appels par `seconds`. */
export async function rateLimit(db, key, max, seconds) {
  const now = new Date();
  const row = await db.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').bind(key).first();
  if (!row || row.reset_at < now.toISOString()) {
    await db.prepare('INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at')
      .bind(key, new Date(now.getTime() + seconds * 1000).toISOString()).run();
    return;
  }
  if (row.count >= max) {
    const err = new Error('Trop de tentatives : réessayez dans quelques minutes.');
    err.status = 429;
    throw err;
  }
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
}
