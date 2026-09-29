// Service worker : mode hors ligne. Met en cache tous les fichiers du site (aucune donnée utilisateur :
// les CV restent dans localStorage). Changer VERSION à chaque déploiement pour renouveler le cache.
// La liste ASSETS est vérifiée par les tests (tests/pwa.test.js) : tout fichier de public/ doit y figurer.

const VERSION = 'cv-2026-09-29-cycle2';
const ASSETS = [
  './',
  'app.html',
  'css/app.css',
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
  'js/app.js',
  'js/home.js',
  'js/i18n.js',
  'js/match.js',
  'js/model.js',
  'js/norms.js',
  'js/pwa.js',
  'js/render.js',
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
  'js/templates/parts.js',
  'js/templates/sidebar.js',
  'js/templates/single.js',
  'js/templates/student.js',
  'js/templates/trades.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Pages : réseau d'abord (dernière version), cache si hors ligne.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('app.html'))),
    );
    return;
  }
  // Fichiers statiques : cache d'abord, mise à jour en arrière-plan.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
