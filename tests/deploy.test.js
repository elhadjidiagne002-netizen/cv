// Mise en ligne : la CSP en <meta> (hébergeurs sans en-têtes personnalisés) reste identique à celle de _headers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const directives = (csp) => csp.split(';').map((d) => d.trim()).filter(Boolean).sort();

test('CSP en <meta> identique à _headers (sauf frame-ancestors, réservé aux en-têtes HTTP)', () => {
  const header = read('public/_headers').match(/Content-Security-Policy: (.+)/)[1];
  const expected = directives(header).filter((d) => !d.startsWith('frame-ancestors'));
  for (const page of ['public/index.html', 'public/app.html']) {
    const meta = read(page).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    assert.ok(meta, page);
    assert.deepEqual(directives(meta[1]), expected, page);
    assert.match(read(page), /<meta name="referrer" content="no-referrer">/);
  }
});

test('workflow de mise en ligne : tests avant publication, dossier public/ publié tel quel', () => {
  const wf = read('.github/workflows/pages.yml');
  assert.match(wf, /branches: \[main\]/);
  assert.match(wf, /run: npm test/);
  assert.match(wf, /needs: tests/);
  assert.match(wf, /path: public/);
  assert.ok(existsSync(new URL('../public/index.html', import.meta.url)));
});
