// Portfolio en ligne : la SEULE donnée de candidat stockée sur le serveur, et uniquement ce que la personne choisit
// de rendre PUBLIC (elle coche chaque rubrique, voit l'aperçu et donne son accord). Pas de compte : une clé secrète
// est remise à la publication et gardée dans le navigateur ; elle seule permet de modifier ou supprimer la page.
// Aucune pièce d'identité, date de naissance, adresse précise ni photo : nom, titre, ville, liens choisis.
import { HttpError, json, readJson, sha256Hex, randomToken, clientIp, nowIso, timingSafeEqual } from './http.js';
import { rateLimit, audit } from './db.js';
import { portfolioBody, colorClass } from '../../public/js/portfolio-core.js';

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['admin', 'api', 'app', 'cv', 'aide', 'contact', 'nexus', 'nexusmarket', 'devizo', 'myshop', 'support', 'www', 'portfolio', 'test']);
const MAX_BYTES = 30_000;
export const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 220_000;   // par photo, après compression sur le téléphone (≈ 1280 px, JPEG)

/** Photo envoyée en data URL : type autorisé, signature vérifiée, taille bornée. → { mime, data (base64) } */
export function decodePhoto(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new HttpError(400, 'Photo invalide : JPEG, PNG ou WebP uniquement.');
  const bin = atob(m[2]);
  if (bin.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Photo trop lourde : 220 Ko au plus après compression.');
  const b = (i) => bin.charCodeAt(i);
  const ok = { jpeg: b(0) === 0xff && b(1) === 0xd8, png: b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47, webp: bin.slice(0, 4) === 'RIFF' && bin.slice(8, 12) === 'WEBP' }[m[1]];
  if (!ok) throw new HttpError(400, 'Le contenu du fichier ne correspond pas à une image.');
  return { mime: `image/${m[1]}`, data: m[2] };
}

/**
 * Photos de réalisations : la liste envoyée remplace l'ancienne. Chaque élément garde une photo existante
 * ({ keep: n }) ou en ajoute une ({ data: dataURL }), avec une légende. Absent = photos inchangées.
 */
async function savePhotos(db, slug, list, data) {
  if (!Array.isArray(list)) {
    const prev = await db.prepare('SELECT data FROM portfolios WHERE slug = ?').bind(slug).first();
    data.images = prev ? (JSON.parse(prev.data).images || []) : [];
    return;
  }
  const old = new Map((await db.prepare('SELECT idx, mime, data FROM portfolio_images WHERE slug = ?').bind(slug).all()).results.map((r) => [r.idx, r]));
  const next = [];
  for (const item of list.slice(0, MAX_IMAGES)) {
    const caption = t(item?.caption, 120);
    if (item && Number.isInteger(item.keep) && old.has(item.keep)) next.push({ ...old.get(item.keep), caption });
    else if (item && item.data) next.push({ ...decodePhoto(item.data), caption });
  }
  const stmts = [db.prepare('DELETE FROM portfolio_images WHERE slug = ?').bind(slug)];
  next.forEach((im, i) => stmts.push(db.prepare('INSERT INTO portfolio_images (slug, idx, mime, data) VALUES (?, ?, ?, ?)').bind(slug, i, im.mime, im.data)));
  await db.batch(stmts);
  data.images = next.map((im, i) => ({ i, caption: im.caption, v: Date.now().toString(36) }));
}

/** Photo publique : /p/<adresse>/photo-<n> */
export async function servePhoto(db, slug, idx) {
  const r = await db.prepare('SELECT mime, data FROM portfolio_images WHERE slug = ? AND idx = ?').bind(slug, idx).first();
  if (!r) return null;
  const bin = atob(r.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: r.mime, bytes };
}

const t = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const para = (v, max) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const url = (v) => {
  const s = t(v, 300);
  if (!s || (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s))) return '';
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
};
const COLORS = new Set(['#0b5cad', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#111827']);

/** Nettoie et borne ce qui sera publié (le serveur ne fait jamais confiance au navigateur). */
export function cleanPortfolio(d = {}) {
  const c = d.contact || {};
  const out = {
    name: t(d.name, 80), title: t(d.title, 120), city: t(d.city, 60), summary: para(d.summary, 1200),
    color: COLORS.has(d.color) ? d.color : '#0b5cad',
    contact: { email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t(c.email, 120)) ? t(c.email, 120) : '', whatsapp: t(c.whatsapp, 20).replace(/[^\d+]/g, ''),
      linkedin: url(c.linkedin), website: url(c.website) },
    skills: (Array.isArray(d.skills) ? d.skills : []).map((s) => t(s, 60)).filter(Boolean).slice(0, 30),
    experiences: (Array.isArray(d.experiences) ? d.experiences : []).slice(0, 10).map((e) => ({ position: t(e?.position, 120), employer: t(e?.employer, 120),
      period: t(e?.period, 60), description: para(e?.description, 700) })).filter((e) => e.position),
    projects: (Array.isArray(d.projects) ? d.projects : []).slice(0, 12).map((p) => ({ name: t(p?.name, 120), description: para(p?.description, 700), link: url(p?.link) })).filter((p) => p.name),
    education: (Array.isArray(d.education) ? d.education : []).slice(0, 6).map((e) => ({ degree: t(e?.degree, 160), school: t(e?.school, 120), period: t(e?.period, 60) })).filter((e) => e.degree),
    languages: (Array.isArray(d.languages) ? d.languages : []).slice(0, 8).map((l) => ({ name: t(l?.name, 40), level: t(l?.level, 30) })).filter((l) => l.name),
    cv_lang: d.cv_lang === 'en' ? 'en' : 'fr',
  };
  if (!out.name) throw new HttpError(400, 'Indiquez au moins le nom à afficher.');
  if (!out.title && !out.summary && !out.projects.length && !out.experiences.length) throw new HttpError(400, 'Le portfolio est vide : ajoutez un titre, une présentation, une expérience ou un projet.');
  if (JSON.stringify(out).length > MAX_BYTES) throw new HttpError(413, 'Portfolio trop long : raccourcissez les descriptions.');
  return out;
}

export function checkSlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (!SLUG_RE.test(s) || s.includes('--')) throw new HttpError(400, 'Adresse invalide : 3 à 40 lettres minuscules, chiffres ou tirets (ex. awa-diop).');
  if (RESERVED.has(s)) throw new HttpError(409, 'Cette adresse est réservée : choisissez-en une autre.');
  return s;
}

