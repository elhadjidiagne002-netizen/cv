// Photos de réalisations d'un portfolio : /p/<adresse>/photo-<n> (images publiées par la personne elle-même).
import { ensureSchema } from '../../_lib/db.js';
import { servePhoto, SLUG_RE } from '../../_lib/portfolio.js';

export async function onRequestGet({ env, params }) {
  const slug = String(params.slug || '').toLowerCase();
  const m = /^photo-([0-5])$/.exec(String(params.file || ''));
  if (!env.DB || !SLUG_RE.test(slug) || !m) return new Response('Introuvable', { status: 404 });
  await ensureSchema(env.DB);
  const ph = await servePhoto(env.DB, slug, Number(m[1]));
  if (!ph) return new Response('Introuvable', { status: 404 });
  return new Response(ph.bytes, { headers: { 'content-type': ph.mime, 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
}
