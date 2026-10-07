// API du site CV (Cloudflare Pages Functions, point d'entrée functions/api/[[path]].js).
// Public : configuration (modèles premium, offres, paiement), commandes Wave / Orange Money, codes de déblocage,
// statistiques anonymes. Administration : connexion avec le compte Devizo, commandes, offres, codes, réglages, journal.
// Aucune donnée de CV ne transite ici. Données personnelles limitées au strict nécessaire du paiement
// (téléphone et nom facultatif de l'acheteur), anonymisées après `order_days_kept` jours.

import {
  HttpError, json, readJson, getCookie, sha256Hex, randomToken, randomCode, clientIp, nowIso, fcfa,
} from './http.js';
import {
  ensureSchema, getSettings, saveSetting, offerFromRow, codeFromRow, audit, rateLimit, OFFER_KINDS, FEATURES, DEFAULT_SETTINGS,
} from './db.js';
import { isSuperAdmin, findDevizoAccount, checkDevizoTotp } from './devizo.js';
import { portfolioRoutes, portfolioAdminRoutes } from './portfolio.js';

const ADMIN_COOKIE = 'cv_admin';
const SESSION_HOURS = 12;
const CHALLENGE_MINUTES = 10;
const EVENT_NAMES = ['visit', 'pdf', 'docx', 'letter_pdf', 'template', 'unlock_view', 'backup'];
const ID_RE = /^[a-z0-9-]{1,60}$/;

// ————————————————————————— Outils —————————————————————————

const addDays = (iso, days) => new Date(new Date(iso).getTime() + days * 86400_000).toISOString();
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

/** Téléphone : chiffres seulement ; 9 chiffres sénégalais → indicatif 221 ajouté. */
export function normalizePhone(v) {
  let d = String(v || '').replace(/\D/g, '').replace(/^00/, '');
  if (d.length === 9 && /^(7[05678]|33)/.test(d)) d = `221${d}`;
  return d.length >= 8 && d.length <= 15 ? d : '';
}

/** Lien WhatsApp pré-rempli pour envoyer le code à l'acheteur. */
export function whatsappLink(phone, text) {
  const d = normalizePhone(phone);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : '';
}

/** État d'un code : valide, révoqué, expiré ou crédits épuisés. */
export function codeState(c, now = nowIso()) {
  if (c.revoked) return { valid: false, reason: 'Ce code a été désactivé.' };
  if (c.expires_at && c.expires_at < now) return { valid: false, reason: 'Ce code a expiré : renouvelez votre pass.' };
  if (c.credits !== null && c.credits <= 0) return { valid: false, reason: 'Tous les téléchargements de ce code ont été utilisés.' };
  return { valid: true };
}

/** Ce que le navigateur du candidat conserve pour débloquer les modèles (vérifié côté serveur à chaque téléchargement à crédits). */
export function entitlement(c, now = nowIso()) {
  const st = codeState(c, now);
  return {
    code: c.code, kind: c.kind, offer_name: c.offer_name, templates: c.templates, features: c.features,
    credits: c.credits, expires_at: c.expires_at, valid: st.valid, reason: st.reason || '',
  };
}

/** Champs du code délivré pour une offre (et le modèle choisi pour une offre « à l'unité »). */
export function codeFieldsFor(offer, templateId = '', now = nowIso()) {
  const days = Number(offer.days) || 0;
  return {
    kind: offer.kind,
    templates: offer.kind === 'template' ? [templateId] : (offer.templates && offer.templates.length ? offer.templates : ['*']),
    features: offer.features || [],
    credits: offer.kind === 'download' ? Math.max(1, Number(offer.credits) || 1) : null,
    expires_at: offer.kind === 'template' ? null : (days > 0 ? addDays(now, days) : null),
  };
}

