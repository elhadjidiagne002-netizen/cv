// Mode hors ligne : manifeste, service worker et en-têtes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
const read = (f) => readFileSync(join(pub, f), 'utf8');

function walk(dir) {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [relative(pub, join(dir, f)).split('\\').join('/')]));
}

test('manifeste installable : nom, start_url, icônes 192 et 512 existantes', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.lang, 'fr');
  assert.equal(m.display, 'standalone');
  assert.ok(existsSync(join(pub, m.start_url)));
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  for (const i of m.icons) assert.ok(existsSync(join(pub, i.src)), i.src);
  for (const f of ['app.html', 'index.html']) assert.match(read(f), /<link rel="manifest" href="manifest\.webmanifest">/, f);
});

test('le service worker met en cache tous les fichiers du site (et rien d\'externe)', () => {
  const sw = read('sw.js');
  const list = [...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  // Polices « latin étendu » : chargées et mises en cache à la demande (données mobiles).
  const files = walk(pub).filter((f) => !['_headers', 'sw.js'].includes(f) && !f.endsWith('.txt') && f !== 'sitemap.xml' && !/-latin-ext-/.test(f)
    && !/^(admin\.html|js\/admin\.js|css\/admin\.css)$/.test(f) && !f.startsWith('.well-known/')); // administration : jamais hors ligne
  assert.ok(!list.some((f) => /admin/.test(f)), 'le tableau de bord n\'est pas mis en cache');
  assert.ok(sw.includes("url.pathname.startsWith('/api/')"), 'les appels à l\'API ne passent jamais par le cache');
  assert.ok(!list.some((f) => /-latin-ext-/.test(f)), 'les polices latin-ext ne sont pas pré-téléchargées');
  for (const f of files) assert.ok(list.includes(f), `absent du cache hors ligne : ${f}`);
  for (const f of list) if (f !== './') assert.ok(existsSync(join(pub, f)), `fichier inexistant : ${f}`);
  assert.doesNotMatch(sw, /https?:\/\//);
  assert.match(sw, /const VERSION = '/);
});

test('le service worker est enregistré par l\'éditeur et l\'accueil ; en-têtes adaptés', () => {
  assert.match(read('js/pwa.js'), /serviceWorker\.register\('sw\.js'\)/);
  assert.match(read('js/app.js'), /registerServiceWorker\(\(\) => \{/, 'l\'éditeur réagit aux nouvelles versions');
  assert.match(read('js/home.js'), /registerServiceWorker\(\)/);
  const h = read('_headers');
  assert.match(h, /manifest-src 'self'/);
  assert.match(h, /\/sw\.js\n\s+Cache-Control: no-cache/);
});

test('service worker : versions cohérentes après un déploiement (réseau d\'abord avec délai, pré-cache non périmé)', () => {
  const sw = read('sw.js');
  assert.match(sw, /cache: 'reload'/, 'le pré-cache contourne le cache HTTP');
  assert.match(sw, /function networkFirst\(req\)/);
  assert.match(sw, /NETWORK_TIMEOUT = \d{4}/);
  assert.doesNotMatch(sw, /return cached \|\| network/, 'plus de « cache d\'abord » pour les scripts (mélange de versions)');
  assert.match(read('js/pwa.js'), /controllerchange/);
});

test('application Android : lien de téléchargement, détection de l’application, lien de confiance', async () => {
  const { APK_URL, ANDROID_PACKAGE, insideAndroidApp, mobilePlatform } = await import('../public/js/pwa.js');
  assert.match(APK_URL, /\/nexus-apps\/releases\/latest\/download\/cv-en-ligne\.apk$/);
  for (const f of ['app.html', 'index.html']) assert.ok(read(f).includes(APK_URL), f);
  const m = new Map();
  const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.equal(insideAndroidApp({ referrer: '', storage: s }), false);
  assert.equal(insideAndroidApp({ referrer: `android-app://${ANDROID_PACKAGE}/`, storage: s }), true);
  assert.equal(insideAndroidApp({ referrer: '', storage: s }), true);
  assert.equal(mobilePlatform('Mozilla/5.0 (Linux; Android 13) Chrome/129 Mobile'), 'android');
  assert.equal(mobilePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'), 'ios');
  const links = JSON.parse(read('.well-known/assetlinks.json'));
  assert.equal(links[0].target.package_name, ANDROID_PACKAGE);
  assert.match(read('_headers'), /\/\.well-known\/assetlinks\.json\n\s+Content-Type: application\/json/);
});
