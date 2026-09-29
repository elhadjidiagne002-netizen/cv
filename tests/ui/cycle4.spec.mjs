// Cycle 4 : rubriques personnalisées, export Word et JSON Resume, types de lettre. Sous la vraie CSP.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

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

test('rubrique personnalisée : ajout, saisie, aperçu, déplacement, alerte de titre, annulation', async ({ page }) => {
  const errors = watchErrors(page);
  await page.fill('#new-custom-title', 'Stages');
  await page.click('button[data-act="custom-add"]');
  await expect(page.locator('#f-custom-0-items-0-title')).toBeFocused();
  await page.fill('#f-custom-0-items-0-title', 'Stage assistant comptable');
  await page.fill('#f-custom-0-items-0-subtitle', 'Cabinet Diallo, Dakar');
  await expect(page.locator('#preview .cv-s-custom h2')).toHaveText('Stages');
  await expect(page.locator('#preview .cv-s-custom')).toContainText('Cabinet Diallo, Dakar');
  // Placée en dernier, puis remontée d'un cran.
  const lastBefore = await page.evaluate(() => [...document.querySelectorAll('#preview .cv-section')].pop().dataset.section);
  expect(lastBefore).toMatch(/^custom:/);
  await page.locator('details[data-section^="custom:"] button[data-act="section-up"]').click();
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#preview .cv-section')].pop().dataset.section)).not.toMatch(/^custom:/);
  // Titre fantaisiste : alerte qui ramène au champ.
  await page.fill('#f-custom-0-title', '★ Mes aventures ★');
  const alert = page.locator('#norms .issue-link', { hasText: 'peu standard' });
  await expect(alert).toBeVisible();
  await page.fill('#f-custom-0-title', 'Stages');
  await page.locator('#f-custom-0-title').blur();
  // Suppression puis annulation.
  page.once('dialog', (d) => d.accept());
  await page.locator('button[data-act="custom-remove"]').click();
  await expect(page.locator('#preview .cv-s-custom')).toHaveCount(0);
  await page.click('#btn-undo');
  await expect(page.locator('#preview .cv-s-custom')).toContainText('Stage assistant comptable');
  await page.reload();
  await expect(page.locator('#preview .cv-s-custom')).toContainText('Stage assistant comptable');
  expect(errors).toEqual([]);
});

test('export Word du CV et de la lettre ; export puis import JSON Resume', async ({ page }) => {
  await page.click('#formats-menu > summary');
  const [cvDoc] = await Promise.all([page.waitForEvent('download'), page.click('#btn-docx')]);
  expect(cvDoc.suggestedFilename()).toMatch(/\.docx$/);
  const bytes = readFileSync(await cvDoc.path());
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  expect(bytes.toString('utf8')).toContain('Awa Ndiaye');
  await page.click('button[data-doc="letter"]');
  await page.click('button[data-act="letter-draft"]');
  await page.click('#formats-menu > summary');
  await expect(page.locator('#btn-docx')).toHaveText('Lettre au format Word (.docx)');
  const [letterDoc] = await Promise.all([page.waitForEvent('download'), page.click('#btn-docx')]);
  expect(letterDoc.suggestedFilename()).toMatch(/^lettre-.*\.docx$/);
  await page.click('button[data-doc="cv"]');
  await page.click('#formats-menu > summary');
  const [jr] = await Promise.all([page.waitForEvent('download'), page.click('#btn-jsonresume')]);
  const json = JSON.parse(readFileSync(await jr.path(), 'utf8'));
  expect(json.basics.name).toBe('Awa Ndiaye');
  expect(json.work).toHaveLength(3);
  // Réimport : un nouveau CV est créé à partir du fichier JSON Resume.
  await page.setInputFiles('#file-import', { name: 'resume.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
  await expect(page.locator('#toast')).toContainText('JSON Resume');
  await expect(page.locator('#cv-select option:checked')).toHaveText('Awa Ndiaye (JSON Resume)');
  await expect(page.locator('#preview .cv-s-experiences')).toContainText('Teranga Distribution');
});

test('lettre : demande de stage, puis relance (courte)', async ({ page }) => {
  await page.click('button[data-doc="letter"]');
  await page.selectOption('#f-letter-kind', 'stage');
  await expect(page.locator('#f-letter-kind')).toBeFocused();
  await page.click('button[data-act="letter-draft"]');
  await expect(page.locator('#f-letter-subject')).toHaveValue(/^Demande de stage/);
  await expect(page.locator('#preview .lt-body')).toContainText('convention de stage');
  await page.selectOption('#f-letter-kind', 'relance');
  page.once('dialog', (d) => d.accept());
  await page.click('button[data-act="letter-draft"]');
  await expect(page.locator('#f-letter-subject')).toHaveValue(/^Relance/);
  await expect(page.locator('#template-info')).toContainText('mots');
  await expect(page.locator('#norms .issue-link', { hasText: 'mots :' })).toHaveCount(0);
});

test('galerie : un clic sur la miniature (inerte pour le clavier) choisit bien le modèle', async ({ page }) => {
  await page.click('#btn-gallery');
  await page.locator('#gallery-grid button[data-template="classique"] .thumb').click();
  await expect(page.locator('#preview .cv')).toHaveClass(/tpl-classique/);
  const focusableInThumbs = await page.evaluate(() => [...document.querySelectorAll('#gallery-grid .thumb a')].filter((a) => !a.closest('[inert]')).length);
  expect(focusableInThumbs).toBe(0);
});
