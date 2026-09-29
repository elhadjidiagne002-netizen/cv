import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderCV, TEMPLATES, getTemplate, buildView } from '../public/js/render.js';
import { templateMeta } from '../public/js/templates/index.js';
import { createSampleCV, createEmptyCV, createSampleCVEnglish, cloneCV } from '../public/js/model.js';
import { LABELS } from '../public/js/i18n.js';

const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z';

/** Texte visible, dans l'ordre du document (ce que lit un ATS). */
function text(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

function withEverything() {
  const cv = createSampleCV();
  cv.identity.photo = PHOTO;
  cv.identity.birthDate = '1995-04-12';
  cv.identity.nationality = 'Sénégalaise';
  cv.identity.maritalStatus = 'Mariée';
  cv.privacy = { showPhoto: true, showBirthDate: true, showNationality: true, showMaritalStatus: true, showDrivingLicence: true };
  cv.projects = [{ id: 'p1', name: 'Projet', role: 'Cheffe', date: '2021-06', url: 'exemple.sn', description: 'Lancer une vitrine' }];
  cv.references = [{ id: 'r1', name: 'Mamadou Sow', position: 'Directeur', company: 'Teranga', contact: 'm.sow@example.com' }];
  return cv;
}

test('au moins 12 modèles, identifiants uniques, métadonnées complètes', () => {
  assert.ok(TEMPLATES.length >= 12, `${TEMPLATES.length} modèles`);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    const m = templateMeta(t);
    assert.equal(typeof m.name, 'string', t.id);
    assert.equal(typeof m.category, 'string', t.id);
    assert.equal(typeof m.ats, 'boolean', t.id);
    assert.ok([1, 2].includes(m.columns), t.id);
    assert.equal(typeof m.photo, 'boolean', t.id);
    assert.ok(['A4', 'Letter'].includes(m.format), t.id);
    assert.ok(m.description.length > 20, t.id);
    assert.equal(typeof t.render, 'function', t.id);
    assert.equal('render' in m, false);
  }
});

test('modèles obligatoires : 4 ATS une colonne, 1 Europass, 1 résumé US', () => {
  const ats1 = TEMPLATES.filter((t) => t.ats && t.columns === 1 && t.category === 'ATS');
  assert.ok(ats1.length >= 4, `${ats1.length} modèles ATS une colonne`);
  assert.ok(TEMPLATES.some((t) => t.category === 'Europass'));
  const us = getTemplate('us-resume');
  assert.equal(us.format, 'Letter');
  assert.equal(us.photo, false);
  assert.equal(us.lang, 'en');
  assert.equal(us.ats, true);
});

test('les modèles ATS sont bien à une colonne et les créatifs à colonnes sont signalés', () => {
  for (const t of TEMPLATES) {
    if (t.ats) assert.equal(t.columns, 1, `${t.id} : un modèle ATS doit avoir une seule colonne`);
    if (t.columns > 1) assert.equal(t.ats, false, `${t.id} : un modèle à colonnes n'est pas ATS`);
  }
});

test('le rendu fonctionne pour chaque modèle (exemple, vide, anglais, complet, anonyme)', () => {
  const cases = { exemple: createSampleCV(), vide: createEmptyCV(), anglais: createSampleCVEnglish(), complet: withEverything() };
  for (const t of TEMPLATES) {
    for (const [nom, cv] of Object.entries(cases)) {
      const html = renderCV(cv, t.id);
      assert.match(html, /^<article class="cv [^"]*" lang="(fr|en)" data-template="[a-z0-9-]+" data-paper="(A4|Letter)">/, `${t.id}/${nom}`);
      assert.ok(html.endsWith('</article>'), `${t.id}/${nom}`);
      assert.ok(html.includes(`tpl-${t.id}`), `${t.id}/${nom}`);
      assert.doesNotMatch(html, /undefined|null|NaN|\[object Object\]/, `${t.id}/${nom}`);
    }
    const anon = renderCV(withEverything(), t.id, { anonymous: true });
    assert.doesNotMatch(anon, /Ndiaye|awa\.ndiaye|\+221|<img|1995|Mariée|Mamadou/, `${t.id} anonyme`);
  }
});

