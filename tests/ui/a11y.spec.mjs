// Audit d'accessibilité automatisé (axe-core, règles WCAG 2.0 / 2.1 / 2.2 niveaux A et AA).
// axe est injecté dans la page : la CSP est contournée pour ce seul fichier de tests (le site, lui, reste strict).
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

test.use({ bypassCSP: true });

async function audit(page, include) {
  await page.addScriptTag({ path: AXE_PATH });
  const result = await page.evaluate(async (ctx) => window.axe.run(ctx || document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    resultTypes: ['violations'],
  }), include || null);
  return result.violations.map((v) => `${v.id} (${v.impact}) : ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
});

test('accueil : aucune violation WCAG A/AA', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#hero-cv .cv')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('éditeur du CV (toutes les rubriques ouvertes, aide par métier) : aucune violation', async ({ page }) => {
  await page.reload();
  await expect(page.locator('#preview .cv')).toBeVisible();
  await page.selectOption('#set-country', 'SNFP');
  await page.fill('#new-custom-title', 'Stages');
  await page.click('button[data-act="custom-add"]');
  await page.evaluate(() => document.querySelectorAll('#sections details').forEach((d) => { d.open = true; }));
  await page.selectOption('#helper-job', 'comptable');
  await page.evaluate(() => document.querySelectorAll('#sections details, #match-box').forEach((d) => { d.open = true; }));
  expect(await audit(page)).toEqual([]);
});

test('lettre de motivation, galerie et dialogue « texte brut » : aucune violation', async ({ page }) => {
  await page.reload();
  await page.click('button[data-doc="letter"]');
  await page.click('button[data-act="letter-draft"]');
  expect(await audit(page)).toEqual([]);
  await page.click('#btn-gallery');
  await expect(page.locator('#gallery-grid .tpl-card').first()).toBeVisible();
  expect(await audit(page, '#gallery')).toEqual([]);
  await page.click('#gallery-close');
  await page.click('#btn-text');
  expect(await audit(page, '#text-dlg')).toEqual([]);
});

test('téléphone (390 px) : aucune violation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('#preview .cv')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});