async function owned(db, request, slug) {
  const row = await db.prepare('SELECT slug, key_hash, data, views, created_at, updated_at FROM portfolios WHERE slug = ?').bind(slug).first();
  if (!row) throw new HttpError(404, 'Portfolio introuvable.');
  const key = request.headers.get('x-portfolio-key') || '';
  if (!key || !timingSafeEqual(await sha256Hex(key), row.key_hash)) throw new HttpError(403, 'Clé de modification incorrecte.');
  return row;
}

export const portfolioRoutes = [
  ['GET', /^\/api\/portfolios\/check\/([a-z0-9-]{1,60})$/, async ({ db, params }) => {
    let s;
    try { s = checkSlug(params[0]); } catch (e) { return json({ available: false, reason: e.message }); }
    const row = await db.prepare('SELECT 1 FROM portfolios WHERE slug = ?').bind(s).first();
    return json({ available: !row, reason: row ? 'Adresse déjà prise.' : '' });
  }],
  ['POST', /^\/api\/portfolios$/, async ({ db, request }) => {
    await rateLimit(db, `portfolio:${clientIp(request)}`, 5, 86400);
    const b = await readJson(request, 1_600_000);
    if (b.consent !== true) throw new HttpError(400, 'Cochez la case : vous acceptez que ces informations soient publiques.');
    const slug = checkSlug(b.slug);
    const data = cleanPortfolio(b.data);
    const key = randomToken(24);
    const now = nowIso();
    try {
      await db.prepare('INSERT INTO portfolios (slug, key_hash, data, views, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)')
        .bind(slug, await sha256Hex(key), JSON.stringify(data), now, now).run();
      if (Array.isArray(b.images) && b.images.length) {
        await savePhotos(db, slug, b.images, data);
        await db.prepare('UPDATE portfolios SET data = ? WHERE slug = ?').bind(JSON.stringify(data), slug).run();
      }
    } catch (e) {
      if (/UNIQUE|PRIMARY/i.test(String(e?.message))) throw new HttpError(409, 'Adresse déjà prise : choisissez-en une autre.');
      throw e;
    }
    return json({ slug, key, url: `${new URL(request.url).origin}/p/${slug}` }, 201);
  }],
  ['GET', /^\/api\/portfolios\/([a-z0-9-]{1,60})$/, async ({ db, request, params }) => {
    const row = await owned(db, request, params[0]);
    return json({ slug: row.slug, data: JSON.parse(row.data), views: row.views, created_at: row.created_at, updated_at: row.updated_at });
  }],
  ['PUT', /^\/api\/portfolios\/([a-z0-9-]{1,60})$/, async ({ db, request, params }) => {
    await rateLimit(db, `portfolio-put:${clientIp(request)}`, 60, 3600);
    const row = await owned(db, request, params[0]);
    const b = await readJson(request, 1_600_000);
    const data = cleanPortfolio(b.data);
    await savePhotos(db, row.slug, b.images, data);
    await db.prepare('UPDATE portfolios SET data = ?, updated_at = ? WHERE slug = ?').bind(JSON.stringify(data), nowIso(), row.slug).run();
    return json({ slug: row.slug, ok: true });
  }],
  ['DELETE', /^\/api\/portfolios\/([a-z0-9-]{1,60})$/, async ({ db, request, params }) => {
    const row = await owned(db, request, params[0]);
    await db.batch([db.prepare('DELETE FROM portfolios WHERE slug = ?').bind(row.slug), db.prepare('DELETE FROM portfolio_images WHERE slug = ?').bind(row.slug)]);
    return json({ ok: true });
  }],
];

