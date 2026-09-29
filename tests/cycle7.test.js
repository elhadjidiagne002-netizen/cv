// Cycle 7 : photo possible sur tous les modèles où l'usage l'admet, emplacement photo d'aperçu, famille « Raffinés ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSampleCV } from '../public/js/model.js';
import { renderCV, TEMPLATES, getTemplate } from '../public/js/render.js';
import { checkCV } from '../public/js/norms.js';
import { cvPlainText } from '../public/js/plaintext.js';

const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z';
const NO_PHOTO = ['us-resume', 'uk-cv', 'quebec', 'canada-en'];

test('photo possible sur tous les modèles sauf les formats où elle est proscrite (US, UK, Canada)', () => {
  const cv = createSampleCV();
  cv.identity.photo = PHOTO;
  cv.privacy.showPhoto = true;
  assert.ok(TEMPLATES.length >= 45);
  for (const t of TEMPLATES) {
    const html = renderCV(cv, t.id);
    if (NO_PHOTO.includes(t.id)) {
      assert.equal(t.photo, false, t.id);
      assert.doesNotMatch(html, /<img/, t.id);
    } else {
      assert.equal(t.photo, true, t.id);
      assert.match(html, /<img class="cv-photo" src="data:image\/jpeg/, t.id);
    }
  }
  // La photo reste masquée par défaut (norme de non-discrimination).
  assert.doesNotMatch(renderCV(createSampleCV(), 'sobre'), /<img/);
});

test('emplacement photo : seulement dans l\'aperçu, jamais à l\'impression ni en mode anonyme, et non lu', () => {
  const cv = createSampleCV();
  const preview = renderCV(cv, 'prestige', { photoSlot: true });
  assert.match(preview, /<span class="cv-photo cv-photo-slot" aria-hidden="true" data-photo-slot><span>Ajouter une photo<\/span><\/span>/);
  assert.doesNotMatch(renderCV(cv, 'prestige'), /cv-photo-slot/, 'rendu d\'impression sans emplacement');
  assert.doesNotMatch(renderCV(cv, 'us-resume', { photoSlot: true }), /cv-photo-slot/, 'jamais sur un résumé US');
  cv.identity.photo = PHOTO;
  assert.match(renderCV(cv, 'sobre', { photoSlot: true }), /Afficher la photo/, 'photo enregistrée mais masquée');
  cv.privacy.showPhoto = true;
  assert.doesNotMatch(renderCV(cv, 'sobre', { photoSlot: true }), /cv-photo-slot/, 'photo affichée : pas d\'emplacement');
  cv.meta.anonymous = true;
  assert.doesNotMatch(renderCV(cv, 'sobre', { photoSlot: true }), /cv-photo-slot|<img/);
  assert.doesNotMatch(cvPlainText(createSampleCV(), 'prestige'), /Ajouter une photo/);
  const css = readFileSync(new URL('../public/css/cv-base.css', import.meta.url), 'utf8');
  assert.match(css, /@media print \{ \.cv-photo-slot \{ display: none !important; \} \}/);
});

test('famille « Raffinés » : 12 modèles décrits, ATS pour ceux à une colonne, sans style inline, exemple conforme', () => {
  const refined = TEMPLATES.filter((t) => t.family === 'refined');
  assert.equal(refined.length, 12);
  const cv = createSampleCV();
  for (const t of refined) {
    assert.ok(t.name && t.description.length > 40 && t.category === 'Raffiné', t.id);
    assert.equal(t.ats, t.columns === 1 && !['diplomate', 'sahel'].includes(t.id), `${t.id} : statut ATS cohérent`);
    const html = renderCV(cv, t.id, { photoSlot: true });
    assert.doesNotMatch(html, /style="/, t.id);
    assert.match(html, /<h2 class="cv-h">Expérience professionnelle<\/h2>/, `${t.id} : titres standard`);
    // Ordre de lecture : nom avant l'expérience, expérience avant la formation (ordre choisi par l'utilisateur).
    assert.ok(html.indexOf('Awa Ndiaye') < html.indexOf('Expérience professionnelle'), t.id);
    const errors = checkCV(cv, t, { pages: 1, today: new Date('2026-09-29') }).issues.filter((i) => i.severity === 'error');
    assert.deepEqual(errors, [], t.id);
  }
  assert.equal(getTemplate('saint-louis').sidePosition, 'right');
  const html = renderCV(cv, 'saint-louis');
  assert.ok(html.indexOf('class="cv-main"') < html.indexOf('class="cv-side"'), 'colonne de droite rendue après la principale');
});

test('CSS des modèles raffinés : couleurs d\'origine = première palette, aucune police sous 9 pt', () => {
  const css = readFileSync(new URL('../public/css/templates.css', import.meta.url), 'utf8');
  for (const t of TEMPLATES.filter((x) => x.family === 'refined')) {
    const rule = css.match(new RegExp(`\\.tpl-${t.id} \\{[^}]*--accent: (#[0-9a-f]{6})`, 'i'));
    assert.ok(rule, `${t.id} : règle de base`);
    assert.equal(rule[1].toLowerCase(), t.palettes[0].accent.toLowerCase(), `${t.id} : accent d'origine`);
  }
  const block = css.slice(css.indexOf('Famille « Raffinés »'));
  for (const m of block.matchAll(/font-size:\s*([\d.]+)pt/g)) assert.ok(Number(m[1]) >= 9, m[0]);
});
