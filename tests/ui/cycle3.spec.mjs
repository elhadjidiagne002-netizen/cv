// Cycle 3 : lettre de motivation, annuler / rétablir, éléments masqués, aide par métier, texte brut,
// dossier de concours (Sénégal), suggestions de saisie, téléphone +221. Sous la vraie CSP.
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

test('lettre de motivation administrative : brouillon, aperçu assorti, contrôle, PDF d\'une page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.click('button[data-doc="letter"]');
  await expect(page.locator('button[data-doc="letter"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#btn-print')).toHaveText('Télécharger la lettre en PDF');
  await expect(page.locator('#btn-fit')).toBeHidden();
  await page.fill('#f-letter-organization', 'Port autonome de Dakar');
  await page.fill('#f-letter-recipientTitle', 'Monsieur le Directeur général');
  await page.locator('#f-letter-recipientTitle').blur();
  await page.check('#letter-style-administratif');
  await expect(page.locator('#letter-style-administratif')).toBeFocused();
  await page.click('button[data-act="letter-draft"]');
  await expect(page.locator('#f-letter-body')).toBeFocused();
  await expect(page.locator('#f-letter-salutation')).toHaveValue('Monsieur le Directeur général,');
  const preview = page.locator('#preview .cv.letter');
  await expect(preview).toHaveClass(/tpl-sobre/);
  await expect(preview.locator('.cv-name')).toHaveText('Awa Ndiaye');
  await expect(preview.locator('.lt-subject')).toContainText('Demande d\'emploi');
  await expect(preview.locator('.lt-closing')).toContainText('haute considération');
  await expect(page.locator('#norms')).toContainText('Qualité de la lettre');
  await expect(page.locator('#norms .issue-link', { hasText: 'crochets' })).toBeVisible();
  // L'alerte amène au corps de la lettre.
  await page.locator('#f-letter-body').fill((await page.inputValue('#f-letter-body')).replace(/\[[^\]]+\]/g, 'ses missions de service public'));
  await expect(page.locator('#norms .issue-link', { hasText: 'crochets' })).toHaveCount(0);
  // Impression : c'est la lettre qui est imprimée, sur une page, avec du vrai texte.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#print-root .cv.letter')).toBeVisible();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
  await page.emulateMedia({ media: 'screen' });
  // Retour au CV : la lettre est conservée.
  await page.click('button[data-doc="cv"]');
  await expect(page.locator('#preview .cv-s-experiences')).toBeVisible();
  await page.reload();
  await page.click('button[data-doc="letter"]');
  await expect(page.locator('#f-letter-organization')).toHaveValue('Port autonome de Dakar');
  expect(errors).toEqual([]);
});

test('annuler / rétablir (boutons et Ctrl+Z hors des champs de saisie)', async ({ page }) => {
  const section = page.locator('details[data-section="experiences"]');
  await section.locator(':scope > summary').click();
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await section.locator('button[data-act="item-add"]').click();
  await expect(section.locator('.ed-item')).toHaveCount(4);
  await page.click('#btn-undo');
  await expect(section.locator('.ed-item')).toHaveCount(3);
  await expect(page.locator('#btn-redo')).toBeEnabled();
  await page.click('#btn-redo');
  await expect(section.locator('.ed-item')).toHaveCount(4);
  await page.locator('#btn-gallery-2').focus();
  await page.keyboard.press('Control+z');
  await expect(section.locator('.ed-item')).toHaveCount(3);
  // Une liste déroulante forme sa propre étape.
  await page.selectOption('#set-country', 'SN');
  await page.selectOption('#set-paper', 'Letter');
  await page.click('#btn-undo');
  await expect(page.locator('#set-paper')).toHaveValue('A4');
  await expect(page.locator('#set-country')).toHaveValue('SN');
});

