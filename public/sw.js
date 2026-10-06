// Service worker : mode hors ligne. Met en cache tous les fichiers du site (aucune donnée utilisateur :
// les CV restent dans localStorage). Changer VERSION à chaque déploiement pour renouveler le cache.
// La liste ASSETS est vérifiée par les tests (tests/pwa.test.js) : tout fichier de public/ doit y figurer,
// sauf les polices « latin étendu » (lettres ŋ, ɓ, ɗ, ƴ des langues nationales) : ~560 Ko rarement utiles,
// mises en cache à la demande pour ménager les forfaits de données mobiles.

const VERSION = 'cv-2026-10-06-icones';
const ASSETS = [
  './',
  '404.html',
  'app.html',
  'attestation.html',
  'confidentialite.html',
  'css/app.css',
  'css/attestation.css',
  'css/cv-base.css',
  'css/fonts.css',
  'css/templates.css',
  'favicon.svg',
  'fonts/eb-garamond/eb-garamond-latin-400-italic.woff2',
  'fonts/eb-garamond/eb-garamond-latin-400-normal.woff2',
  'fonts/eb-garamond/eb-garamond-latin-700-normal.woff2',
  'fonts/inter/inter-latin-400-italic.woff2',
  'fonts/inter/inter-latin-400-normal.woff2',
  'fonts/inter/inter-latin-700-normal.woff2',
  'fonts/lato/lato-latin-400-italic.woff2',
  'fonts/lato/lato-latin-400-normal.woff2',
  'fonts/lato/lato-latin-700-normal.woff2',
  'fonts/merriweather/merriweather-latin-400-italic.woff2',
  'fonts/merriweather/merriweather-latin-400-normal.woff2',
  'fonts/merriweather/merriweather-latin-700-normal.woff2',
  'fonts/montserrat/montserrat-latin-400-italic.woff2',
  'fonts/montserrat/montserrat-latin-400-normal.woff2',
  'fonts/montserrat/montserrat-latin-700-normal.woff2',
  'fonts/source-serif-4/source-serif-4-latin-400-italic.woff2',
  'fonts/source-serif-4/source-serif-4-latin-400-normal.woff2',
  'fonts/source-serif-4/source-serif-4-latin-700-normal.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'index.html',
  'js/ai.js',
  'js/aitext.js',
  'js/attestation.js',
  'js/attestation-core.js',
  'js/dossier.js',
  'js/app.js',
  'js/applications.js',
  'js/docx.js',
  'js/home.js',
  'js/i18n.js',
  'js/icons.js',
  'js/jsonresume.js',
  'js/letter.js',
  'js/linkedin.js',
  'js/match.js',
  'js/model.js',
  'js/norms.js',
  'js/paginate.js',
  'js/phrases.js',
  'js/plaintext.js',
  'js/premium.js',
  'js/privacy.js',
  'js/pwa.js',
  'js/render.js',
  'js/senegal.js',
  'js/storage.js',
  'js/templates/academic.js',
  'js/templates/banner.js',
  'js/templates/dates.js',
  'js/templates/europass.js',
  'js/templates/functional.js',
  'js/templates/index.js',
  'js/templates/international.js',
  'js/templates/national.js',
  'js/templates/palettes.js',
  'js/templates/refined.js',
  'js/templates/parts.js',
  'js/templates/sidebar.js',
  'js/templates/single.js',
  'js/templates/student.js',
  'js/templates/trades.js',
  'js/zip.js',
  'manifest.webmanifest',
];

/** Délai au-delà duquel une connexion lente cède la place à la copie locale (réseau mobile instable). */
const NETWORK_TIMEOUT = 3500;

/**
 * Cloudflare Pages redirige « x.html » vers « x » (308). Une réponse obtenue après redirection ne doit JAMAIS être
 * resservie à une navigation : Chrome la refuse (ERR_FAILED, « Ce site est inaccessible »). On la recopie.
 */
async function clean(res) {
  if (!res || !res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (event) => {
  // cache: 'reload' : télécharge vraiment la nouvelle version (pas une copie du cache HTTP du navigateur).
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(ASSETS.map(async (url) => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error(`Mise en cache impossible : ${url} (${res.status})`);
      await cache.put(url, await clean(res));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Page « /app » ↔ fichier « app.html » : le cache est rempli sous le nom de fichier. */
function htmlKey(req) {
  const path = new URL(req.url).pathname;
  if (path === '/' || path.endsWith('/')) return './';
  return /\.[a-z0-9]+$/i.test(path) ? null : `${path.replace(/^\//, '')}.html`;
}

async function fromCache(req) {
  let r = await caches.match(req, { ignoreSearch: true });
  if (!r && req.mode === 'navigate') {
    const key = htmlKey(req);
    r = (key && (await caches.match(key))) || (await caches.match('app.html'));
  }
  return clean(r);
}

/**
 * Réseau d'abord, copie locale si hors ligne ou si le réseau met plus de NETWORK_TIMEOUT ms.
 * Pages et modules viennent ainsi de la même version dès qu'une connexion est disponible
 * (jamais une page récente avec d'anciens scripts), et l'application reste utilisable sans connexion.
 */
function networkFirst(req) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (res) => {
      if (!done && res) {
        done = true;
        resolve(res);
      }
    };
    const timer = setTimeout(() => fromCache(req).then(finish), NETWORK_TIMEOUT);
    fetch(req)
      .then((res) => {
        clearTimeout(timer);
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(async (c) => c.put(req, await clean(copy)));
        }
        finish(res);
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache(req).then((r) => finish(r || Response.error()));
      });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API (offres, commandes, administration) et tableau de bord : toujours le réseau, jamais de cache.
  if (url.pathname.startsWith('/api/') || /\/(admin\.html|js\/admin\.js|css\/admin\.css)$/.test(url.pathname)) return;
  // Polices et icônes : fichiers immuables, servis depuis le cache (économie de données mobiles).
  if (/\/(fonts|icons)\//.test(url.pathname)) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })));
    return;
  }
  event.respondWith(networkFirst(req));
});
