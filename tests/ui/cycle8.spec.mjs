// Cycle 8 : administration (compte Devizo) et monétisation (4 types de pass, paiement Wave / Orange Money manuel).
// Chaque test a sa propre base (cookie « testdb ») : les autres tests gardent un site entièrement gratuit.
import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { totpAt } from '../../functions/_lib/devizo.js';

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // même secret que tests/ui/server.mjs
const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

/** Code actuel de l'application d'authentification (une connexion par base de test : pas de rejeu). */
const freshTotp = () => totpAt(SECRET, Math.floor(Date.now() / 30_000));

test.beforeEach(async ({ context }, info) => {
  await context.addCookies([{ name: 'testdb', value: info.testId.replace(/[^\w-]/g, ''), url: 'http://localhost:5611' }]);
});

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // 401 attendu : « suis-je connecté ? » avant la connexion.
    if (m.type() === 'error' && !/401/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function adminLogin(page) {
  await page.goto('/admin.html');
  await expect(page.locator('#login-view')).toBeVisible();
  await page.fill('#login-email', 'admin@nexusmarket.sn');
  await page.fill('#login-password', 'Mot-de-passe-1');
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#code-form')).toBeVisible();
  await expect(page.locator('#login-code-label')).toContainText('application d\'authentification');
  await page.fill('#login-code', await freshTotp());
  await page.click('#code-form button[type="submit"]');
  await expect(page.locator('#dash-view')).toBeVisible();
  await expect(page.locator('#who')).toHaveText('Connecté : admin@nexusmarket.sn');
}

/** Active la vente : numéro Wave, monétisation, offres « pass 30 jours » et « pack 3 téléchargements ». */
async function openShop(page) {
  await page.click('.admin-tabs button[data-tab="settings"]');
  await page.fill('#set-wave', '+221 77 123 45 67');
  await page.check('#set-money');
  await page.click('#settings-form button[type="submit"]');
  await expect(page.locator('#toast')).toHaveText('Réglages enregistrés.');
  await page.click('.admin-tabs button[data-tab="offers"]');
  for (const id of ['pass-30', 'pack-3']) {
    const form = page.locator(`form.offer-form[data-offer="${id}"]`);
    await form.locator('xpath=..').locator('summary').click();
    await form.locator('input[name="active"]').check();
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('#toast')).toHaveText('Offre enregistrée.');
  }
}