test('masquer une expérience sans la supprimer (version ciblée)', async ({ page }) => {
  const section = page.locator('details[data-section="experiences"]');
  await section.locator(':scope > summary').click();
  const btn = section.locator('button[data-act="item-hide"][data-index="2"]');
  await btn.click();
  await expect(section.locator('button[data-act="item-hide"][data-index="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview .cv')).not.toContainText('Sabar Conseil');
  await expect(section.locator(':scope > summary')).toContainText('dont 1 masqué');
  await section.locator('button[data-act="item-hide"][data-index="2"]').click();
  await expect(page.locator('#preview .cv')).toContainText('Sabar Conseil');
});

test('aide à la rédaction par métier : ligne, compétences et alerte « à personnaliser »', async ({ page }) => {
  const errors = watchErrors(page);
  const section = page.locator('details[data-section="experiences"]');
  await section.locator(':scope > summary').click();
  await section.locator('details[data-section="helper"] > summary').click();
  await page.selectOption('#helper-job', 'comptable');
  await expect(page.locator('#helper-job')).toBeFocused();
  await page.selectOption('#helper-target', '1');
  await page.click('button[data-act="helper-line"][data-line="1"]');
  await expect(page.locator('#f-experiences-1-description')).toHaveValue(/IPRES, CSS/);
  await page.click('button[data-act="helper-line"][data-line="0"]');
  await expect(page.locator('#norms .issue-link', { hasText: 'entre crochets' })).toBeVisible();
  await page.click('button[data-act="helper-skills"]');
  await expect(page.locator('#preview .cv-s-skills')).toContainText('SYSCOHADA');
  expect(errors).toEqual([]);
});

test('texte brut : aperçu, copie, téléchargement .txt', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('#btn-text');
  await expect(page.locator('#text-dlg')).toBeVisible();
  await expect(page.locator('#plain-text')).toHaveValue(/^AWA NDIAYE\nChargée de marketing digital/);
  await page.click('#text-copy');
  await expect(page.locator('#toast')).toContainText('Texte copié');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#text-download')]);
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  await page.click('#text-close');
  await expect(page.locator('#btn-text')).toBeFocused();
});

test('Sénégal : dossier de concours, téléphone +221 corrigé, suggestions de saisie, langue à l\'oral', async ({ page }) => {
  await page.selectOption('#set-country', 'SNFP');
  const dossier = page.locator('details[data-section="dossier"]');
  await expect(dossier).toBeVisible();
  await dossier.locator(':scope > summary').click();
  await page.check('#dossier-casier');
  await expect(dossier.locator('.count')).toHaveText('(1 / 11)');
  await page.reload();
  await expect(page.locator('#dossier-casier')).toBeChecked();
  // Téléphone local → correction en un clic.
  await page.fill('#f-identity-phone', '771234567');
  const fix = page.locator('#norms button[data-fix="phone:phone"]');
  await expect(fix).toHaveText('Écrire +221 77 123 45 67');
  await fix.click();
  await expect(page.locator('#f-identity-phone')).toHaveValue('+221 77 123 45 67');
  // Suggestions hors ligne : établissements et villes.
  await expect(page.locator('#f-education-0-school')).toHaveAttribute('list', 'dl-schools');
  expect(await page.locator('#dl-schools option').count()).toBeGreaterThan(20);
  await expect(page.locator('#f-identity-city')).toHaveAttribute('list', 'dl-cities');
  // Langue nationale parlée sans être écrite.
  const langs = page.locator('details[data-section="languages"]');
  await langs.locator(':scope > summary').click();
  await expect(langs).toContainText('Langue nationale');
  await page.selectOption('#f-languages-0-mode', 'oral');
  await expect(page.locator('#preview .cv-s-languages')).toContainText('Langue maternelle, à l\'oral');
});

test('boutons masqués réellement invisibles ; exemple « jeune diplômé » ; téléphone sans débordement', async ({ page }) => {
  await expect(page.locator('#btn-fit-reset')).toBeHidden();
  await page.click('#new-menu > summary');
  await page.click('button[data-new="sample-junior"]');
  await expect(page.locator('#preview .cv-name')).toHaveText('Moussa Diop');
  await expect(page.locator('#preview .cv')).toContainText('(WhatsApp)');
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator('.doc-switch')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
