// Mise en ligne : la CSP en <meta> (hébergeurs sans en-têtes personnalisés) reste identique à celle de _headers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const directives = (csp) => csp.split(';').map((d) => d.trim()).filter(Boolean).sort();

test('CSP en <meta> identique à _headers (sauf frame-ancestors, réservé aux en-têtes HTTP)', () => {
  const header = read('public/_headers').match(/Content-Security-Policy: (.+)/)[1];
  const expected = directives(header).filter((d) => !d.startsWith('frame-ancestors'));
  for (const page of ['public/index.html', 'public/app.html', 'public/confidentialite.html', 'public/404.html']) {
    const meta = read(page).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    assert.ok(meta, page);
    assert.deepEqual(directives(meta[1]), expected, page);
    assert.match(read(page), /<meta name="referrer" content="no-referrer">/);
  }
});

test('workflow de mise en ligne : tests avant publication, dossier public/ publié tel quel', () => {
  const wf = read('.github/workflows/pages.yml');
  assert.match(wf, /on:\n  push:\n  pull_request:/);
  assert.match(wf, /if: github\.event_name == 'workflow_dispatch'/, 'GitHub Pages seulement à la demande');
  assert.match(wf, /run: npm test/);
  assert.match(wf, /needs: tests/);
  assert.match(wf, /path: public/);
  assert.ok(existsSync(new URL('../public/index.html', import.meta.url)));
});

test('site public : robots.txt, sitemap, aperçu de partage, page de confidentialité liée', () => {
  assert.match(read('public/robots.txt'), /Sitemap: https:\/\/cv-en-ligne\.pages\.dev\/sitemap\.xml/);
  const sitemap = read('public/sitemap.xml');
  for (const loc of sitemap.match(/<loc>[^<]+<\/loc>/g)) {
    const file = loc.replace(/<\/?loc>/g, '').replace('https://cv-en-ligne.pages.dev/', '') || 'index.html';
    assert.ok(existsSync(new URL(`../public/${file}`, import.meta.url)), file);
  }
  const index = read('public/index.html');
  assert.match(index, /<meta property="og:image" content="https:\/\/cv-en-ligne\.pages\.dev\/icons\/icon-512\.png">/);
  assert.match(index, /href="confidentialite\.html"/);
  assert.match(read('public/confidentialite.html'), /id="btn-wipe"/);
});