test('connexion avec le compte Devizo : mauvais mot de passe refusé, code à usage unique, déconnexion', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/admin.html');
  await page.fill('#login-email', 'admin@nexusmarket.sn');
  await page.fill('#login-password', 'faux');
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#login-error')).not.toBeEmpty();
  await adminLogin(page);
  await expect(page.locator('.admin-warn')).toContainText('désactivée');
  await expect(page.locator('.tile')).toHaveCount(5);
  await expect(page.locator('.chart svg')).toHaveCount(2);
  for (const tab of ['orders', 'offers', 'templates', 'codes', 'settings', 'audit']) {
    await page.click(`.admin-tabs button[data-tab="${tab}"]`);
    await expect(page.locator(`.admin-tabs button[data-tab="${tab}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#panel .admin-error')).toHaveCount(0);
  }
  await expect(page.locator('#panel')).toContainText('connexion');
  await page.reload();
  await expect(page.locator('#dash-view')).toBeVisible(); // session conservée (cookie HttpOnly)
  await page.click('#btn-logout');
  await expect(page.locator('#login-view')).toBeVisible();
  expect(errors).toEqual([]);
});

test('vente complète : commande Wave, validation par l\'admin, pass activé, téléchargement débloqué', async ({ page, context }) => {
  const errors = watchErrors(page);
  const admin = await context.newPage();
  await adminLogin(admin);
  await openShop(admin);

  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#btn-premium')).toBeVisible();
  await page.evaluate(() => { window.printed = 0; window.print = () => { window.printed += 1; }; });
  await page.click('#btn-gallery');
  await expect(page.locator('#gallery-grid button[data-template="prestige"]').locator('xpath=ancestor::*[contains(@class,"tpl-card")]')).toContainText('Premium');
  await page.click('#gallery-grid button[data-template="prestige"]');
  await expect(page.locator('#preview .cv')).toHaveClass(/tpl-prestige/);

  await page.click('#btn-print');
  await expect(page.locator('#unlock-dlg')).toBeVisible();
  await expect(page.locator('#unlock-reason')).toContainText('modèle premium');
  expect(await page.evaluate(() => window.printed)).toBe(0);
  await expect(page.locator('#order-form .offer-card')).toHaveCount(2);
  await page.fill('#order-phone', '77 555 44 33');
  await page.click('#order-form button[type="submit"]');
  await expect(page.locator('#order-result')).toContainText('2 000 FCFA');
  await expect(page.locator('#order-result')).toContainText('+221 77 123 45 67');
  const ref = (await page.locator('#order-result strong').first().textContent()).match(/CV[A-Z0-9]{6}/)[0];

  // Pas encore payé.
  await page.click(`button[data-unlock="check"][data-ref="${ref}"]`);
  await expect(page.locator('#toast')).toContainText('pas encore validé');

  // L'administrateur vérifie son application Wave puis valide.
  await admin.click('.admin-tabs button[data-tab="orders"]');
  const card = admin.locator('.order-card', { hasText: ref });
  await expect(card).toContainText('2 000 FCFA');
  admin.once('dialog', (d) => d.accept());
  await card.locator('button[data-order="validate"]').click();
  await expect(card.locator('.pay-ok')).toContainText('CV-');
  await expect(card.locator('.pay-ok a')).toHaveAttribute('href', /^https:\/\/wa\.me\/221775554433/);

  await page.click(`button[data-unlock="check"][data-ref="${ref}"]`);
  await expect(page.locator('#toast')).toContainText('Code accepté');
  await page.click('#unlock-close');
  await expect(page.locator('#btn-premium')).toHaveText('Mes pass (1)');
  await page.click('#btn-print');
  await expect(page.locator('#unlock-dlg')).toBeHidden();
  expect(await page.evaluate(() => window.printed)).toBe(1);

  // Vue d'ensemble : la vente et le téléchargement sont comptés.
  await admin.click('.admin-tabs button[data-tab="overview"]');
  await expect(admin.locator('.tile').first()).toContainText('2 000 FCFA');
  expect(errors).toEqual([]);
});

test('code offert à crédits : décompte à chaque téléchargement, puis nouveau déblocage nécessaire', async ({ page, context }) => {
  const errors = watchErrors(page);
  const admin = await context.newPage();
  await adminLogin(admin);
  await openShop(admin);
  await admin.click('.admin-tabs button[data-tab="codes"]');
  await admin.locator('.new-offer summary').click();
  await admin.selectOption('#gift-offer', 'pack-3');
  await admin.fill('#gift-note', 'Partenariat lycée');
  await admin.click('#gift-form button[type="submit"]');
  const code = (await admin.locator('#gift-result strong').textContent()).trim();
  expect(code).toMatch(/^CV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => { window.printed = 0; window.print = () => { window.printed += 1; }; });
  await page.click('#btn-gallery');
  await page.click('#gallery-grid button[data-template="goree"]');
  await page.click('#btn-premium');
  await page.fill('#unlock-code', code.toLowerCase());
  await page.click('button[data-unlock="redeem"]');
  await expect(page.locator('#unlock-body')).toContainText('3 téléchargement');
  await page.click('#unlock-close');
  page.on('dialog', (d) => d.accept());
  for (let i = 0; i < 3; i += 1) {
    await page.click('#btn-print');
    await expect.poll(() => page.evaluate(() => window.printed)).toBe(i + 1);
  }
  await page.click('#btn-print');
  await expect(page.locator('#unlock-dlg')).toBeVisible();
  expect(await page.evaluate(() => window.printed)).toBe(3);

  // Côté admin : le code a servi 3 fois.
  await admin.fill('#code-q', 'lycée');
  await admin.press('#code-q', 'Enter');
  await expect(admin.locator('.codes-table tbody tr')).toHaveCount(1);
  await expect(admin.locator('.codes-table tbody tr')).toContainText('3 utilisation(s)');
  expect(errors).toEqual([]);
});

test('annonce et modèle masqué réglés par l\'admin : visibles dans l\'éditeur', async ({ page, context }) => {
  const admin = await context.newPage();
  await adminLogin(admin);
  await admin.click('.admin-tabs button[data-tab="settings"]');
  await admin.fill('#set-announce', 'Promotion Tabaski : pass 30 jours à 1 500 FCFA');
  await admin.click('#settings-form button[type="submit"]');
  await expect(admin.locator('#toast')).toHaveText('Réglages enregistrés.');
  await admin.click('.admin-tabs button[data-tab="templates"]');
  await admin.check('input[name="hidden"][value="baobab"]');
  await admin.click('#tpl-form button[type="submit"]');
  await expect(admin.locator('#toast')).toHaveText('Modèles enregistrés.');

  await page.goto('/app.html');
  await expect(page.locator('#announce-text')).toHaveText('Promotion Tabaski : pass 30 jours à 1 500 FCFA');
  await page.click('#announce-close');
  await expect(page.locator('#announce')).toBeHidden();
  await page.click('#btn-gallery');
  await expect(page.locator('#gallery-grid button[data-template="baobab"]')).toHaveCount(0);
  await expect(page.locator('#gallery-grid button[data-template="goree"]')).toHaveCount(1);
});

test.describe('accessibilité (axe-core)', () => {
  test.use({ bypassCSP: true });

  async function audit(page) {
    await page.addScriptTag({ path: AXE_PATH });
    const result = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    }));
    return result.violations.map((v) => `${v.id} (${v.impact}) : ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  }

  test('administration (connexion et chaque onglet) : aucune violation WCAG A/AA', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page.locator('#login-view')).toBeVisible();
    expect(await audit(page), 'connexion').toEqual([]);
    await adminLogin(page);
    await openShop(page);
    for (const tab of ['overview', 'orders', 'offers', 'templates', 'codes', 'settings', 'audit']) {
      await page.click(`.admin-tabs button[data-tab="${tab}"]`);
      await expect(page.locator('#panel .hint').first()).toBeVisible();
      if (tab === 'offers') await page.locator('.offer-admin-list summary').first().click();
      expect(await audit(page), tab).toEqual([]);
    }
  });

  test('fenêtre de déblocage (offres, paiement, commande) : aucune violation', async ({ page, context }) => {
    const admin = await context.newPage();
    await adminLogin(admin);
    await openShop(admin);
    await page.goto('/app.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('#btn-premium')).toBeVisible();
    await page.click('#btn-premium');
    await page.fill('#order-phone', '77 555 44 33');
    await page.click('#order-form button[type="submit"]');
    await expect(page.locator('#order-result .pay-box')).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });
});
