// Parcours utilisateur de bout en bout, sous la vraie CSP (servie par tests/ui/server.mjs).
import { test, expect } from '@playwright/test';

/** Échoue si la page émet une erreur (dont les violations de CSP). */
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

test('l\'éditeur s\'ouvre sur l\'exemple, sans erreur ni violation de CSP', async ({ page }) => {
  const errors = watchErrors(page);
  await page.reload();
  await expect(page.locator('#preview .cv-name')).toHaveText('Awa Ndiaye');
  await expect(page.locator('#norms .norms-title')).toContainText('/100');
  await page.click('#btn-gallery');
  await page.click('#gallery-close');
  expect(errors).toEqual([]);
});

test('la saisie met à jour l\'aperçu et est sauvegardée automatiquement', async ({ page }) => {
  await page.fill('#f-identity-firstName', 'Fatou');
  await page.fill('#f-identity-lastName', 'Sarr');
  await expect(page.locator('#preview .cv-name')).toHaveText('Fatou Sarr');
  await expect(page.locator('#save-status')).toHaveText(/Enregistré/);
  await page.reload();
  await expect(page.locator('#f-identity-firstName')).toHaveValue('Fatou');
  await expect(page.locator('#preview .cv-name')).toHaveText('Fatou Sarr');
});

test('ajout, réordonnancement et suppression d\'une expérience', async ({ page }) => {
  const section = page.locator('details[data-section="experiences"]');
  await section.locator(':scope > summary').click();
  await expect(section.locator('.ed-item')).toHaveCount(3);
  await section.locator('button[data-act="item-add"]').click();
  await expect(section.locator('.ed-item')).toHaveCount(4);
  await expect(page.locator('#f-experiences-3-position')).toBeFocused();
  await page.fill('#f-experiences-3-position', 'Directrice commerciale');
  await section.locator('button[data-act="item-up"][data-index="3"]').click();
  await expect(page.locator('#f-experiences-2-position')).toHaveValue('Directrice commerciale');
  await expect(page.locator('#preview .cv-s-experiences')).toContainText('Directrice commerciale');
  await section.locator('button[data-act="item-remove"][data-index="2"]').click();
  await expect(section.locator('.ed-item')).toHaveCount(3);
  await expect(page.locator('#preview .cv-s-experiences')).not.toContainText('Directrice commerciale');
});

test('une alerte cliquable amène au champ à corriger ; correction automatique du tri', async ({ page }) => {
  await page.fill('#f-identity-email', 'bebe.love221@gmail.com');
  const issue = page.locator('#norms .issue-link', { hasText: 'e-mail peu professionnelle' });
  await expect(issue).toBeVisible();
  await issue.click();
  await expect(page.locator('#f-identity-email')).toBeFocused();

  const section = page.locator('details[data-section="experiences"]');
  await section.locator(':scope > summary').click();
  await section.locator('button[data-act="item-down"][data-index="0"]').click();
  const fix = page.locator('#norms button[data-fix="sort:experiences"]');
  await expect(fix).toBeVisible();
  await fix.click();
  await expect(page.locator('#norms button[data-fix="sort:experiences"]')).toHaveCount(0);
});

test('galerie : miniatures en direct et changement de modèle', async ({ page }) => {
  await page.click('#btn-gallery');
  const cards = page.locator('#gallery-grid .tpl-card');
  expect(await cards.count()).toBeGreaterThanOrEqual(12);
  await expect(page.locator('#gallery-grid .thumb .cv').first()).toBeAttached();
  await page.click('#gallery-filters button[data-filter="ATS"]');
  expect(await cards.count()).toBeGreaterThanOrEqual(4);
  await page.click('#gallery-filters button[data-filter="Tous"]');
  await page.click('#gallery-grid button[data-template="dakar"]');
  await expect(page.locator('#gallery')).not.toBeVisible();
  await expect(page.locator('#preview .cv')).toHaveClass(/tpl-dakar/);
  await expect(page.locator('#template-info')).toContainText('Dakar');
});

test('mode CV anonyme en un clic', async ({ page }) => {
  await page.click('#btn-anon');
  await expect(page.locator('#btn-anon')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview .cv-name')).toHaveText('Candidature anonyme');
  await expect(page.locator('#preview')).not.toContainText('awa.ndiaye@example.com');
  await page.click('#btn-anon');
  await expect(page.locator('#preview .cv-name')).toHaveText('Awa Ndiaye');
});

test('rubriques en anglais', async ({ page }) => {
  await page.selectOption('#set-lang', 'en');
  await expect(page.locator('#preview .cv-s-experiences .cv-h')).toHaveText('Professional Experience');
});

test('export JSON puis réimport', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const path = await download.path();
  await page.setInputFiles('#file-import', path);
  await expect(page.locator('#cv-select option')).toHaveCount(2);
});

test('impression : seul le CV est imprimé, en texte réel', async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('#print-root .cv')).toBeVisible();
  await expect(page.locator('#print-root .cv-name')).toHaveText('Awa Ndiaye');
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.length).toBeGreaterThan(10_000);
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(pages).toBe(1);
});

test('accessibilité : chaque champ a un libellé, lien d\'évitement au clavier', async ({ page }) => {
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
    .filter((el) => el.type !== 'hidden' && el.id !== 'file-import')
    .filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
    .map((el) => el.id || el.outerHTML.slice(0, 60)));
  expect(unlabeled).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link').first()).toBeFocused();
});

test('téléphone : pas de défilement horizontal, aperçu sous l\'éditeur', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.locator('#preview .cv')).toBeVisible();
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw).toBeLessThanOrEqual(iw);
  const editorBox = await page.locator('#editor').boundingBox();
  const previewBox = await page.locator('#preview-pane').boundingBox();
  expect(previewBox.y).toBeGreaterThan(editorBox.y);
});

test('page d\'accueil : aperçu réel et lien vers l\'éditeur', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html');
  await expect(page.locator('#hero-cv .cv-name')).toHaveText('Awa Ndiaye');
  await page.click('.hero-cta a[href="app.html"]');
  await expect(page).toHaveURL(/\/app(\.html)?$/); // Cloudflare Pages (et le serveur de test) redirigent app.html → /app
  expect(errors).toEqual([]);
});