test('le contenu est échappé (pas d\'injection HTML dans l\'aperçu)', () => {
  const cv = createSampleCV();
  cv.identity.firstName = '<script>alert(1)</script>';
  cv.summary = '<img src=x onerror=alert(1)>';
  cv.experiences[0].description = '"><svg onload=alert(1)>';
  cv.identity.linkedin = 'javascript:alert(1)';
  for (const t of TEMPLATES) {
    const html = renderCV(cv, t.id);
    assert.doesNotMatch(html, /<script|<svg|<img src=x/i, t.id);
    assert.doesNotMatch(html, /href="javascript:/i, t.id);
  }
});

test('aucun attribut style="" (interdit par la CSP) ni ressource externe', () => {
  for (const t of TEMPLATES) {
    const html = renderCV(withEverything(), t.id);
    assert.doesNotMatch(html, /\sstyle=/, t.id);
    assert.doesNotMatch(html, /src="https?:/, t.id);
  }
});

test('chaque modèle a ses styles dans templates.css', () => {
  const css = readFileSync(new URL('../public/css/templates.css', import.meta.url), 'utf8');
  for (const t of TEMPLATES) assert.ok(css.includes(`.tpl-${t.id}`), `styles manquants pour ${t.id}`);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/, 'aucune ressource externe');
  assert.doesNotMatch(css, /@import/);
});

test('ordre de lecture ATS : nom, titre, coordonnées, accroche, expérience, formation', () => {
  const cv = createSampleCV();
  for (const t of TEMPLATES.filter((x) => x.ats)) {
    const html = renderCV(cv, t.id);
    const txt = text(html);
    const lang = t.lang || 'fr';
    const labels = { ...LABELS[lang], ...(t.labels ? t.labels[lang] : {}) };
    const pos = [
      txt.indexOf('Awa Ndiaye'),
      txt.indexOf(cv.targetTitle),
      txt.indexOf('awa.ndiaye@example.com'),
      txt.indexOf(labels.summary),
      txt.indexOf(labels.experiences),
      txt.indexOf(labels.education),
    ];
    assert.ok(pos.every((p) => p >= 0), `${t.id} : élément manquant ${JSON.stringify(pos)}`);
    assert.deepEqual([...pos].sort((a, b) => a - b), pos, `${t.id} : ordre de lecture incorrect ${JSON.stringify(pos)}`);
    // Structure : pas de tableau de mise en page, pas de colonnes, titres h1/h2 réels.
    assert.doesNotMatch(html, /<table|cv-cols|<aside/, t.id);
    assert.equal((html.match(/<h1 /g) || []).length, 1, `${t.id} : un seul h1 (le nom)`);
    // Les expériences suivent l'ordre antéchronologique des données.
    const i1 = txt.indexOf(cv.experiences[0].employer);
    const i2 = txt.indexOf(cv.experiences[1].employer);
    assert.ok(i1 < i2, `${t.id} : expériences dans l'ordre`);
  }
});

test('titres de rubriques standard uniquement', () => {
  const allowed = new Set([
    ...Object.values(LABELS.fr), ...Object.values(LABELS.en),
    ...TEMPLATES.flatMap((t) => (t.labels ? Object.values(t.labels).flatMap((l) => Object.values(l)) : [])),
  ].filter((v) => typeof v === 'string'));
  for (const t of TEMPLATES) {
    const html = renderCV(withEverything(), t.id);
    const titles = [...html.matchAll(/<h2 class="cv-h">([^<]*)<\/h2>/g)].map((m) => m[1].replace(/&#39;/g, "'"));
    assert.ok(titles.length >= 5, t.id);
    for (const title of titles) assert.ok(allowed.has(title), `${t.id} : titre non standard « ${title} »`);
  }
});

test('résumé US : anglais, Letter, sans photo, sans date de naissance ni situation familiale', () => {
  const html = renderCV(withEverything(), 'us-resume');
  assert.match(html, /lang="en"/);
  assert.match(html, /data-paper="Letter"/);
  assert.doesNotMatch(html, /<img|1995|Mariée|Sénégalaise|Date of birth|Nationality/);
  assert.match(html, /Professional Experience/);
  assert.match(html, /Education/);
  assert.doesNotMatch(html, /Expérience professionnelle|Formation</);
});

test('CV britannique : anglais, sans photo ni informations personnelles', () => {
  const html = renderCV(withEverything(), 'uk-cv');
  assert.match(html, /lang="en"/);
  assert.doesNotMatch(html, /<img|1995|Mariée/);
});

test('Europass : intitulés officiels et langues maternelles distinguées', () => {
  const html = renderCV(createSampleCV(), 'europass');
  assert.match(html, /Éducation et formation/);
  assert.match(html, /Compétences linguistiques/);
  assert.match(html, /Langue\(s\) maternelle\(s\)/);
});

test('les champs sensibles n\'apparaissent que si l\'utilisateur les affiche', () => {
  const cv = withEverything();
  cv.privacy = { showPhoto: false, showBirthDate: false, showNationality: false, showMaritalStatus: false, showDrivingLicence: false };
  for (const t of TEMPLATES) {
    const html = renderCV(cv, t.id);
    assert.doesNotMatch(html, /<img|12\/04\/1995|Mariée|Sénégalaise/, t.id);
  }
  const shown = renderCV(withEverything(), 'classique');
  assert.match(shown, /<img class="cv-photo"/);
  assert.match(shown, /12\/04\/1995/);
  assert.doesNotMatch(renderCV(withEverything(), 'sobre'), /<img/, 'Sobre ne prévoit pas de photo');
});

test('ordre des rubriques choisi par l\'utilisateur respecté', () => {
  const cv = createSampleCV();
  cv.meta.sectionOrder = ['education', 'experiences', ...cv.meta.sectionOrder.filter((s) => !['education', 'experiences'].includes(s))];
  const txt = text(renderCV(cv, 'sobre'));
  assert.ok(txt.indexOf('Formation') < txt.indexOf('Expérience professionnelle'));
});

test('format de papier : A4 par défaut, Letter sur demande, imposé pour le résumé US', () => {
  const cv = createSampleCV();
  assert.match(renderCV(cv, 'sobre'), /paper-a4/);
  cv.meta.paper = 'Letter';
  assert.match(renderCV(cv, 'sobre'), /paper-letter/);
  cv.meta.paper = 'A4';
  assert.match(renderCV(cv, 'us-resume'), /paper-letter/);
});

test('buildView n\'altère pas le CV source', () => {
  const cv = withEverything();
  const before = JSON.stringify(cv);
  buildView(cv, getTemplate('dakar'), { anonymous: true });
  renderCV(cloneCV(cv), 'dakar', { anonymous: true });
  assert.equal(JSON.stringify(cv), before);
});