async function insertCode(db, fields, { offer, orderId = null, note = '' }) {
  const now = nowIso();
  for (let i = 0; i < 5; i += 1) {
    const code = `CV-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;
    const exists = await db.prepare('SELECT 1 FROM codes WHERE code = ?').bind(code).first();
    if (exists) continue;
    await db.prepare(`INSERT INTO codes (code, offer_id, offer_name, kind, templates, features, credits, expires_at, order_id, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(code, offer.id, offer.name, fields.kind, JSON.stringify(fields.templates), JSON.stringify(fields.features),
      fields.credits, fields.expires_at, orderId, clean(note, 300), now).run();
    return code;
  }
  throw new HttpError(500, 'Impossible de générer un code unique.');
}

async function loadCode(db, code) {
  const row = await db.prepare('SELECT * FROM codes WHERE code = ?').bind(clean(code, 40).toUpperCase()).first();
  return row ? codeFromRow(row) : null;
}

async function countEvent(db, name, key = '') {
  const day = nowIso().slice(0, 10);
  await db.prepare('INSERT INTO events (day, name, key, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, name, key) DO UPDATE SET count = count + 1')
    .bind(day, name, key).run();
}

function publicOffer(o) {
  const { active, sort, ...rest } = o;
  return rest;
}

// ————————————————————————— API publique —————————————————————————

async function getConfig({ db }) {
  const s = await getSettings(db);
  const offers = s.monetization
    ? ((await db.prepare('SELECT * FROM offers WHERE active = 1 ORDER BY sort, price').all()).results || []).map(offerFromRow).map(publicOffer)
    : [];
  return json({
    configured: true,
    monetization: Boolean(s.monetization) && offers.length > 0,
    premium_templates: s.monetization ? s.premium_templates : [],
    hidden_templates: s.hidden_templates,
    announcement: s.announcement,
    offers,
    payment: { wave: s.payment.wave, orange_money: s.payment.orange_money, instructions: s.payment.instructions },
  }, 200, { 'cache-control': 'public, max-age=60' });
}

async function createOrder({ db, request }) {
  await rateLimit(db, `order:${clientIp(request)}`, 10, 3600);
  const body = await readJson(request);
  const s = await getSettings(db);
  if (!s.monetization) throw new HttpError(409, 'Les achats ne sont pas ouverts pour le moment : tous les modèles sont gratuits.');
  const row = await db.prepare('SELECT * FROM offers WHERE id = ? AND active = 1').bind(clean(body.offer_id, 60)).first();
  if (!row) throw new HttpError(404, 'Offre introuvable ou retirée.');
  const offer = offerFromRow(row);
  const channel = body.channel === 'orange_money' ? 'orange_money' : body.channel === 'wave' ? 'wave' : '';
  if (!channel) throw new HttpError(400, 'Choisissez Wave ou Orange Money.');
  const payTo = s.payment[channel];
  if (!payTo) throw new HttpError(409, `Le paiement par ${channel === 'wave' ? 'Wave' : 'Orange Money'} n'est pas encore disponible.`);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, 'Numéro de téléphone invalide (celui qui envoie le paiement).');
  let templateId = '';
  if (offer.kind === 'template') {
    templateId = clean(body.template_id, 60);
    if (!ID_RE.test(templateId) || !s.premium_templates.includes(templateId)) throw new HttpError(400, 'Choisissez le modèle premium à débloquer.');
  }
  const id = crypto.randomUUID();
  let reference = '';
  for (let i = 0; i < 5 && !reference; i += 1) {
    const r = `CV${randomCode(6)}`;
    if (!(await db.prepare('SELECT 1 FROM orders WHERE reference = ?').bind(r).first())) reference = r;
  }
  await db.prepare(`INSERT INTO orders (id, reference, offer_id, offer, amount, channel, phone, name, template_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`).bind(id, reference, offer.id, JSON.stringify(offer), offer.price, channel, phone,
    clean(body.name, 80), templateId, nowIso()).run();
  await countEvent(db, 'order', offer.id);
  return json({
    reference, amount: offer.price, amount_label: fcfa(offer.price), channel, pay_to: payTo, instructions: s.payment.instructions, status: 'pending',
  }, 201);
}

async function orderStatus({ db, request }) {
  await rateLimit(db, `status:${clientIp(request)}`, 60, 3600);
  const body = await readJson(request);
  const row = await db.prepare('SELECT * FROM orders WHERE reference = ?').bind(clean(body.reference, 20).toUpperCase()).first();
  // Le numéro de téléphone sert de secret : sans lui, une référence ne révèle rien.
  if (!row || !row.phone || normalizePhone(body.phone) !== row.phone) throw new HttpError(404, 'Commande introuvable : vérifiez la référence et le numéro utilisé.');
  const out = { reference: row.reference, status: row.status, amount_label: fcfa(row.amount) };
  if (row.status === 'validated' && row.code) {
    const c = await loadCode(db, row.code);
    if (c) out.entitlement = entitlement(c);
  }
  if (row.status === 'refused') out.note = row.note;
  return json(out);
}

