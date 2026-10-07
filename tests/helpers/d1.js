// Imitation de l'API Cloudflare D1 au-dessus de node:sqlite (tests du serveur, sans Cloudflare).
// prepare(sql).bind(...).first() / all() / run() — mêmes formes de résultat que D1.
import { DatabaseSync } from 'node:sqlite';

export function createD1(schema = '') {
  const db = new DatabaseSync(':memory:');
  if (schema) db.exec(schema);
  return {
    raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...values) {
          args = values.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
          return api;
        },
        async first() {
          const row = stmt.get(...args);
          return row ? { ...row } : null;
        },
        async all() {
          return { results: stmt.all(...args).map((r) => ({ ...r })) };
        },
        async run() {
          const r = stmt.run(...args);
          return { meta: { changes: Number(r.changes) } };
        },
      };
      return api;
    },
    /** D1 : lot de requêtes atomique (ici : transaction SQLite). */
    async batch(list) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of list) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

/** Base « Devizo » minimale : comptes et secrets d'application d'authentification (mêmes tables). */
export const DEVIZO_SCHEMA = `
CREATE TABLE tenants (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, company TEXT NOT NULL DEFAULT '{}');
CREATE TABLE totp_secrets (owner_key TEXT PRIMARY KEY, secret TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, last_step INTEGER NOT NULL DEFAULT 0);
`;
