// Cycle 2 : catalogue de modèles, palettes, polices libres, ajustement à 1 page, nouvelles rubriques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { renderCV, TEMPLATES, getTemplate, themeVars, effectivePalette, buildView } from '../public/js/render.js';
import { PALETTES } from '../public/js/templates/palettes.js';
import { createSampleCV, createItem, normalizeCV, MAX_FIT } from '../public/js/model.js';

const css = (f) => readFileSync(new URL(`../public/css/${f}`, import.meta.url), 'utf8');

/** Luminance relative et contraste WCAG. */
function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test('au moins 30 modèles et toutes les nouvelles familles', () => {
  assert.ok(TEMPLATES.length >= 30, `${TEMPLATES.length} modèles`);
  for (const id of ['chronologique', 'academique', 'fonctionnel', 'reconversion', 'etudiant', 'premier-emploi', 'metiers', 'technicien', 'quebec', 'canada-en', 'lebenslauf']) {
    assert.equal(getTemplate(id).id, id, id);
  }
  const cats = new Set(TEMPLATES.map((t) => t.category));
  for (const c of ['ATS', 'Académique', 'Reconversion', 'Étudiant', 'Métiers', 'Canada', 'Allemagne']) assert.ok(cats.has(c), c);
});

test('chaque modèle propose 3 à 5 palettes lisibles (contraste ≥ 4,5:1)', () => {
  for (const t of TEMPLATES) {
    assert.ok(t.palettes && t.palettes.length >= 3 && t.palettes.length <= 5, `${t.id} : ${t.palettes?.length} palettes`);
    assert.equal(new Set(t.palettes.map((p) => p.id)).size, t.palettes.length, t.id);
  }
  for (const [id, p] of Object.entries(PALETTES)) {
    assert.ok(contrast(p.accent, '#ffffff') >= 4.5, `${id} : accent sur blanc`);
    assert.ok(contrast(p.deep, p.soft) >= 4.5, `${id} : encre foncée sur fond clair`);
    assert.ok(contrast(p.accent, p.soft) >= 4.5, `${id} : accent sur fond clair`);
  }
});

test('palette : couleurs d\'origine par défaut, variables CSS sinon, accent libre prioritaire', () => {
  const cv = createSampleCV();
  const tpl = getTemplate('dakar');
  assert.deepEqual(themeVars(cv, tpl), {});
  cv.meta.palette = 'ocean';
  assert.equal(effectivePalette(cv, tpl).id, 'ocean');
  const v = themeVars(cv, tpl);
  assert.equal(v['--accent'], PALETTES.ocean.accent);
  assert.equal(v['--side-bg'], PALETTES.ocean.soft, 'colonne claire');
  assert.equal(themeVars(cv, getTemplate('ardoise'))['--accent'], undefined, 'palette absente du modèle → origine');
  cv.meta.palette = 'bordeaux';
  assert.equal(themeVars(cv, getTemplate('ardoise'))['--side-bg'], PALETTES.bordeaux.accent, 'colonne sombre');
  cv.meta.accent = '#123456';
  assert.equal(themeVars(cv, tpl)['--accent'], '#123456');
  // Jamais d'attribut style="" : le thème passe par le CSSOM.
  assert.doesNotMatch(renderCV(cv, 'dakar'), /\sstyle=/);
});

test('polices libres locales : fichiers présents, licence OFL, aucune ressource externe', () => {
  const fonts = css('fonts.css');
  const urls = [...fonts.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 12);
  for (const u of urls) {
    assert.doesNotMatch(u, /^https?:|^\/\//, u);
    assert.ok(existsSync(new URL(`../public/css/${u}`, import.meta.url)), `police manquante : ${u}`);
  }
  const dir = new URL('../public/fonts/', import.meta.url);
  for (const fam of readdirSync(dir)) {
    const lic = readFileSync(new URL(`${fam}/OFL.txt`, dir), 'utf8');
    assert.match(lic, /SIL Open Font License/i, fam);
  }
  const html = readFileSync(new URL('../public/app.html', import.meta.url), 'utf8');
  assert.match(html, /css\/fonts\.css/);
  assert.doesNotMatch(html + fonts, /fonts\.googleapis|fonts\.gstatic/);
  // Les polices citées par les modèles sont bien déclarées.
  for (const fam of ['Inter', 'Lato', 'Source Serif 4', 'Merriweather', 'Montserrat', 'EB Garamond']) {
    assert.match(fonts, new RegExp(`font-family: '${fam}'`), fam);
  }
});

test('aucune taille de police sous 9 pt dans les styles du CV (y compris « ajuster à 1 page »)', () => {
  for (const f of ['cv-base.css', 'templates.css']) {
    for (const m of css(f).matchAll(/(?:font-size|--fs):\s*([\d.]+)pt/g)) assert.ok(Number(m[1]) >= 9, `${f} : ${m[0]}`);
  }
  const base = css('cv-base.css');
  for (let i = 1; i <= MAX_FIT; i += 1) assert.match(base, new RegExp(`\\.cv\\.fit-${i}`), `niveau ${i}`);
  assert.match(base, /@page \{ size: A4; margin: 12mm; \}/, 'marges d\'impression inchangées');
});

test('ajuster à 1 page : classe fit-N bornée, conservée dans le CV', () => {
  const cv = createSampleCV();
  assert.doesNotMatch(renderCV(cv, 'sobre'), /fit-/);
  cv.meta.fit = 2;
  assert.match(renderCV(cv, 'sobre'), /class="cv [^"]*fit-2/);
  assert.match(renderCV(cv, 'sobre', { fit: 9 }), new RegExp(`fit-${MAX_FIT}`));
  assert.equal(normalizeCV({ meta: { fit: 99 } }).meta.fit, 0);
  assert.equal(normalizeCV({ meta: { fit: 3 } }).meta.fit, 3);
});