async function redeem({ db, request }) {
  await rateLimit(db, `redeem:${clientIp(request)}`, 20, 900);
  const body = await readJson(request);
  const c = await loadCode(db, body.code);
  if (!c) throw new HttpError(404, 'Code inconnu : vérifiez-le (lettres et chiffres, tirets compris).');
  const ent = entitlement(c);
  if (!ent.valid) throw new HttpError(410, ent.reason);
  if (!c.redeemed_at) await db.prepare('UPDATE codes SET redeemed_at = ? WHERE code = ?').bind(nowIso(), c.code).run();
  return json({ entitlement: ent });
}

/** Téléchargement d'un modèle premium : vérifie le code et décompte un crédit si le code en a. */
async function consume({ db, request }) {
  await rateLimit(db, `consume:${clientIp(request)}`, 60, 3600);
  const body = await readJson(request);
  const c = await loadCode(db, body.code);
  if (!c) throw new HttpError(404, 'Code inconnu.');
  const st = codeState(c);
  if (!st.valid) throw new HttpError(410, st.reason);
  const templateId = clean(body.template_id, 60);
  if (!c.templates.includes('*') && !c.templates.includes(templateId)) throw new HttpError(403, 'Ce code ne couvre pas ce modèle.');
  const format = body.format === 'docx' ? 'docx' : 'pdf';
  if (format === 'docx' && !c.features.includes('word') && c.kind !== 'template') throw new HttpError(403, 'Ce code ne comprend pas l\'export Word.');
  if (c.credits !== null) {
    const res = await db.prepare('UPDATE codes SET credits = credits - 1, uses = uses + 1, last_used_at = ? WHERE code = ? AND credits > 0').bind(nowIso(), c.code).run();
    if (!res.meta || !res.meta.changes) throw new HttpError(410, 'Tous les téléchargements de ce code ont été utilisés.');
  } else {
    await db.prepare('UPDATE codes SET uses = uses + 1, last_used_at = ? WHERE code = ?').bind(nowIso(), c.code).run();
  }
  await countEvent(db, 'premium_download', templateId);
  return json({ entitlement: entitlement(await loadCode(db, c.code)) });
}

/** Statistiques anonymes : un compteur par jour, sans adresse IP ni identifiant. */
async function event({ db, request }) {
  const body = await readJson(request, 500);
  const name = String(body.name || '');
  if (!EVENT_NAMES.includes(name)) throw new HttpError(400, 'Événement inconnu.');
  const key = /^[a-z0-9-]{0,40}$/.test(String(body.key || '')) ? String(body.key || '') : '';
  await countEvent(db, name, key);
  return new Response(null, { status: 204 });
}

// ————————————————————————— Administration : connexion —————————————————————————

function sessionCookie(token, maxAge = SESSION_HOURS * 3600) {
  return `${ADMIN_COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function createAdminSession(db, email) {
  const token = randomToken(32);
  await db.prepare('INSERT INTO admin_sessions (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), email, new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(), nowIso()).run();
  await audit(db, email, 'connexion');
  return json({ ok: true, email }, 200, { 'set-cookie': sessionCookie(token) });
}

async function sendEmailCode(env, to, code) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'CV en ligne <no-reply@nexusmarket.sn>',
      to: [to],
      subject: `Code de connexion à l'administration CV en ligne : ${code}`,
      html: `<p>Votre code de connexion :</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p><p>Valable ${CHALLENGE_MINUTES} minutes. Si vous n'essayez pas de vous connecter, changez votre mot de passe Devizo.</p>`,
    }),
  });
  return res.ok;
}

