// Cycle 8 : serveur (Pages Functions) — connexion admin avec le compte Devizo, offres, commandes Wave / Orange Money,
// codes de déblocage, crédits, réglages, statistiques anonymes, sécurité (CSRF, limites, minimisation des données).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, normalizePhone, codeFieldsFor, codeState, whatsappLink } from '../functions/_lib/api.js';
import { hashPassword, verifyPassword, totpAt, verifyTotp, base32Decode } from '../functions/_lib/devizo.js';
import { createD1, DEVIZO_SCHEMA } from './helpers/d1.js';

const ORIGIN = 'https://cv-en-ligne.pages.dev';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

async function setup({ totp = true, admins = 'admin@nexusmarket.sn', extra = {} } = {}) {
  const DB = createD1();
  const AUTH_DB = createD1(DEVIZO_SCHEMA);
  await AUTH_DB.prepare('INSERT INTO tenants (id, email, password_hash) VALUES (?, ?, ?)').bind('t1', 'admin@nexusmarket.sn', await hashPassword('Mot-de-passe-1', 1000)).run();
  await AUTH_DB.prepare('INSERT INTO tenants (id, email, password_hash) VALUES (?, ?, ?)').bind('t2', 'artisan@example.com', await hashPassword('Autre-mdp-22', 1000)).run();
  if (totp) await AUTH_DB.prepare('INSERT INTO totp_secrets (owner_key, secret, enabled) VALUES (?, ?, 1)').bind('t:t1', SECRET).run();
  const env = { DB, AUTH_DB, ADMIN_EMAILS: admins, ...extra };
  let cookie = '';
  const call = async (method, path, body, { headers = {}, ip = '1.1.1.1' } = {}) => {
    const init = { method, headers: { origin: ORIGIN, 'cf-connecting-ip': ip, ...headers } };
    if (cookie) init.headers.cookie = cookie;
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers['content-type'] = 'application/json';
    }
    const res = await handle(new Request(`${ORIGIN}${path}`, init), env);
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, res };
  };
  const loginAdmin = async () => {
    const r1 = await call('POST', '/api/admin/login', { email: 'admin@nexusmarket.sn', password: 'Mot-de-passe-1' });
    assert.equal(r1.status, 200, JSON.stringify(r1.data));
    if (!r1.data.need_code) return;
    const code = await totpAt(SECRET, Math.floor(Date.now() / 30_000));
    const r2 = await call('POST', '/api/admin/login/code', { challenge: r1.data.challenge, code });
    assert.equal(r2.status, 200, JSON.stringify(r2.data));
  };
  return { env, call, loginAdmin, DB, AUTH_DB, cookie: () => cookie };
}

/** Ouvre les ventes : monétisation, numéros Wave / OM, offres d'exemple activées. */
async function openShop(s) {
  await s.loginAdmin();
  assert.equal((await s.call('PUT', '/api/admin/settings', { monetization: true, payment: { wave: '+221 77 000 00 01', orange_money: '+221 78 000 00 02', instructions: 'Référence en commentaire.' } })).status, 200);
  const { data } = await s.call('GET', '/api/admin/offers');
  for (const o of data.offers) assert.equal((await s.call('PUT', `/api/admin/offers/${o.id}`, { ...o, active: true })).status, 200);
}

// ——— Compte Devizo ———

test('mot de passe au format Devizo (PBKDF2) et codes TOTP (RFC 6238)', async () => {
  const h = await hashPassword('secret-123', 1000);
  assert.match(h, /^pbkdf2\$1000\$/);
  assert.equal(await verifyPassword('secret-123', h), true);
  assert.equal(await verifyPassword('secret-124', h), false);
  assert.equal(await verifyPassword('x', 'md5$abc'), false);
  // Vecteur de test RFC 6238 (SHA-1, secret « 12345678901234567890 ») : T = 59 s → 94287082 → 6 chiffres 287082.
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(base32Decode(rfcSecret).length, 20);
  assert.equal(await totpAt(rfcSecret, 1), '287082');
  const now = 59_000;
  assert.equal(await verifyTotp(rfcSecret, '287082', 0, now), 1);
  assert.equal(await verifyTotp(rfcSecret, '287082', 1, now), null, 'anti-rejeu');
});

