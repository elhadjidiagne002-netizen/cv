// Cycle 7 : emplacement photo cliquable dans l'aperçu, famille « Raffinés » dans la galerie.
import { test, expect } from '@playwright/test';

// Petite image JPEG valide (1 × 1 pixel).
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64');

test.beforeEach(async ({ page }) => {
  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#preview .cv')).toBeVisible();
});

test('emplacement photo : visible dans l\'aperçu, clic → choix d\'une photo, puis photo affichée ; absent du PDF', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const slot = page.locator('#preview .cv-photo-slot');
  await expect(slot).toHaveText('Ajouter une photo');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root .cv-photo-slot')).toHaveCount(0);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), slot.click()]);
  await chooser.setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await expect(page.locator('#preview img.cv-photo')).toBeVisible();
  await expect(page.locator('#preview .cv-photo-slot')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('galerie : filtre « Raffiné » avec 12 modèles, tous avec zone photo', async ({ page }) => {
  await page.click('#btn-gallery');
  await page.click('#gallery-filters button[data-filter="Raffiné"]');
  await expect(page.locator('#gallery-grid .tpl-card')).toHaveCount(12);
  await expect(page.locator('#gallery-grid .cv-photo-slot')).toHaveCount(12);
  await page.click('#gallery-grid button[data-template="baobab"]');
  await expect(page.locator('#preview .cv')).toHaveClass(/tpl-baobab/);
});
