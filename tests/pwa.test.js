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
  const files = walk(pub).filter((f) => !['_headers', 'sw.js'].includes(f) && !f.endsWith('.txt'));
  for (const f of files) assert.ok(list.includes(f), `absent du cache hors ligne : ${f}`);
  for (const f of list) if (f !== './') assert.ok(existsSync(join(pub, f)), `fichier inexistant : ${f}`);
  assert.doesNotMatch(sw, /https?:\/\//);
  assert.match(sw, /const VERSION = '/);
});

test('le service worker est enregistré par l\'éditeur et l\'accueil ; en-têtes adaptés', () => {
  assert.match(read('js/pwa.js'), /serviceWorker\.register\('sw\.js'\)/);
  assert.match(read('js/app.js'), /registerServiceWorker\(\)/);
  assert.match(read('js/home.js'), /registerServiceWorker\(\)/);
  const h = read('_headers');
  assert.match(h, /manifest-src 'self'/);
  assert.match(h, /\/sw\.js\n\s+Cache-Control: no-cache/);
});
