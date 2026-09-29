// Assistant IA : accord préalable, conseils appliqués au CV, lettre insérée, erreurs. Service d'IA simulé.
import { test, expect } from '@playwright/test';

const AI = 'https://nexusmarket.sn/api/ai';
const reply = (obj) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: `Voici :\n${JSON.stringify(obj)}` } }] }) });

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#preview .cv')).toBeVisible();
});

test('conseils : accord demandé une fois, identité jamais envoyée, accroche et missions remplacées', async ({ page }) => {
  const errors = watchErrors(page);
  const bodies = [];
  await page.route(AI, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' } });
    bodies.push(route.request().postData());
    return route.fulfill(reply({
      accroche: 'Chargée de marketing digital orientée résultats, experte en campagnes Google Ads.',
      conseils: [{ rubrique: 'Expérience professionnelle', priorite: 'haute', conseil: 'Chiffrez chaque résultat de vos campagnes.' }],
      missions: [{ index: 0, missions: 'Piloter 12 campagnes par an\nAugmenter le trafic de [chiffre] %' }],
      competences_manquantes: ['Looker Studio'],
    }));
  });
  // Refus : rien n'est envoyé.
  await page.click('#btn-ai-advice');
  await expect(page.locator('#ai-consent-dlg')).toBeVisible();
  await page.click('#ai-consent-no');
  await expect(page.locator('#ai-dlg')).toBeHidden();
  expect(bodies).toHaveLength(0);
  // Accord : l'analyse s'affiche.
  await page.click('#btn-ai-advice');
  await page.click('#ai-consent-yes');
  const dlg = page.locator('#ai-dlg');
  await expect(dlg).toContainText('Chiffrez chaque résultat');
  await expect(dlg).toContainText('Looker Studio');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).not.toContain('awa.ndiaye@example.com');
  expect(bodies[0]).not.toContain('Ndiaye');
  await dlg.locator('button[data-ai="use-summary"]').click();
  await dlg.locator('button[data-ai="use-rewrite"]').click();
  await page.click('#ai-close');
  await expect(page.locator('#preview .cv')).toContainText('orientée résultats');
  await expect(page.locator('#preview .cv')).toContainText('Piloter 12 campagnes par an');
  // Deuxième fois : plus de demande d'accord.
  await page.click('#btn-ai-advice');
  await expect(page.locator('#ai-consent-dlg')).toBeHidden();
  await expect(dlg).toContainText('Chiffrez chaque résultat');
  await page.click('#ai-close');
  expect(errors).toEqual([]);
});

test('lettre : rédigée par l\'IA puis insérée ; erreur claire si le service refuse', async ({ page }) => {
  const errors = watchErrors(page);
  let status = 200;
  await page.route(AI, (route) => (status === 200
    ? route.fulfill(reply({ objet: 'Candidature au poste de chargée marketing', corps: 'Votre annonce a retenu toute mon attention.\n\nForte de cinq ans d\'expérience, j\'ai piloté des campagnes [chiffre].\n\nJe serais heureuse d\'en discuter avec vous.', conseils: ['Citez un projet de l\'entreprise.'] }))
    : route.fulfill({ status, headers: { 'access-control-allow-origin': '*' }, body: '' })));
  await page.evaluate((k) => localStorage.setItem(k, '1'), 'cv-ai-consent-v1');
  await page.getByRole('button', { name: 'Lettre de motivation' }).click();
  page.on('dialog', (d) => d.accept());
  await page.click('button[data-act="letter-ai"]');
  const dlg = page.locator('#ai-dlg');
  await expect(dlg).toContainText('Votre annonce a retenu');
  await dlg.locator('button[data-ai="use-letter"]').click();
  await expect(page.locator('#f-letter-body')).toHaveValue(/piloté des campagnes \[chiffre\]/);
  await expect(page.locator('#preview')).toContainText('Votre annonce a retenu');
  status = 429;
  await page.click('button[data-act="letter-ai"]');
  await expect(dlg.locator('.ai-error')).toContainText('réessayez dans une minute');
  await page.click('#ai-close');
  expect(errors.filter((e) => !/429|Failed to load resource/.test(e))).toEqual([]);
});