async function login({ db, env, request }) {
  if (!env.AUTH_DB) throw new HttpError(503, 'Connexion indisponible : la base des comptes Devizo n\'est pas reliée (liaison AUTH_DB).');
  const body = await readJson(request);
  const email = clean(body.email, 200).toLowerCase();
  await rateLimit(db, `login:${clientIp(request)}`, 20, 900);
  await rateLimit(db, `login-email:${email}`, 8, 900);
  const account = await findDevizoAccount(env, email, String(body.password || ''));
  if (!account) throw new HttpError(401, 'E-mail ou mot de passe incorrect (identifiants de votre compte Devizo).');
  if (account.suspended) throw new HttpError(403, 'Ce compte Devizo est suspendu.');
  if (!isSuperAdmin(email, env)) throw new HttpError(403, 'Ce compte Devizo n\'est pas administrateur (absent de ADMIN_EMAILS).');
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + CHALLENGE_MINUTES * 60_000).toISOString();
  if (account.totp) {
    await db.prepare('INSERT INTO admin_challenges (id, tenant_id, email, method, expires_at) VALUES (?, ?, ?, \'totp\', ?)').bind(id, account.id, email, expires).run();
    return json({ ok: true, need_code: true, challenge: id, method: 'totp' });
  }
  if (env.RESEND_API_KEY) {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    await db.prepare('INSERT INTO admin_challenges (id, tenant_id, email, method, code_hash, expires_at) VALUES (?, ?, ?, \'email\', ?, ?)')
      .bind(id, account.id, email, await sha256Hex(`${id}:${code}`), expires).run();
    if (await sendEmailCode(env, email, code)) return json({ ok: true, need_code: true, challenge: id, method: 'email' });
  }
  if (env.ADMIN_PASSWORD_ONLY === '1') return createAdminSession(db, email);
  throw new HttpError(403, 'Double vérification requise : activez l\'application d\'authentification dans Devizo (Paramètres → Sécurité), puis reconnectez-vous.');
}

async function loginCode({ db, env, request }) {
  const body = await readJson(request);
  await rateLimit(db, `login-code:${clientIp(request)}`, 20, 900);
  const ch = await db.prepare('SELECT * FROM admin_challenges WHERE id = ?').bind(clean(body.challenge, 60)).first();
  if (!ch || ch.expires_at < nowIso()) throw new HttpError(401, 'Code expiré : reconnectez-vous.');
  if (ch.attempts >= 5) throw new HttpError(429, 'Trop d\'essais : reconnectez-vous.');
  const ok = ch.method === 'totp'
    ? await checkDevizoTotp(env, ch.tenant_id, body.code)
    : (await sha256Hex(`${ch.id}:${String(body.code || '').replace(/\D/g, '')}`)) === ch.code_hash;
  if (!ok) {
    await db.prepare('UPDATE admin_challenges SET attempts = attempts + 1 WHERE id = ?').bind(ch.id).run();
    throw new HttpError(401, `Code incorrect (${4 - ch.attempts} essai(s) restant(s)).`);
  }
  await db.prepare('DELETE FROM admin_challenges WHERE id = ? OR expires_at < ?').bind(ch.id, nowIso()).run();
  if (!isSuperAdmin(ch.email, env)) throw new HttpError(403, 'Ce compte n\'est plus administrateur.');
  return createAdminSession(db, ch.email);
}

