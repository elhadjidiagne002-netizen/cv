// Atelier de texte IA : sous chaque zone de texte et en mode libre, sous la vraie CSP.
import { test, expect } from '@playwright/test';

const AI = 'https://nexusmarket.sn/api/ai';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' };

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

// Faux service : renvoie le texte reçu, préfixé selon l'action (les repères ⟦n⟧ sont conservés).
async function fakeAI(page, sent) {
  await page.route(AI, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(route.request().postData());
    sent.push(body);
    const sys = body.messages[0].content;
    const txt = body.messages[1].content;
    const out = /anglais/.test(sys) ? `TRANSLATED: ${txt}` : /UNIQUEMENT l'orthographe/.test(sys) ? txt.replace('compétant', 'compétent') : `PRO: ${txt}`;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ texte: out, remarques: ['Faute d\'accord corrigée.'] }) } }] }) });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/app.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#preview .cv')).toBeVisible();
});

test('champ « accroche » : seul le texte part (téléphone masqué), le résultat remplace le champ et l\'aperçu', async ({ page }) => {
  const errors = watchErrors(page);
  const sent = [];
  await fakeAI(page, sent);
  const sec = page.locator('details[data-section="headline"]');
  if (!(await sec.evaluate((d) => d.open))) await sec.locator('summary').click();   // attribut open vide = ouvert
  await page.fill('#f-summary', 'Comptable compétant, joignable au 77 123 45 67.');
  await page.click('button[data-field="f-summary"]');
  const dlg = page.locator('#ai-dlg');
  await expect(dlg).toContainText('Comptable compétant');
  await expect(dlg.locator('button[data-ai="text-run"]')).toHaveCount(8);
  // Accord demandé avant le premier envoi.
  await dlg.getByRole('button', { name: /Corriger les fautes/ }).click();
  await expect(page.locator('#ai-consent-dlg')).toBeVisible();
  await page.click('#ai-consent-yes');
  await expect(dlg).toContainText('Comptable compétent');
  await expect(dlg).toContainText('Faute d\'accord corrigée.');
  // Ce qui est parti : uniquement le texte, numéro masqué, rien du reste du CV.
  expect(sent).toHaveLength(1);
  const user = sent[0].messages[1].content;
  expect(user).toBe('Comptable compétant, joignable au ⟦1⟧.');
  expect(JSON.stringify(sent[0])).not.toContain('77 123 45 67');
  expect(sent[0].messages).toHaveLength(2);
  // Remplacer : le numéro revient, le champ et l'aperçu sont à jour.
  await dlg.locator('button[data-ai="text-use"]').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#f-summary')).toHaveValue('Comptable compétent, joignable au 77 123 45 67.');
  await expect(page.locator('#preview .cv')).toContainText('Comptable compétent');
  await expect(page.locator('#summary-count')).toContainText('/ 500 caractères');
  expect(errors).toEqual([]);
});

test('chaque description d\'expérience a son bouton ; champ vide → message, rien n\'est envoyé', async ({ page }) => {
  const sent = [];
  await fakeAI(page, sent);
  const sec = page.locator('details[data-section="experiences"]');
  if (!(await sec.evaluate((d) => d.open))) await sec.locator(':scope > summary').click();   // attribut open vide = ouvert
  const btns = sec.locator('button[data-act="ai-text"]');
  expect(await btns.count()).toBeGreaterThan(0);
  const first = btns.first();
  const field = await first.getAttribute('data-field');
  await page.fill(`#${field}`, '');
  await first.click();
  await expect(page.locator('#toast')).toContainText('Écrivez d\'abord quelques mots');
  await expect(page.locator('#ai-dlg')).toBeHidden();
  expect(sent).toHaveLength(0);
});

test('mode libre : traduire, enchaîner sur le résultat, copier ; pas de bouton « Remplacer »', async ({ page }) => {
  const errors = watchErrors(page);
  const sent = [];
  await fakeAI(page, sent);
  await page.evaluate((k) => localStorage.setItem(k, '1'), 'cv-ai-consent-v1');
  await page.click('#btn-ai-text');
  const dlg = page.locator('#ai-dlg');
  await page.fill('#ai-free-text', 'Bonjour, je souhaite postuler au poste de comptable.');
  await dlg.getByRole('button', { name: /Traduire en anglais/ }).click();
  await expect(dlg).toContainText('TRANSLATED: Bonjour, je souhaite postuler');
  await expect(dlg.locator('button[data-ai="text-use"]')).toHaveCount(0);
  await expect(dlg.locator('button[data-ai="text-copy"]')).toBeVisible();
  // Enchaîner : le résultat devient le texte de départ.
  await dlg.locator('button[data-ai="text-chain"]').click();
  await expect(page.locator('#ai-free-text')).toHaveValue('TRANSLATED: Bonjour, je souhaite postuler au poste de comptable.');
  await dlg.getByRole('button', { name: /Rendre plus professionnel/ }).click();
  await expect(dlg).toContainText('PRO: TRANSLATED: Bonjour');
  expect(sent).toHaveLength(2);
  await page.click('#ai-close');
  expect(errors).toEqual([]);
});