test('sans base configurée : site gratuit (config) et API d\'administration indisponible, sans erreur', async () => {
  const res = await handle(new Request(`${ORIGIN}/api/config`), {});
  assert.equal(res.status, 200);
  const cfg = await res.json();
  assert.equal(cfg.configured, false);
  assert.equal(cfg.monetization, false);
  const admin = await handle(new Request(`${ORIGIN}/api/admin/me`), {});
  assert.equal(admin.status, 503);
});

test('connexion admin : compte Devizo, liste ADMIN_EMAILS, application d\'authentification, anti-rejeu', async () => {
  const s = await setup();
  assert.equal((await s.call('GET', '/api/admin/me')).status, 401);
  assert.equal((await s.call('POST', '/api/admin/login', { email: 'admin@nexusmarket.sn', password: 'faux' })).status, 401);
  const notAdmin = await s.call('POST', '/api/admin/login', { email: 'artisan@example.com', password: 'Autre-mdp-22' });
  assert.equal(notAdmin.status, 403);
  assert.match(notAdmin.data.error, /pas administrateur/);
  const r1 = await s.call('POST', '/api/admin/login', { email: 'ADMIN@nexusmarket.sn', password: 'Mot-de-passe-1' });
  assert.equal(r1.data.need_code, true);
  assert.equal(r1.data.method, 'totp');
  assert.equal((await s.call('POST', '/api/admin/login/code', { challenge: r1.data.challenge, code: '000000' })).status, 401);
  const code = await totpAt(SECRET, Math.floor(Date.now() / 30_000));
  const ok = await s.call('POST', '/api/admin/login/code', { challenge: r1.data.challenge, code });
  assert.equal(ok.status, 200);
  assert.match(ok.res.headers.get('set-cookie'), /cv_admin=.+; Path=\/api\/admin; HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await s.call('GET', '/api/admin/me')).data.email, 'admin@nexusmarket.sn');
  // Le même code ne resservira pas (dernier pas partagé avec Devizo).
  const again = await s.call('POST', '/api/admin/login', { email: 'admin@nexusmarket.sn', password: 'Mot-de-passe-1' });
  assert.equal((await s.call('POST', '/api/admin/login/code', { challenge: again.data.challenge, code })).status, 401);
  assert.ok((await s.AUTH_DB.prepare('SELECT last_step FROM totp_secrets').first()).last_step > 0);
  // Déconnexion.
  await s.call('POST', '/api/admin/logout', {});
  assert.equal((await s.call('GET', '/api/admin/me')).status, 401);
});

