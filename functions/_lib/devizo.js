// Connexion administrateur avec le compte Devizo : même e-mail, même mot de passe, même application
// d'authentification. On LIT la base D1 de Devizo (liaison AUTH_DB) ; seule écriture : l'anti-rejeu des codes
// TOTP (last_step), partagé avec Devizo pour qu'un code ne serve qu'une fois sur les deux sites.
// Algorithmes identiques à devizo/functions/_lib/auth.js (PBKDF2-SHA256) et totp.js (RFC 6238).

import { b64url, fromB64url, timingSafeEqual } from './http.js';

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return b64url(bits);
}

/** Format Devizo : « pbkdf2$<itérations>$<sel>$<empreinte> ». */
export async function hashPassword(password, iterations = 100_000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${b64url(salt)}$${await pbkdf2(password, salt, iterations)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2' || !salt || !hash || !Number(iter)) return false;
  return timingSafeEqual(await pbkdf2(String(password), fromB64url(salt), Number(iter)), hash);
}

// ——— TOTP (RFC 6238 : HMAC-SHA1, pas de 30 s) ———
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function totpAt(secret, step) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8);
  new DataView(msg).setUint32(4, step >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 15;
  const bin = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

/** Code accepté (±30 s) → numéro de pas (anti-rejeu) ; sinon null. */
export async function verifyTotp(secret, code, lastStep = 0, now = Date.now()) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6) return null;
  const step = Math.floor(now / 30_000);
  for (const s of [step, step - 1, step + 1]) {
    if (s <= lastStep) continue;
    if ((await totpAt(secret, s)) === c) return s;
  }
  return null;
}

/** Super-administrateurs : e-mails listés dans ADMIN_EMAILS (même secret que Devizo). */
export function isSuperAdmin(email, env) {
  const list = String(env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(email) && list.includes(String(email).trim().toLowerCase());
}

/**
 * Vérifie e-mail + mot de passe dans la base Devizo. Renvoie { id, email, totp: bool } ou null.
 * Les comptes suspendus dans Devizo sont refusés.
 */
export async function findDevizoAccount(env, email, password) {
  const row = await env.AUTH_DB.prepare('SELECT id, email, password_hash, company FROM tenants WHERE email = ?')
    .bind(String(email).trim().toLowerCase()).first();
  if (!row || !(await verifyPassword(password, row.password_hash))) return null;
  let company = {};
  try {
    company = JSON.parse(row.company || '{}');
  } catch {
    company = {};
  }
  if (company.suspended_at) return { suspended: true };
  const totp = await env.AUTH_DB.prepare('SELECT secret, last_step FROM totp_secrets WHERE owner_key = ? AND enabled = 1')
    .bind(`t:${row.id}`).first().catch(() => null);
  return { id: row.id, email: row.email, totp: Boolean(totp) };
}

/** Contrôle du code de l'application d'authentification Devizo (et marque le pas comme utilisé). */
export async function checkDevizoTotp(env, tenantId, code, now = Date.now()) {
  const key = `t:${tenantId}`;
  const sec = await env.AUTH_DB.prepare('SELECT secret, last_step FROM totp_secrets WHERE owner_key = ? AND enabled = 1').bind(key).first();
  if (!sec) return false;
  const step = await verifyTotp(sec.secret, code, Number(sec.last_step) || 0, now);
  if (step === null) return false;
  await env.AUTH_DB.prepare('UPDATE totp_secrets SET last_step = ? WHERE owner_key = ? AND last_step < ?').bind(step, key, step).run();
  return true;
}
