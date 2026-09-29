// Cycle 6 : sauvegarde complète et restauration, numéros de page, confidentialité (effacement), 404.
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

test('sauvegarde complète : tout effacer puis tout restaurer (CV, lettres, candidatures), sans doublon', async ({ page }) => {
  const errors = watchErrors(page);
  // Deux CV, une lettre, une candidature.
  await page.click('button[data-doc="letter"]');
  await page.fill('#f-letter-organization', 'Sonatel');
  await page.click('button[data-doc="cv"]');
  await page.click('#new-menu > summary');
  await page.click('button[data-new="sample-junior"]');
  await expect(page.locator('#preview .cv-name')).toHaveText('Moussa Diop');
  await page.click('#btn-apps');
  await page.fill('#app-company', 'Senelec');
  await page.click('#app-save');
  await page.click('#apps-close');
  await page.click('#formats-menu > summary');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-backup')]);
  expect(dl.suggestedFilename()).toMatch(/^sauvegarde-cv-en-ligne-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = readFileSync(await dl.path());
  const data = JSON.parse(backup.toString('utf8'));
  expect(data.format).toBe('cv-en-ligne-sauvegarde');
  expect(data.cvs).toHaveLength(2);
  expect(data.applications).toHaveLength(1);
  // Nouvel appareil : navigateur vide.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.setInputFiles('#file-import', { name: 'sauvegarde.json', mimeType: 'application/json', buffer: backup });
  await expect(page.locator('#toast')).toContainText('Sauvegarde restaurée');
  await expect(page.locator('#toast')).toContainText('1 candidature');
  const titles = await page.locator('#cv-select option').allTextContents();
  expect(titles.filter((t) => /Awa Ndiaye/.test(t))).toHaveLength(2); // l'exemple recréé au démarrage + celui restauré
  expect(titles.some((t) => /Moussa Diop/.test(t))).toBe(true);
  await page.selectOption('#cv-select', { label: titles.find((t) => /Awa Ndiaye/.test(t) && t !== titles[0]) || titles[1] });
  await page.click('#btn-apps');
  await expect(page.locator('.app-card')).toContainText('Senelec');
  await page.click('#apps-close');
  // Restaurer une seconde fois : rien n'est dupliqué.
  const count = await page.locator('#cv-select option').count();
  await page.setInputFiles('#file-import', { name: 'sauvegarde.json', mimeType: 'application/json', buffer: backup });
  await expect(page.locator('#toast')).toContainText('déjà à jour');
  await expect(page.locator('#cv-select option')).toHaveCount(count);
  expect(errors).toEqual([]);
});

test('numéros de page : option dans les réglages, appliquée seulement aux CV de plusieurs pages', async ({ page }) => {
  await expect(page.locator('#set-pagenumbers')).toBeChecked();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root .cv')).not.toHaveClass(/numbered/);
  await page.evaluate(() => {
    const { state } = window.__cvApp;
    const base = JSON.parse(JSON.stringify(state.cv.experiences));
    for (let i = 0; i < 3; i += 1) state.cv.experiences.push(...JSON.parse(JSON.stringify(base)));
  });
  await page.fill('#set-title', 'Long');
  await expect(page.locator('#template-info')).toContainText('2 pages');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root .cv')).toHaveClass(/numbered/);
  await page.uncheck('#set-pagenumbers');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#print-root .cv')).not.toHaveClass(/numbered/);
  const pdf = await (async () => {
    await page.check('#set-pagenumbers');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    return page.pdf({ preferCSSPageSize: true, printBackground: true });
  })();
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(2);
});

test('confidentialité : page liée depuis l\'accueil, effacement de toutes les données', async ({ page }) => {
  const errors = watchErrors(page);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cvapp.')).length)).toBeGreaterThan(0);
  await page.goto('/index.html');
  await page.click('.home-footer a[href="confidentialite.html"]');
  await expect(page.locator('h1')).toHaveText('Confidentialité et données personnelles');
  page.once('dialog', (d) => d.accept());
  await page.click('#btn-wipe');
  await expect(page.locator('#wipe-status')).toContainText('Données effacées');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cvapp.')).length)).toBe(0);
  await page.goto('/404.html');
  await expect(page.locator('h1')).toHaveText('Page introuvable');
  await expect(page.locator('a[href="app.html"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('bandeau de nouvelle version : masqué tant qu\'aucune mise à jour n\'est installée', async ({ page }) => {
  await expect(page.locator('#update-bar')).toBeHidden();
});
