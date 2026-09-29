// Cycle 5 : aperçu page par page (fidèle au PDF), suivi des candidatures, import LinkedIn. Sous la vraie CSP.
import { test, expect } from '@playwright/test';
import { deflateRawSync } from 'node:zlib';

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

/** Allonge le CV d'exemple (expériences dupliquées) et force un nouveau rendu. */
async function longCV(page, copies = 3, template = 'sobre') {
  await page.evaluate(({ copies: n, template: t }) => {
    const { state } = window.__cvApp;
    const base = JSON.parse(JSON.stringify(state.cv.experiences));
    for (let i = 0; i < n; i += 1) state.cv.experiences.push(...JSON.parse(JSON.stringify(base)));
    state.cv.meta.templateId = t;
  }, { copies, template });
  await page.fill('#set-title', `Long ${template}`);
}

for (const template of ['sobre', 'dakar', 'europass']) {
  test(`aperçu page par page (${template}) : aucun bloc coupé, même nombre de pages que le PDF`, async ({ page }) => {
    const errors = watchErrors(page);
    await longCV(page, 3, template);
    await expect(page.locator('#template-info')).toContainText(/[2-4] pages/);
    const pages = Number((await page.textContent('#template-info')).match(/(\d) pages/)[1]);
    await expect(page.locator('#preview .page-gap')).toHaveCount(pages - 1);
    await expect(page.locator('#preview .page-gap').last()).toHaveText(`Page ${pages} / ${pages}`);
    // Aucun élément ne chevauche la limite entre deux feuilles.
    const crossing = await page.evaluate(() => {
      const art = document.querySelector('#preview .cv');
      const scale = art.getBoundingClientRect().height / art.offsetHeight;
      const full = (297 * 96) / 25.4;
      const stride = full + 28;
      return [...art.querySelectorAll('.cv-item, .cv-h, .cv-skill, .cv-langs > li')].filter((el) => {
        const r = el.getBoundingClientRect();
        const top = (r.top - art.getBoundingClientRect().top) / scale;
        const bottom = top + r.height / scale;
        return Math.floor(top / stride) !== Math.floor((bottom - 1) / stride) || (bottom % stride) > full - (12 * 96) / 25.4 + 1;
      }).length;
    });
    expect(crossing).toBe(0);
    // Le PDF imprimé a le même nombre de pages que l'aperçu.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(pages);
    expect(errors).toEqual([]);
  });
}

test('suivi des candidatures : ajout, relance due, lettre de relance pré-remplie, export CSV', async ({ page }) => {
  const errors = watchErrors(page);
  await expect(page.locator('#due-badge')).toBeHidden();
  await page.click('#btn-apps');
  await expect(page.locator('#app-company')).toBeFocused();
  await expect(page.locator('#app-position')).toHaveValue('Chargée de marketing digital');
  // Validation : entreprise obligatoire.
  await page.click('#app-save');
  await expect(page.locator('#app-company')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#app-company', 'Sonatel');
  await page.selectOption('#app-status', 'envoyee');
  await page.selectOption('#app-channel', 'E-mail');
  await page.fill('#app-sentOn', '2026-01-05');
  await page.click('#app-save');
  const card = page.locator('.app-card', { hasText: 'Sonatel' });
  await expect(card).toContainText('envoyée le 05/01/2026');
  await expect(card).toContainText('relance due depuis le 15/01/2026');
  await expect(card).toHaveClass(/is-due/);
  await expect(page.locator('#apps-due')).toContainText('1 relance à faire');
  await expect(page.locator('#due-badge')).toHaveText('1 relance');
  // Lettre de relance pré-remplie (date d'envoi insérée).
  await card.locator('button[data-app-act="followup"]').click();
  await expect(page.locator('#apps-dlg')).not.toBeVisible();
  await expect(page.locator('button[data-doc="letter"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#f-letter-kind')).toHaveValue('relance');
  await expect(page.locator('#f-letter-organization')).toHaveValue('Sonatel');
  await expect(page.locator('#f-letter-body')).toHaveValue(/^Le 5 janvier 2026, je vous ai adressé ma candidature/);
  // Changement de statut depuis la liste ; persistance ; export.
  await page.click('#btn-apps');
  await page.selectOption('.app-card select', 'entretien');
  await expect(page.locator('.app-card')).not.toHaveClass(/is-due/);
  await expect(page.locator('.app-card button[data-app-act="thanks"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('#due-badge')).toBeHidden();
  await page.click('#btn-apps');
  await expect(page.locator('.app-card')).toContainText('Entretien prévu');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#apps-export')]);
  expect(csv.suggestedFilename()).toBe('candidatures.csv');
  expect(errors).toEqual([]);
});

/** Archive LinkedIn minimale, compressée comme l'originale. */
function linkedInZip() {
  const files = {
    'Profile.csv': 'First Name,Last Name,Headline,Summary,Geo Location\nFatou,Sow,Comptable,"Comptable, 5 ans d\'expérience en cabinet au Sénégal.","Thiès, Sénégal"\n',
    'Positions.csv': 'Company Name,Title,Description,Location,Started On,Finished On\nCabinet Diallo,Comptable,Tenir la comptabilité de 12 sociétés,Thiès,Jan 2021,\n',
  };
  const parts = [];
  const central = [];
  let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const [n, text] of Object.entries(files)) {
    const name = Buffer.from(n);
    const data = Buffer.from(text);
    const comp = deflateRawSync(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc(data), 14);
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    parts.push(h, name, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc(data), 16);
    c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + comp.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 8); end.writeUInt16LE(2, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

test('import de l\'archive LinkedIn (.zip) : nouveau CV créé, sans erreur', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setInputFiles('#file-import', { name: 'Basic_LinkedInDataExport_09-29-2026.zip', mimeType: 'application/zip', buffer: linkedInZip() });
  await expect(page.locator('#toast')).toContainText('Profil LinkedIn importé (2 fichiers)');
  await expect(page.locator('#preview .cv-name')).toHaveText('Fatou Sow');
  await expect(page.locator('#preview .cv-s-experiences')).toContainText('Cabinet Diallo');
  await expect(page.locator('#cv-select option:checked')).toHaveText('Fatou Sow (LinkedIn)');
  // Fichier sans données LinkedIn : message clair.
  await page.setInputFiles('#file-import', { name: 'autre.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') });
  await expect(page.locator('#toast')).toContainText('Aucun fichier LinkedIn reconnu');
  expect(errors).toEqual([]);
});

test('les 33 modèles : l\'aperçu annonce le même nombre de pages que le PDF (CV long)', async ({ page }) => {
  test.setTimeout(180_000);
  const ids = await page.evaluate(async () => (await import('/js/render.js')).TEMPLATES.map((t) => t.id));
  await longCV(page, 2, ids[0]);
  const mismatches = [];
  for (const id of ids) {
    await page.evaluate((t) => { window.__cvApp.state.cv.meta.templateId = t; }, id);
    await page.fill('#set-title', `Long ${id}`);
    await expect.poll(() => page.evaluate(() => document.querySelector('#preview .cv').dataset.template)).toBe(id);
    await page.waitForTimeout(250); // l'aperçu est recalculé 120 ms après la dernière saisie
    const preview = Number((await page.textContent('#template-info')).match(/(\d+) pages?/)[1]);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    const printed = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (printed !== preview) mismatches.push(`${id} : aperçu ${preview}, PDF ${printed}`);
  }
  expect(mismatches).toEqual([]);
});