/** Administration : liste et retrait (contenu signalé, abus). */
export const portfolioAdminRoutes = [
  ['GET', /^\/api\/admin\/portfolios$/, async ({ db }) => {
    const r = await db.prepare('SELECT slug, data, views, created_at, updated_at FROM portfolios ORDER BY updated_at DESC LIMIT 200').all();
    return json({ portfolios: r.results.map((p) => { const d = JSON.parse(p.data); return { slug: p.slug, name: d.name, title: d.title, views: p.views, created_at: p.created_at, updated_at: p.updated_at }; }) });
  }],
  ['POST', /^\/api\/admin\/portfolios\/([a-z0-9-]{1,60})\/delete$/, async ({ db, admin, params }) => {
    const r = await db.prepare('DELETE FROM portfolios WHERE slug = ?').bind(params[0]).run();
    await db.prepare('DELETE FROM portfolio_images WHERE slug = ?').bind(params[0]).run();
    if (!r.meta?.changes) throw new HttpError(404, 'Portfolio introuvable.');
    await audit(db, admin, 'portfolio.delete', params[0]);
    return json({ ok: true });
  }],
];

/** Page publique /p/<adresse> (HTML rendu côté serveur, CSP stricte : aucun style ni script en ligne). */
export function portfolioPage(d, slug, origin) {
  const e = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const en = d.cv_lang === 'en';
  const desc = [d.title, d.city].filter(Boolean).join(' — ') || String(d.summary || '').slice(0, 150);
  return `<!doctype html><html lang="${en ? 'en' : 'fr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(d.name)}${d.title ? ` — ${e(d.title)}` : ''}</title><meta name="description" content="${e(desc)}">
<link rel="canonical" href="${e(`${origin}/p/${slug}`)}"><meta property="og:title" content="${e(d.name)}"><meta property="og:description" content="${e(desc)}"><meta property="og:type" content="profile">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/fonts.css"><link rel="stylesheet" href="/css/portfolio.css"></head>
<body class="pf ${colorClass(d.color)}">${portfolioBody(d, { photoUrl: (im) => `/p/${slug}/photo-${im.i}?v=${im.v || ''}` })}</body></html>`;
}