test('distinctions et publications : rendu, échappement, libellés standard', () => {
  const cv = createSampleCV();
  cv.awards = [createItem('awards', { name: 'Prix <b>Jeune talent</b>', issuer: 'Orange', date: '2023-06' })];
  cv.publications = [createItem('publications', { title: 'Mobile money', authors: 'Ndiaye A.', venue: 'Revue X', date: '2021-05', url: 'doi.org/10.1/x' })];
  for (const t of TEMPLATES) {
    const html = renderCV(cv, t.id);
    assert.doesNotMatch(html, /<b>Jeune/, t.id);
    if (!(t.excludeSections || []).includes('publications')) assert.match(html, /Mobile money/, t.id);
  }
  const html = renderCV(cv, 'academique');
  assert.match(html, /Ndiaye A\. \(2021\)\. <span class="cv-pub-title">Mobile money<\/span>\. <em class="cv-pub-venue">Revue X<\/em>\./);
  assert.match(html, /Distinctions/);
  assert.match(renderCV(cv, 'us-resume'), /Awards/);
});

test('académique et étudiant : formation avant l\'expérience ; fonctionnel : compétences en tête', () => {
  const cv = createSampleCV();
  for (const id of ['academique', 'etudiant', 'premier-emploi']) {
    const h = renderCV(cv, id);
    assert.ok(h.indexOf('cv-s-education') < h.indexOf('cv-s-experiences'), id);
  }
  const f = renderCV(cv, 'fonctionnel');
  assert.ok(f.indexOf('Compétences clés') < f.indexOf('Expérience professionnelle'));
  assert.match(f, /cv-timeline-compact/);
  assert.doesNotMatch(f, /Piloter un budget/, 'parcours condensé');
  assert.match(renderCV(cv, 'reconversion'), /Piloter un budget/, 'hybride : réalisations conservées');
  const m = renderCV(cv, 'metiers');
  assert.ok(m.indexOf('cv-s-skills') < m.indexOf('cv-s-experiences'));
});

test('Canada / Québec : Letter, sans photo ni données personnelles', () => {
  const cv = createSampleCV();
  cv.identity.photo = 'data:image/jpeg;base64,AAAA';
  cv.identity.birthDate = '1995-04-12';
  cv.privacy.showPhoto = true;
  cv.privacy.showBirthDate = true;
  for (const id of ['quebec', 'canada-en']) {
    const h = renderCV(cv, id);
    assert.match(h, /data-paper="Letter"/, id);
    assert.doesNotMatch(h, /<img|1995/, id);
  }
  assert.match(renderCV(cv, 'quebec'), /lang="fr"/);
  assert.match(renderCV(cv, 'canada-en'), /lang="en"/);
});

test('Lebenslauf : dates à gauche, photo possible, informations personnelles regroupées, lieu et date', () => {
  const cv = createSampleCV();
  cv.identity.birthDate = '1995-04-12';
  cv.privacy.showBirthDate = true;
  const view = buildView(cv, getTemplate('lebenslauf'), { today: new Date(2026, 8, 29) });
  const h = getTemplate('lebenslauf').render(view);
  assert.match(renderCV(cv, 'lebenslauf'), /class="cv [^"]*dates-left/);
  assert.match(h, /Informations personnelles/);
  assert.equal((h.match(/12\/04\/1995/g) || []).length, 1, 'date de naissance affichée une seule fois');
  assert.match(h, /Fait à Dakar, le 29\/09\/2026/);
  assert.doesNotMatch(renderCV(cv, 'lebenslauf', { anonymous: true }), /Fait à|1995/);
});

test('les modèles « dates à gauche » gardent l\'ordre de lecture titre → dates', () => {
  const h = renderCV(createSampleCV(), 'chronologique');
  assert.ok(h.indexOf('Chargée de marketing digital</h3>') < h.indexOf('03/2022 – Aujourd'));
});