test('connexion sans application d\'authentification : refusée, sauf dérogation explicite', async () => {
  const s = await setup({ totp: false });
  const r = await s.call('POST', '/api/admin/login', { email: 'admin@nexusmarket.sn', password: 'Mot-de-passe-1' });
  assert.equal(r.status, 403);
  assert.match(r.data.error, /application d'authentification/);
  const lax = await setup({ totp: false, extra: { ADMIN_PASSWORD_ONLY: '1' } });
  const ok = await lax.call('POST', '/api/admin/login', { email: 'admin@nexusmarket.sn', password: 'Mot-de-passe-1' });
  assert.equal(ok.status, 200);
  assert.equal((await lax.call('GET', '/api/admin/me')).status, 200);
});

test('compte Devizo suspendu refusé ; trop d\'essais bloqués', async () => {
  const s = await setup();
  await s.AUTH_DB.prepare('UPDATE tenants SET company = ? WHERE id = ?').bind('{"suspended_at":"2026-01-01"}', 't1').run();
  assert.equal((await s.call('POST', '/api/admin/login', { email: 'admin@nexusmarket.sn', password: 'Mot-de-passe-1' })).status, 403);
  let last;
  for (let i = 0; i < 9; i += 1) last = await s.call('POST', '/api/admin/login', { email: 'x@y.sn', password: 'z' }, { ip: '9.9.9.9' });
  assert.equal(last.status, 429);
});

// ——— Configuration publique et offres ———

test('monétisation désactivée par défaut ; 4 types de pass d\'exemple créés inactifs', async () => {
  const s = await setup();
  const cfg = (await s.call('GET', '/api/config')).data;
  assert.equal(cfg.monetization, false);
  assert.deepEqual(cfg.premium_templates, []);
  await s.loginAdmin();
  const { offers, kinds } = (await s.call('GET', '/api/admin/offers')).data;
  assert.deepEqual(offers.map((o) => o.kind).sort(), ['download', 'pass', 'subscription', 'template']);
  assert.ok(offers.every((o) => !o.active));
  assert.equal(Object.keys(kinds).length, 4);
  assert.equal((await s.call('POST', '/api/orders', { offer_id: 'pass-30', channel: 'wave', phone: '771234567' })).status, 409, 'pas de vente tant que c\'est fermé');
});

test('offres : création, validation des champs, modification, suppression / désactivation', async () => {
  const s = await setup();
  await s.loginAdmin();
  assert.equal((await s.call('POST', '/api/admin/offers', { name: 'Pass 7 jours', kind: 'pass', price: 700 })).status, 400, 'durée obligatoire');
  assert.equal((await s.call('POST', '/api/admin/offers', { name: 'X', kind: 'inconnu', price: 1 })).status, 400);
  const created = await s.call('POST', '/api/admin/offers', { name: 'Pass 7 jours', kind: 'pass', price: 700, days: 7, features: ['word', 'pirate'], active: true });
  assert.equal(created.status, 200);
  assert.equal(created.data.offer.id, 'pass-7-jours');
  assert.deepEqual(created.data.offer.features, ['word']);
  const upd = await s.call('PUT', '/api/admin/offers/pass-7-jours', { ...created.data.offer, price: 900 });
  assert.equal(upd.data.offer.price, 900);
  assert.equal((await s.call('DELETE', '/api/admin/offers/pass-7-jours')).data.ok, true);
  assert.equal((await s.call('GET', '/api/admin/offers')).data.offers.some((o) => o.id === 'pass-7-jours'), false);
});

// ——— Parcours d'achat ———

test('achat Wave : commande, validation par l\'admin, code, déblocage, lien WhatsApp', async () => {
  const s = await setup();
  await openShop(s);
  const cfg = (await s.call('GET', '/api/config')).data;
  assert.equal(cfg.monetization, true);
  assert.equal(cfg.offers.length, 4);
  assert.ok(cfg.premium_templates.includes('prestige'));
  assert.equal(cfg.payment.wave, '+221 77 000 00 01');
  assert.equal((await s.call('POST', '/api/orders', { offer_id: 'pass-30', channel: 'wave', phone: '12' })).status, 400);
  const order = await s.call('POST', '/api/orders', { offer_id: 'pass-30', channel: 'wave', phone: '77 123 45 67', name: 'Awa' });
  assert.equal(order.status, 201);
  assert.match(order.data.reference, /^CV[A-Z2-9]{6}$/);
  assert.equal(order.data.amount_label, '2 000 FCFA');
  assert.equal(order.data.pay_to, '+221 77 000 00 01');
  // Suivi : le numéro sert de secret.
  assert.equal((await s.call('POST', '/api/orders/status', { reference: order.data.reference, phone: '770000000' })).status, 404);
  assert.equal((await s.call('POST', '/api/orders/status', { reference: order.data.reference, phone: '+221771234567' })).data.status, 'pending');
  const pending = (await s.call('GET', '/api/admin/orders?status=pending')).data.orders;
  assert.equal(pending.length, 1);
  const v = await s.call('POST', `/api/admin/orders/${pending[0].id}/validate`, {});
  assert.match(v.data.code, /^CV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.match(v.data.whatsapp, /^https:\/\/wa\.me\/221771234567\?text=/);
  assert.equal((await s.call('POST', `/api/admin/orders/${pending[0].id}/validate`, {})).status, 409, 'pas de double validation');
  const st = await s.call('POST', '/api/orders/status', { reference: order.data.reference.toLowerCase(), phone: '771234567' });
  assert.equal(st.data.status, 'validated');
  assert.equal(st.data.entitlement.code, v.data.code);
  assert.deepEqual(st.data.entitlement.templates, ['*']);
  assert.ok(st.data.entitlement.expires_at > new Date(Date.now() + 29 * 86400_000).toISOString());
  const red = await s.call('POST', '/api/codes/redeem', { code: v.data.code.toLowerCase() });
  assert.equal(red.data.entitlement.valid, true);
  assert.equal((await s.call('POST', '/api/codes/redeem', { code: 'CV-AAAA-BBBB-CCCC' })).status, 404);
  const ov = (await s.call('GET', '/api/admin/overview')).data;
  assert.equal(ov.revenue.month.amount, 2000);
  assert.equal(ov.active_codes, 1);
});

test('modèle à l\'unité : couvre seulement le modèle acheté ; crédits : décomptés jusqu\'à épuisement', async () => {
  const s = await setup();
  await openShop(s);
  assert.equal((await s.call('POST', '/api/orders', { offer_id: 'modele-unite', channel: 'orange_money', phone: '781112233' })).status, 400, 'modèle obligatoire');
  const o1 = await s.call('POST', '/api/orders', { offer_id: 'modele-unite', channel: 'orange_money', phone: '781112233', template_id: 'baobab' });
  const o2 = await s.call('POST', '/api/orders', { offer_id: 'pack-3', channel: 'wave', phone: '781112233' });
  const orders = (await s.call('GET', '/api/admin/orders?status=pending')).data.orders;
  const byRef = Object.fromEntries(orders.map((o) => [o.reference, o]));
  const unit = (await s.call('POST', `/api/admin/orders/${byRef[o1.data.reference].id}/validate`, {})).data.code;
  const pack = (await s.call('POST', `/api/admin/orders/${byRef[o2.data.reference].id}/validate`, {})).data.code;
  assert.equal((await s.call('POST', '/api/codes/consume', { code: unit, template_id: 'baobab' })).status, 200);
  assert.equal((await s.call('POST', '/api/codes/consume', { code: unit, template_id: 'prestige' })).status, 403);
  for (const left of [2, 1, 0]) {
    const r = await s.call('POST', '/api/codes/consume', { code: pack, template_id: 'magazine', format: 'docx' });
    assert.equal(r.data.entitlement.credits, left);
  }
  const done = await s.call('POST', '/api/codes/consume', { code: pack, template_id: 'magazine' });
  assert.equal(done.status, 410);
  assert.match(done.data.error, /utilisés/);
  // L'admin ajoute 2 crédits (geste commercial) puis désactive le code.
  const ext = await s.call('POST', `/api/admin/codes/${pack}/extend`, { credits: 2 });
  assert.equal(ext.data.code.credits, 2);
  await s.call('POST', `/api/admin/codes/${pack}/revoke`, {});
  assert.equal((await s.call('POST', '/api/codes/redeem', { code: pack })).status, 410);
});

test('abonnement : prolongé depuis l\'échéance ; code offert par l\'admin ; refus de commande', async () => {
  const s = await setup();
  await openShop(s);
  const gift = await s.call('POST', '/api/admin/codes', { offer_id: 'abonnement', note: 'Partenariat école' });
  assert.equal(gift.status, 201);
  const before = (await s.call('GET', `/api/admin/codes?q=${gift.data.code}`)).data.codes[0];
  const ext = await s.call('POST', `/api/admin/codes/${gift.data.code}/extend`, { days: 30 });
  const gain = Date.parse(ext.data.code.expires_at) - Date.parse(before.expires_at);
  assert.ok(Math.abs(gain - 30 * 86400_000) < 5000, 'prolongé à partir de l\'échéance');
  const o = await s.call('POST', '/api/orders', { offer_id: 'pass-30', channel: 'wave', phone: '761234567' });
  const id = (await s.call('GET', '/api/admin/orders?status=pending')).data.orders[0].id;
  await s.call('POST', `/api/admin/orders/${id}/refuse`, { note: 'Paiement non reçu' });
  const st = await s.call('POST', '/api/orders/status', { reference: o.data.reference, phone: '761234567' });
  assert.equal(st.data.status, 'refused');
  assert.equal(st.data.note, 'Paiement non reçu');
  const audit = (await s.call('GET', '/api/admin/audit')).data.audit.map((a) => a.action);
  for (const a of ['connexion', 'réglages modifiés', 'code créé', 'code prolongé', 'commande refusée']) assert.ok(audit.includes(a), a);
});

test('réglages : modèles premium / masqués, annonce ; config publique mise à jour', async () => {
  const s = await setup();
  await openShop(s);
  await s.call('PUT', '/api/admin/settings', { premium_templates: ['prestige', 'magazine', '<script>'], hidden_templates: ['compact'], announcement: 'Promo Tabaski : -20 %' });
  const cfg = (await s.call('GET', '/api/config')).data;
  assert.deepEqual(cfg.premium_templates, ['prestige', 'magazine']);
  assert.deepEqual(cfg.hidden_templates, ['compact']);
  assert.equal(cfg.announcement, 'Promo Tabaski : -20 %');
});

// ——— Sécurité et vie privée ———

test('CSRF : origine étrangère et formulaire non JSON refusés ; pages admin protégées', async () => {
  const s = await setup();
  await s.loginAdmin();
  const foreign = await s.call('PUT', '/api/admin/settings', { monetization: true }, { headers: { origin: 'https://evil.example' } });
  assert.equal(foreign.status, 403);
  const form = await handle(new Request(`${ORIGIN}/api/admin/settings`, { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'monetization=1' }), s.env);
  assert.equal(form.status, 415);
  const s2 = await setup();
  for (const [m, p] of [['GET', '/api/admin/overview'], ['GET', '/api/admin/orders'], ['GET', '/api/admin/codes'], ['GET', '/api/admin/orders.csv']]) {
    assert.equal((await s2.call(m, p)).status, 401, p);
  }
});

test('statistiques anonymes et minimisation : compteurs par jour, téléphones effacés après la durée de conservation', async () => {
  const s = await setup();
  await openShop(s);
  for (const [name, key] of [['visit', ''], ['pdf', 'sobre'], ['pdf', 'sobre'], ['docx', 'prestige']]) {
    assert.equal((await s.call('POST', '/api/events', { name, key })).status, 204);
  }
  assert.equal((await s.call('POST', '/api/events', { name: 'email', key: 'awa@x.sn' })).status, 400);
  const rows = (await s.DB.prepare('SELECT * FROM events WHERE name = ?').bind('pdf').all()).results;
  assert.deepEqual(rows.map((r) => [r.key, r.count]), [['sobre', 2]]);
  const cols = (await s.DB.prepare('PRAGMA table_info(events)').all()).results.map((c) => c.name);
  assert.deepEqual(cols, ['day', 'name', 'key', 'count'], 'aucune colonne d\'identification');
  await s.call('POST', '/api/orders', { offer_id: 'pass-30', channel: 'wave', phone: '771234567', name: 'Awa' });
  await s.DB.prepare('UPDATE orders SET created_at = ?').bind('2025-01-01T00:00:00.000Z').run();
  const ov = (await s.call('GET', '/api/admin/overview')).data;
  assert.ok(ov.top_templates.some((t) => t.key === 'sobre' && t.n === 2));
  const order = await s.DB.prepare('SELECT phone, name FROM orders').first();
  assert.deepEqual(order, { phone: '', name: '' });
});

test('export CSV des commandes (Excel, formules neutralisées) et outils', async () => {
  const s = await setup();
  await openShop(s);
  await s.call('POST', '/api/orders', { offer_id: 'pass-30', channel: 'wave', phone: '771234567', name: '=CMD()' });
  const csv = await s.call('GET', '/api/admin/orders.csv');
  assert.match(csv.res.headers.get('content-type'), /text\/csv/);
  assert.match(csv.data, /^Référence;Date;Offre/);
  const raw = await handle(new Request(`${ORIGIN}/api/admin/orders.csv`, { headers: { cookie: s.cookie() } }), s.env);
  assert.deepEqual([...new Uint8Array(await raw.arrayBuffer()).slice(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 pour Excel');
  assert.match(csv.data, /;'=CMD\(\);/);
  assert.equal(normalizePhone('77 123 45 67'), '221771234567');
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '33612345678');
  assert.equal(normalizePhone('12'), '');
  assert.equal(whatsappLink('', 'x'), '');
  const f = codeFieldsFor({ kind: 'download', credits: 3, days: 0, templates: ['*'], features: [] }, '', '2026-01-01T00:00:00.000Z');
  assert.deepEqual([f.credits, f.expires_at], [3, null]);
  assert.equal(codeState({ revoked: false, expires_at: '2020-01-01', credits: null }).valid, false);
});
