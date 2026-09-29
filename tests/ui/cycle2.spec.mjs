// Cycle 2 : palettes, pays visé, ajuster à 1 page, correspondance avec une offre, hors ligne (PWA).
import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#preview .cv')).toBeVisible();
});

test('galerie : au moins 30 modèles, tous rendus sans erreur ni violation de CSP', async ({ page }) => {
  const errors = watchErrors(page);
  await page.click('#btn-gallery');
  await expect(page.locator('#gallery-grid .tpl-card')).toHaveCount(await page.evaluate(async () => (await import('/js/render.js')).TEMPLATES.length));
  expect(await page.locator('#gallery-grid .tpl-card').count()).toBeGreaterThanOrEqual(30);
  await page.click('#gallery-filters button[data-filter="Allemagne"]');
  await page.click('#gallery-grid button[data-template="lebenslauf"]');
  await expect(page.locator('#preview .cv')).toHaveClass(/tpl-lebenslauf/);
  await expect(page.locator('#preview .cv-place-date')).toContainText('Fait à Dakar');
  // Police libre embarquée effectivement chargée.
  expect(await page.evaluate(() => document.fonts.check('12px Inter'))).toBe(true);
  expect(errors).toEqual([]);
});

test('palette de couleurs : appliquée par le CSSOM à l\'aperçu et conservée', async ({ page }) => {
  const options = page.locator('#set-palette option');
  expect(await options.count()).toBeGreaterThanOrEqual(3);
  await page.selectOption('#set-palette', 'bordeaux');
  await expect(page.locator('#preview .cv')).toHaveCSS('--accent', '#6d1a2a');
  await expect(page.locator('#preview .cv-h').first()).toHaveCSS('color', 'rgb(109, 26, 42)');
  await expect(page.locator('#save-status')).toHaveText(/Enregistré/);
  await page.reload();
  await expect(page.locator('#set-palette')).toHaveValue('bordeaux');
});

test('pays visé : les règles changent et une correction s\'applique', async ({ page }) => {
  await page.selectOption('#set-country', 'CA');
  const fix = page.locator('#norms button[data-fix="paper:Letter"]');
  await expect(fix).toBeVisible();
  await fix.click();
  await expect(page.locator('#set-paper')).toHaveValue('Letter');
  await expect(page.locator('#preview .cv')).toHaveClass(/paper-letter/);
});

test('ajuster à 1 page : un CV un peu trop long tient sur une page, police ≥ 9 pt', async ({ page }) => {
  await page.evaluate(() => {
    const { state, store } = window.__cvApp;
    const extra = (n) => ({ id: `x${n}`, position: `Consultante marketing ${n}`, employer: 'Cabinet Kora', city: 'Dakar', start: '2018-01', end: '2018-12', current: false,
      description: 'Conduire des audits de marque pour 8 clients\nConcevoir des plans média de 10 M FCFA\nAnimer des ateliers de formation pour 40 commerciaux' });
    state.cv.experiences.push(extra(1), extra(2));
    state.cv.meta.templateId = 'sobre';
    store.save(state.cv);
  });
  await page.reload();
  await expect(page.locator('#template-info')).toContainText('2 pages');
  await page.click('#btn-fit');
  await expect(page.locator('#template-info')).toContainText('1 page ');
  await expect(page.locator('#preview .cv')).toHaveClass(/fit-\d/);
  const min = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#preview .cv *')]
    .filter((el) => el.textContent.trim() && el.children.length === 0)
    .map((el) => parseFloat(getComputedStyle(el).fontSize))));
  expect(min).toBeGreaterThanOrEqual(12); // 9 pt = 12 px
  await page.click('#btn-fit-reset');
  await expect(page.locator('#preview .cv')).not.toHaveClass(/fit-\d/);
});

test('correspondance avec une offre : score, mots manquants, ajout aux compétences', async ({ page }) => {
  await page.click('#match-box summary');
  await page.fill('#job-offer', 'Nous recherchons un(e) chargé(e) de marketing digital. Maîtrise de SEO, SQL, Power BI et HubSpot. Marketing digital et Google Ads.');
  await expect(page.locator('#match-result .match-score')).toContainText('%');
  const add = page.locator('#match-result button[data-add-kw="SQL"]');
  await expect(add).toBeVisible();
  const before = await page.locator('#match-sub').textContent();
  await add.click();
  await expect(page.locator('#preview .cv-s-skills')).toContainText('SQL');
  await expect(page.locator('#match-result button[data-add-kw="SQL"]')).toHaveCount(0);
  expect(await page.locator('#match-sub').textContent()).not.toBe(before);
  await page.reload();
  await expect(page.locator('#job-offer')).toHaveValue(/Power BI/);
});

test('nouvelles rubriques : ajouter une publication', async ({ page }) => {
  const section = page.locator('details[data-section="publications"]');
  await section.locator('summary').click();
  await section.locator('button[data-act="item-add"]').click();
  await page.fill('#f-publications-0-title', 'Le mobile money au Sénégal');
  await expect(page.locator('#preview .cv-s-publications')).toContainText('Le mobile money au Sénégal');
});

test('hors ligne : l\'éditeur se recharge sans connexion (service worker)', async ({ page, context }) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#preview .cv-name')).toHaveText('Awa Ndiaye');
  await page.goto('/index.html');
  await expect(page.locator('#hero-cv .cv-name')).toHaveText('Awa Ndiaye');
  await context.setOffline(false);
});