async function currentAdmin(db, env, request) {
  const token = getCookie(request, ADMIN_COOKIE);
  if (!token) return null;
  const row = await db.prepare('SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).first();
  if (!row || row.expires_at < nowIso() || !isSuperAdmin(row.email, env)) return null;
  return row.email;
}

async function logout({ db, request }) {
  const token = getCookie(request, ADMIN_COOKIE);
  if (token) await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
}

// ————————————————————————— Administration : données —————————————————————————

function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function overview({ db }) {
  const s = await getSettings(db);
  // Minimisation : le téléphone et le nom des acheteurs sont effacés après la durée de conservation.
  const limit = new Date(Date.now() - (Number(s.order_days_kept) || 180) * 86400_000).toISOString();
  await db.prepare('UPDATE orders SET phone = \'\', name = \'\' WHERE created_at < ? AND phone != \'\'').bind(limit).run();
  const month = monthStart();
  const today = `${nowIso().slice(0, 10)}T00:00:00.000Z`;
  const d30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const one = (sql, ...args) => db.prepare(sql).bind(...args).first();
  const [monthRev, todayRev, totalRev, pending, activeCodes, byOffer, days, topTemplates, recent] = await Promise.all([
    one('SELECT COALESCE(SUM(amount),0) AS amount, COUNT(*) AS n FROM orders WHERE status = \'validated\' AND decided_at >= ?', month),
    one('SELECT COALESCE(SUM(amount),0) AS amount, COUNT(*) AS n FROM orders WHERE status = \'validated\' AND decided_at >= ?', today),
    one('SELECT COALESCE(SUM(amount),0) AS amount, COUNT(*) AS n FROM orders WHERE status = \'validated\''),
    one('SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS amount FROM orders WHERE status = \'pending\''),
    one('SELECT COUNT(*) AS n FROM codes WHERE revoked = 0 AND (expires_at IS NULL OR expires_at > ?) AND (credits IS NULL OR credits > 0)', nowIso()),
    db.prepare('SELECT offer_id, COUNT(*) AS n, SUM(amount) AS amount FROM orders WHERE status = \'validated\' AND decided_at >= ? GROUP BY offer_id ORDER BY amount DESC').bind(month).all(),
    db.prepare('SELECT day, name, SUM(count) AS n FROM events WHERE day >= ? GROUP BY day, name ORDER BY day').bind(d30).all(),
    db.prepare('SELECT key, SUM(count) AS n FROM events WHERE day >= ? AND name IN (\'pdf\', \'docx\') AND key != \'\' GROUP BY key ORDER BY n DESC LIMIT 12').bind(d30).all(),
    db.prepare('SELECT admin, action, target, detail, created_at FROM audit ORDER BY id DESC LIMIT 12').all(),
  ]);
  return json({
    monetization: s.monetization,
    revenue: { month: monthRev, today: todayRev, total: totalRev },
    pending,
    active_codes: activeCodes.n,
    by_offer: byOffer.results || [],
    days: days.results || [],
    top_templates: topTemplates.results || [],
    recent_audit: recent.results || [],
  });
}

async function listOrders({ db, url }) {
  const status = url.searchParams.get('status') || 'pending';
  const q = clean(url.searchParams.get('q'), 40);
  const where = [];
  const args = [];
  if (status !== 'all') {
    where.push('status = ?');
    args.push(status);
  }
  if (q) {
    where.push('(reference LIKE ? OR phone LIKE ? OR name LIKE ?)');
    args.push(`%${q.toUpperCase()}%`, `%${q.replace(/\D/g, '') || '§'}%`, `%${q}%`);
  }
  const rows = (await db.prepare(`SELECT * FROM orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 200`).bind(...args).all()).results || [];
  return json({ orders: rows.map((r) => ({ ...r, offer: JSON.parse(r.offer), amount_label: fcfa(r.amount) })) });
}

async function decideOrder({ db, request, admin, params }, validate) {
  const body = await readJson(request);
  const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(params[0]).first();
  if (!row) throw new HttpError(404, 'Commande introuvable.');
  if (row.status !== 'pending') throw new HttpError(409, 'Cette commande a déjà été traitée.');
  const note = clean(body.note, 300);
  if (!validate) {
    await db.prepare('UPDATE orders SET status = \'refused\', note = ?, admin = ?, decided_at = ? WHERE id = ?').bind(note, admin, nowIso(), row.id).run();
    await audit(db, admin, 'commande refusée', row.reference, note);
    return json({ ok: true });
  }
  const offer = JSON.parse(row.offer);
  const code = await insertCode(db, codeFieldsFor(offer, row.template_id), { offer, orderId: row.id, note: `Commande ${row.reference}` });
  // Abonnement : un renouvellement prolonge le code existant du même téléphone si le client le demande (via « prolonger » dans Codes).
  await db.prepare('UPDATE orders SET status = \'validated\', code = ?, note = ?, admin = ?, decided_at = ? WHERE id = ?').bind(code, note, admin, nowIso(), row.id).run();
  await audit(db, admin, 'commande validée', row.reference, `${fcfa(row.amount)} → ${code}`);
  const text = `Merci pour votre paiement (${row.reference}, ${fcfa(row.amount)}). Votre code CV en ligne : ${code}\nSaisissez-le dans l'éditeur : Modèles → « J'ai un code ».`;
  return json({ ok: true, code, whatsapp: whatsappLink(row.phone, text), message: text });
}

function validateOffer(body) {
  const kind = String(body.kind || '');
  if (!OFFER_KINDS[kind]) throw new HttpError(400, 'Type de pass inconnu.');
  const name = clean(body.name, 80);
  if (!name) throw new HttpError(400, 'Donnez un nom à l\'offre.');
  const price = Math.round(Number(body.price));
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw new HttpError(400, 'Prix invalide (en FCFA).');
  const days = Math.max(0, Math.min(3650, Math.round(Number(body.days) || 0)));
  const credits = Math.max(0, Math.min(1000, Math.round(Number(body.credits) || 0)));
  if ((kind === 'pass' || kind === 'subscription') && !days) throw new HttpError(400, 'Indiquez la durée en jours.');
  if (kind === 'download' && !credits) throw new HttpError(400, 'Indiquez le nombre de téléchargements.');
  const templates = Array.isArray(body.templates) ? body.templates.map(String).filter((t) => t === '*' || ID_RE.test(t)).slice(0, 80) : ['*'];
  const features = Array.isArray(body.features) ? body.features.map(String).filter((f) => FEATURES[f]) : [];
  return {
    name, kind, price, days, credits, templates: kind === 'template' ? [] : (templates.length ? templates : ['*']), features,
    description: clean(body.description, 400), active: Boolean(body.active), sort: Math.round(Number(body.sort) || 0),
  };
}

async function listOffers({ db }) {
  const offers = ((await db.prepare('SELECT * FROM offers ORDER BY sort, price').all()).results || []).map(offerFromRow);
  return json({ offers, kinds: OFFER_KINDS, features: FEATURES });
}

async function saveOffer({ db, request, admin, params }) {
  const o = validateOffer(await readJson(request));
  let id = params[0];
  if (!id) {
    id = o.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'offre';
    if (await db.prepare('SELECT 1 FROM offers WHERE id = ?').bind(id).first()) id = `${id}-${randomCode(4).toLowerCase()}`;
    await db.prepare('INSERT INTO offers (id, name, kind, price, days, credits, templates, features, description, active, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, o.name, o.kind, o.price, o.days, o.credits, JSON.stringify(o.templates), JSON.stringify(o.features), o.description, o.active ? 1 : 0, o.sort, nowIso()).run();
    await audit(db, admin, 'offre créée', id, `${o.name} — ${fcfa(o.price)}`);
  } else {
    const res = await db.prepare('UPDATE offers SET name = ?, kind = ?, price = ?, days = ?, credits = ?, templates = ?, features = ?, description = ?, active = ?, sort = ? WHERE id = ?')
      .bind(o.name, o.kind, o.price, o.days, o.credits, JSON.stringify(o.templates), JSON.stringify(o.features), o.description, o.active ? 1 : 0, o.sort, id).run();
    if (!res.meta || !res.meta.changes) throw new HttpError(404, 'Offre introuvable.');
    await audit(db, admin, 'offre modifiée', id, `${o.name} — ${fcfa(o.price)} — ${o.active ? 'active' : 'inactive'}`);
  }
  return json({ ok: true, offer: offerFromRow(await db.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first()) });
}

async function deleteOffer({ db, admin, params }) {
  const used = await db.prepare('SELECT COUNT(*) AS n FROM orders WHERE offer_id = ?').bind(params[0]).first();
  if (used && used.n) {
    await db.prepare('UPDATE offers SET active = 0 WHERE id = ?').bind(params[0]).run();
    await audit(db, admin, 'offre désactivée', params[0], 'déjà commandée : conservée pour l\'historique');
    return json({ ok: true, deactivated: true });
  }
  await db.prepare('DELETE FROM offers WHERE id = ?').bind(params[0]).run();
  await audit(db, admin, 'offre supprimée', params[0]);
  return json({ ok: true });
}

async function listCodes({ db, url }) {
  // LIKE de SQLite ignore la casse des seules lettres ASCII : code en majuscules, note telle que saisie (« lycée »).
  const q = clean(url.searchParams.get('q'), 40);
  const rows = (q
    ? await db.prepare('SELECT * FROM codes WHERE code LIKE ? OR note LIKE ? ORDER BY created_at DESC LIMIT 200').bind(`%${q.toUpperCase()}%`, `%${q}%`).all()
    : await db.prepare('SELECT * FROM codes ORDER BY created_at DESC LIMIT 200').all()).results || [];
  return json({ codes: rows.map(codeFromRow).map((c) => ({ ...c, state: codeState(c) })) });
}

/** Code offert ou vendu hors ligne (geste commercial, partenariat, test). */
async function createCode({ db, request, admin }) {
  const body = await readJson(request);
  const row = await db.prepare('SELECT * FROM offers WHERE id = ?').bind(clean(body.offer_id, 60)).first();
  if (!row) throw new HttpError(404, 'Offre introuvable.');
  const offer = offerFromRow(row);
  const templateId = clean(body.template_id, 60);
  if (offer.kind === 'template' && !ID_RE.test(templateId)) throw new HttpError(400, 'Choisissez le modèle à débloquer.');
  const code = await insertCode(db, codeFieldsFor(offer, templateId), { offer, note: clean(body.note, 300) || 'Code créé par l\'administration' });
  await audit(db, admin, 'code créé', code, `${offer.name}${body.note ? ` — ${clean(body.note, 100)}` : ''}`);
  return json({ ok: true, code }, 201);
}

async function updateCode({ db, request, admin, params }, action) {
  const c = await loadCode(db, params[0]);
  if (!c) throw new HttpError(404, 'Code introuvable.');
  if (action === 'revoke') {
    await db.prepare('UPDATE codes SET revoked = 1 WHERE code = ?').bind(c.code).run();
    await audit(db, admin, 'code désactivé', c.code);
  } else if (action === 'restore') {
    await db.prepare('UPDATE codes SET revoked = 0 WHERE code = ?').bind(c.code).run();
    await audit(db, admin, 'code réactivé', c.code);
  } else {
    // Prolonger (abonnement renouvelé, geste commercial) : jours à partir de l'échéance ou d'aujourd'hui ; crédits ajoutés.
    const body = await readJson(request);
    const days = Math.max(0, Math.min(3650, Math.round(Number(body.days) || 0)));
    const credits = Math.max(0, Math.min(1000, Math.round(Number(body.credits) || 0)));
    if (!days && !credits) throw new HttpError(400, 'Indiquez des jours ou des crédits à ajouter.');
    const from = c.expires_at && c.expires_at > nowIso() ? c.expires_at : nowIso();
    const expires = days ? addDays(from, days) : c.expires_at;
    const newCredits = c.credits === null ? (credits ? credits : null) : c.credits + credits;
    await db.prepare('UPDATE codes SET expires_at = ?, credits = ?, revoked = 0 WHERE code = ?').bind(expires, newCredits, c.code).run();
    await audit(db, admin, 'code prolongé', c.code, `${days ? `+${days} j` : ''}${days && credits ? ', ' : ''}${credits ? `+${credits} téléchargement(s)` : ''}`);
  }
  const updated = await loadCode(db, c.code);
  return json({ ok: true, code: { ...updated, state: codeState(updated) } });
}

async function getAdminSettings({ db }) {
  return json({ settings: await getSettings(db) });
}

async function putSettings({ db, request, admin }) {
  const body = await readJson(request);
  const s = await getSettings(db);
  const changes = [];
  if ('monetization' in body) {
    s.monetization = Boolean(body.monetization);
    changes.push(`monétisation ${s.monetization ? 'activée' : 'désactivée'}`);
  }
  for (const key of ['premium_templates', 'hidden_templates']) {
    if (Array.isArray(body[key])) {
      s[key] = [...new Set(body[key].map(String).filter((t) => ID_RE.test(t)))].slice(0, 100);
      changes.push(`${key === 'premium_templates' ? 'modèles premium' : 'modèles masqués'} : ${s[key].length}`);
    }
  }
  if (body.payment && typeof body.payment === 'object') {
    s.payment = {
      wave: clean(body.payment.wave, 40),
      orange_money: clean(body.payment.orange_money, 40),
      instructions: clean(body.payment.instructions, 600) || DEFAULT_SETTINGS.payment.instructions,
    };
    changes.push('moyens de paiement');
  }
  if ('announcement' in body) {
    s.announcement = clean(body.announcement, 300);
    changes.push('annonce');
  }
  if ('order_days_kept' in body) s.order_days_kept = Math.max(30, Math.min(3650, Math.round(Number(body.order_days_kept) || 180)));
  for (const k of Object.keys(DEFAULT_SETTINGS)) await saveSetting(db, k, s[k]);
  await audit(db, admin, 'réglages modifiés', '', changes.join(', '));
  return json({ ok: true, settings: s });
}

async function listAudit({ db }) {
  return json({ audit: (await db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 300').all()).results || [] });
}

async function ordersCsv({ db }) {
  const rows = (await db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5000').all()).results || [];
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Référence', 'Date', 'Offre', 'Montant (FCFA)', 'Canal', 'Téléphone', 'Nom', 'Statut', 'Code', 'Traitée par', 'Traitée le'];
  const lines = rows.map((r) => [r.reference, r.created_at, JSON.parse(r.offer).name, r.amount, r.channel === 'wave' ? 'Wave' : 'Orange Money', r.phone, r.name, r.status, r.code || '', r.admin || '', r.decided_at || '']);
  return new Response(`\uFEFF${[header, ...lines].map((l) => l.map(cell).join(';')).join('\r\n')}`, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="commandes-cv-en-ligne.csv"', 'cache-control': 'no-store' },
  });
}

// ————————————————————————— Routage —————————————————————————

const PUBLIC = [
  ['GET', /^\/api\/config$/, getConfig],
  ['POST', /^\/api\/orders$/, createOrder],
  ['POST', /^\/api\/orders\/status$/, orderStatus],
  ['POST', /^\/api\/codes\/redeem$/, redeem],
  ['POST', /^\/api\/codes\/consume$/, consume],
  ['POST', /^\/api\/events$/, event],
  ['POST', /^\/api\/admin\/login$/, login],
  ['POST', /^\/api\/admin\/login\/code$/, loginCode],
  ['POST', /^\/api\/admin\/logout$/, logout],
  ...portfolioRoutes,
];

const ADMIN = [
  ['GET', /^\/api\/admin\/me$/, ({ admin }) => json({ email: admin })],
  ...portfolioAdminRoutes,
  ['GET', /^\/api\/admin\/overview$/, overview],
  ['GET', /^\/api\/admin\/orders$/, listOrders],
  ['GET', /^\/api\/admin\/orders\.csv$/, ordersCsv],
  ['POST', /^\/api\/admin\/orders\/([\w-]+)\/validate$/, (c) => decideOrder(c, true)],
  ['POST', /^\/api\/admin\/orders\/([\w-]+)\/refuse$/, (c) => decideOrder(c, false)],
  ['GET', /^\/api\/admin\/offers$/, listOffers],
  ['POST', /^\/api\/admin\/offers$/, (c) => saveOffer({ ...c, params: [] })],
  ['PUT', /^\/api\/admin\/offers\/([a-z0-9-]+)$/, saveOffer],
  ['DELETE', /^\/api\/admin\/offers\/([a-z0-9-]+)$/, deleteOffer],
  ['GET', /^\/api\/admin\/codes$/, listCodes],
  ['POST', /^\/api\/admin\/codes$/, createCode],
  ['POST', /^\/api\/admin\/codes\/([A-Z0-9-]+)\/revoke$/, (c) => updateCode(c, 'revoke')],
  ['POST', /^\/api\/admin\/codes\/([A-Z0-9-]+)\/restore$/, (c) => updateCode(c, 'restore')],
  ['POST', /^\/api\/admin\/codes\/([A-Z0-9-]+)\/extend$/, (c) => updateCode(c, 'extend')],
  ['GET', /^\/api\/admin\/settings$/, getAdminSettings],
  ['PUT', /^\/api\/admin\/settings$/, putSettings],
  ['GET', /^\/api\/admin\/audit$/, listAudit],
];

function match(routes, method, path) {
  for (const [m, re, fn] of routes) {
    const found = path.match(re);
    if (found && m === method) return { fn, params: found.slice(1) };
  }
  return null;
}

/** Point d'entrée : (Request, env) → Response. */
export async function handle(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();
  try {
    if (!env.DB) {
      // Serveur non configuré : le site reste 100 % gratuit et fonctionnel.
      if (path === '/api/config') return json({ configured: false, monetization: false, premium_templates: [], hidden_templates: [], offers: [], announcement: '' });
      throw new HttpError(503, 'Administration non configurée : reliez une base D1 « DB » au projet Cloudflare Pages (voir DEPLOIEMENT.md).');
    }
    const db = env.DB;
    await ensureSchema(db);
    // Protection CSRF : les écritures exigent du JSON et une origine identique (cookie SameSite=Strict en plus).
    if (method !== 'GET') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'Origine refusée.');
      const type = request.headers.get('content-type') || '';
      if (method !== 'DELETE' && !type.includes('application/json')) throw new HttpError(415, 'JSON attendu.');
    }
    const pub = match(PUBLIC, method, path);
    if (pub) return await pub.fn({ db, env, request, url, params: pub.params });
    if (path.startsWith('/api/admin/')) {
      const route = match(ADMIN, method, path);
      if (!route) throw new HttpError(404, 'Ressource inconnue.');
      const admin = await currentAdmin(db, env, request);
      if (!admin) throw new HttpError(401, 'Session expirée : reconnectez-vous.');
      return await route.fn({ db, env, request, url, admin, params: route.params });
    }
    throw new HttpError(404, 'Ressource inconnue.');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    return json({ error: status === 500 ? 'Erreur interne du serveur.' : e.message }, status);
  }
}
