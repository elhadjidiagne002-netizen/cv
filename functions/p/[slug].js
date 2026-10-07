// Page publique d'un portfolio : /p/<adresse> (rendue côté serveur : lisible par Google et par l'aperçu WhatsApp).
import { ensureSchema } from '../_lib/db.js';
import { portfolioPage, SLUG_RE } from '../_lib/portfolio.js';

// public/_headers ne s'applique pas aux réponses des Functions : mêmes protections, posées ici.
const SEC = {
  'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
};

const notFound = (origin) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portfolio introuvable — CV en ligne</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/css/portfolio.css"></head>
<body class="pf pf-c0"><main class="pf-main"><header class="pf-head"><h1>Portfolio introuvable</h1><p>Cette adresse n’existe pas ou a été supprimée par son auteur.</p>
<nav class="pf-links"><a href="${origin}/publier.html">Créer mon portfolio gratuit</a></nav></header></main></body></html>`,
{ status: 404, headers: { ...SEC, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env, params }) {
  const origin = new URL(request.url).origin;
  const slug = String(params.slug || '').toLowerCase();
  if (!env.DB || !SLUG_RE.test(slug)) return notFound(origin);
  await ensureSchema(env.DB);
  const row = await env.DB.prepare('SELECT data FROM portfolios WHERE slug = ?').bind(slug).first();
  if (!row) return notFound(origin);
  // Compteur de visites : approximatif, sans cookie ni donnée sur le visiteur.
  await env.DB.prepare('UPDATE portfolios SET views = views + 1 WHERE slug = ?').bind(slug).run();
  return new Response(portfolioPage(JSON.parse(row.data), slug, origin), {
    headers: { ...SEC, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60', 'x-robots-tag': 'index' },
  });
}
