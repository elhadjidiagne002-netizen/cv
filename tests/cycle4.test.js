// Cycle 4 : rubriques personnalisées, export Word (.docx), JSON Resume, types de lettre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSampleCV, createSampleJunior, createEmptyCV, normalizeCV, createCustomSection, createCustomItem, customKey, MAX_CUSTOM_SECTIONS, LETTER_KINDS,
} from '../public/js/model.js';
import { checkCV, applyFix, findGaps } from '../public/js/norms.js';
import { renderCV, TEMPLATES } from '../public/js/render.js';
import { cvPlainText, cvBlocks } from '../public/js/plaintext.js';
import { crc32, createZip, readZip } from '../public/js/zip.js';
import { cvToDocx, letterToDocx } from '../public/js/docx.js';
import { toJSONResume, fromJSONResume, isJSONResume, levelFromFluency } from '../public/js/jsonresume.js';
import { importJSON } from '../public/js/storage.js';
import { draftLetter, checkLetter, letterBlocks } from '../public/js/letter.js';

const TODAY = new Date('2026-09-29T12:00:00Z');
const check = (cv, tpl = 'sobre') => checkCV(cv, tpl, { today: TODAY, pages: 1 });
const ids = (r) => r.issues.map((i) => i.id);
const dec = new TextDecoder();

function withStages(cv = createSampleCV()) {
  const cs = createCustomSection({
    title: 'Stages',
    items: [createCustomItem({ title: 'Stage assistant comptable', subtitle: 'Cabinet Diallo & Associés, Dakar', start: '2018-07', end: '2018-09', description: 'Saisir 300 pièces par mois\nPréparer les rapprochements bancaires' })],
  });
  cv.custom.push(cs);
  cv.meta.sectionOrder.splice(2, 0, customKey(cs));
  return cv;
}

// ——— Rubriques personnalisées ———

test('rubrique personnalisée : normalisation (ordre, doublons, maximum, dates)', () => {
  const cv = withStages();
  const n = normalizeCV(JSON.parse(JSON.stringify(cv)));
  assert.equal(n.custom[0].title, 'Stages');
  assert.equal(n.meta.sectionOrder[2], customKey(n.custom[0]));
  const raw = { custom: [{ id: 'a', title: 'X', items: [{ title: 'y', start: '07/2019' }] }], meta: { sectionOrder: ['custom:a', 'custom:a', 'custom:ghost', 'skills'] } };
  const m = normalizeCV(raw);
  assert.deepEqual(m.meta.sectionOrder.slice(0, 2), ['custom:a', 'skills']);
  assert.ok(!m.meta.sectionOrder.includes('custom:ghost'));
  assert.equal(m.custom[0].items[0].start, '2019-07');
  const many = normalizeCV({ custom: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, title: `T${i}` })) });
  assert.equal(many.custom.length, MAX_CUSTOM_SECTIONS);
  assert.deepEqual(createEmptyCV().custom, []);
});

test('rubrique personnalisée : rendue à sa place dans tous les modèles, échappée, éléments masqués exclus', () => {
  const cv = withStages();
  cv.custom[0].items[0].subtitle = 'Cabinet <b>Diallo</b>';
  for (const t of TEMPLATES) {
    const html = renderCV(cv, t.id);
    assert.match(html, /<h2 class="cv-h">Stages<\/h2>/, t.id);
    assert.doesNotMatch(html, /<b>Diallo/, t.id);
    assert.doesNotMatch(html, /style="/, t.id);
  }
  const html = renderCV(cv, 'sobre');
  assert.ok(html.indexOf('Stages</h2>') > html.indexOf('Formation</h2>'), 'après la formation (position 3)');
  assert.ok(html.indexOf('Stages</h2>') < html.indexOf('Compétences</h2>'));
  cv.custom[0].items[0].hidden = true;
  assert.doesNotMatch(renderCV(cv, 'sobre'), /Stages<\/h2>/, 'rubrique vide non rendue');
  cv.custom[0].items[0].hidden = false;
  cv.custom[0].title = '';
  assert.doesNotMatch(renderCV(cv, 'sobre'), /Stage assistant comptable/, 'rubrique sans titre non rendue');
});

test('rubrique personnalisée : contrôles (titre manquant, doublon standard, fantaisiste, dates) et trous comblés', () => {
  const cv = withStages();
  assert.equal(check(cv).score, 100, ids(check(cv)).join());
  cv.custom[0].title = '';
  assert.ok(ids(check(cv)).includes('custom.0.title'));
  cv.custom[0].title = 'Expériences';
  assert.ok(ids(check(cv)).includes('custom.0.builtin'));
  cv.custom[0].title = '✨ Mes aventures incroyables ✨';
  const fancy = check(cv).issues.find((i) => i.id === 'custom.0.fancy');
  assert.equal(fancy.target, 'custom.0.title');
  cv.custom[0].title = 'Stages';
  cv.custom[0].items[0].end = '2017-01';
  assert.ok(ids(check(cv)).includes('custom.0.items.0.end.before'));
  cv.custom[0].items[0].description = 'Réduire de [n] jours';
  cv.custom[0].items[0].end = '2018-09';
  assert.equal(check(cv).issues.find((i) => i.id === 'placeholder').target, 'custom.0.items.0.description');
  cv.custom[0].items[0].title = 'Stage  double  espace';
  applyFix(cv, 'clean:spaces');
  assert.equal(cv.custom[0].items[0].title, 'Stage double espace');
  // Un stage déclaré en rubrique personnalisée comble un trou du parcours.
  const gap = createSampleCV();
  gap.experiences[1].start = '2020-09';
  gap.volunteering[0].start = '2021-01';
  assert.equal(findGaps(gap, '2026-09').length, 1);
  gap.custom.push(createCustomSection({ title: 'Stages', items: [createCustomItem({ title: 'Stage', start: '2019-08', end: '2020-08' })] }));
  assert.equal(findGaps(gap, '2026-09').length, 0);
});

test('texte brut : rubrique personnalisée incluse ; ordre imposé du résumé US reproduit', () => {
  const cv = withStages();
  const txt = cvPlainText(cv);
  assert.match(txt, /\nSTAGES\nStage assistant comptable \| 07\/2018 – 09\/2018\nCabinet Diallo & Associés, Dakar\n- Saisir 300 pièces/);
  const us = cvPlainText(cv, 'us-resume');
  assert.ok(us.indexOf('\nSKILLS\n') < us.indexOf('\nLANGUAGES\n'));
  assert.ok(us.indexOf('\nSTAGES\n') > us.indexOf('\nLANGUAGES\n'), 'rubriques personnalisées après l\'ordre imposé');
  assert.equal(cvBlocks(cv).blocks[0].t, 'name');
});

// ——— ZIP et Word ———

test('ZIP : CRC-32 de référence, écriture et relecture', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const zip = createZip([{ name: 'a.txt', data: 'Bonjour ŋ ɓ' }, { name: 'dossier/b.xml', data: new Uint8Array([1, 2, 3]) }], new Date(2026, 8, 29, 10, 30));
  const files = readZip(zip);
  assert.equal(dec.decode(files['a.txt']), 'Bonjour ŋ ɓ');
  assert.deepEqual([...files['dossier/b.xml']], [1, 2, 3]);
  const bad = zip.slice();
  bad[36] ^= 0xff; // altère une donnée du premier fichier (en-tête 30 octets + nom 5 octets)
  assert.throws(() => readZip(bad), /CRC/);
});

test('Word (.docx) : structure OOXML, styles de titres, texte réel, format du modèle', () => {
  const cv = withStages();
  const files = readZip(cvToDocx(cv, 'sobre'));
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml']) assert.ok(files[f], f);
  const doc = dec.decode(files['word/document.xml']);
  assert.match(doc, /<w:pStyle w:val="Title"\/><\/w:pPr><w:r><w:t xml:space="preserve">Awa Ndiaye<\/w:t>/);
  assert.match(doc, /w:val="Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">Expérience professionnelle/);
  assert.match(doc, /Stages/);
  assert.match(doc, /Cabinet Diallo &amp; Associés/, 'échappement XML');
  assert.match(doc, /<w:pgSz w:w="11906" w:h="16838"\/>/, 'A4');
  assert.doesNotMatch(doc, /<w:tbl>|<w:drawing>/, 'ni tableau ni image (ATS)');
  const styles = dec.decode(files['word/styles.xml']);
  assert.match(styles, /w:styleId="Heading1"><w:name w:val="heading 1"\/>/);
  assert.match(styles, /w:ascii="Calibri"/);
  assert.match(styles, /<w:lang w:val="fr-FR"\/>/);
  // Résumé US : Letter, anglais, police à empattements.
  const us = readZip(cvToDocx(cv, 'us-resume'));
  assert.match(dec.decode(us['word/document.xml']), /<w:pgSz w:w="12240" w:h="15840"\/>/);
  assert.match(dec.decode(us['word/styles.xml']), /w:ascii="Cambria".*<w:lang w:val="en-GB"\/>/s);
  // CV anonyme : ni nom ni auteur.
  cv.meta.anonymous = true;
  const anon = readZip(cvToDocx(cv, 'sobre'));
  assert.doesNotMatch(dec.decode(anon['word/document.xml']), /Awa|77 123/);
  assert.match(dec.decode(anon['docProps/core.xml']), /<dc:creator><\/dc:creator>/);
});

test('Word : lettre administrative (date, destinataire, objet, signature) et caractères de contrôle retirés', () => {
  const cv = createSampleJunior();
  cv.letter.style = 'administratif';
  cv.letter.organization = 'Senelec';
  cv.letter.recipientTitle = 'Monsieur le Directeur général';
  Object.assign(cv.letter, draftLetter(cv, 'administratif', TODAY));
  cv.letter.body += '\u0007';
  const doc = dec.decode(readZip(letterToDocx(cv, 'sobre', TODAY))['word/document.xml']);
  const order = ['Thiès, le 29 septembre 2026', '>À<', 'Monsieur le Directeur général', 'Objet :', 'Monsieur le Directeur général,', 'haute considération'].map((x) => doc.indexOf(x));
  order.push(doc.lastIndexOf('Moussa Diop')); // signature, après la formule de politesse
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), order.join());
  assert.doesNotMatch(doc, /\u0007/);
  assert.equal(letterBlocks(cv, TODAY)[0].t, 'name');
});

// ——— JSON Resume ———

test('JSON Resume : export conforme et aller-retour sans perte des champs principaux', () => {
  const cv = withStages();
  cv.languages[0].mode = 'oral';
  const jr = toJSONResume(cv);
  assert.equal(jr.basics.name, 'Awa Ndiaye');
  assert.equal(jr.basics.location.countryCode, 'SN');
  assert.equal(jr.basics.profiles[0].network, 'LinkedIn');
  assert.equal(jr.work[0].startDate, '2022-03');
  assert.equal(jr.work[0].endDate, undefined, 'poste en cours : pas de date de fin');
  assert.equal(jr.work[0].highlights.length, 3);
  assert.equal(jr.languages[1].fluency, 'CEFR C2');
  assert.ok(isJSONResume(jr));
  const back = fromJSONResume(JSON.parse(JSON.stringify(jr)));
  assert.equal(back.identity.lastName, 'Ndiaye');
  assert.equal(back.experiences[0].current, true);
  assert.equal(back.experiences[0].description.split('\n').length, 3);
  assert.deepEqual(back.languages.map((l) => [l.name, l.level, l.mode]), [['Wolof', 'native', 'oral'], ['Français', 'C2', ''], ['Anglais', 'B2', '']]);
  assert.equal(back.meta.lang, 'fr');
  assert.equal(check(back).issues.filter((i) => i.severity === 'error').length, 0);
});

test('JSON Resume : import d\'un fichier anglais créé ailleurs (via l\'import habituel)', () => {
  const jr = {
    basics: { name: 'Fatou Sow', label: 'Software Engineer', email: 'fatou.sow@example.com', summary: 'Software engineer with five years of experience building payment services for West African markets.', location: { city: 'Dakar', countryCode: 'SN' } },
    work: [{ name: 'PayTech', position: 'Backend Engineer', startDate: '2021-02-01', summary: 'Built the mobile money gateway.', highlights: ['Reduced latency by 40%'] }],
    education: [{ institution: 'ESP Dakar', studyType: 'Master', area: 'Computer Science', endDate: '2020' }],
    languages: [{ language: 'French', fluency: 'Full professional proficiency' }, { language: 'Wolof', fluency: 'Native speaker' }, { language: 'Spanish', fluency: 'Elementary' }],
    skills: [{ name: 'Backend', keywords: ['Node.js', 'PostgreSQL'] }],
  };
  const { cv, source, warnings } = importJSON(JSON.stringify(jr));
  assert.equal(source, 'jsonresume');
  // Année seule (« 2020 ») : conservée telle quelle et signalée, jamais de mois inventé.
  assert.deepEqual(warnings.map((w) => w.path), ['education.0.end']);
  assert.equal(cv.identity.country, 'Sénégal');
  assert.equal(cv.meta.lang, 'en');
  assert.equal(cv.experiences[0].start, '2021-02');
  assert.equal(cv.experiences[0].current, true);
  assert.equal(cv.experiences[0].description, 'Built the mobile money gateway.\nReduced latency by 40%');
  assert.equal(cv.education[0].degree, 'Master — Computer Science');
  assert.deepEqual(cv.languages.map((l) => l.level), ['C1', 'native', 'A2']);
  assert.equal(levelFromFluency('Niveau B2 (DELF)'), 'B2');
  assert.equal(levelFromFluency('???'), '');
  // Notre propre format reste reconnu en priorité.
  assert.equal(importJSON(JSON.stringify({ cv: createSampleCV() })).source, undefined);
});

// ——— Types de lettre ———

test('types de lettre : demande de stage, relance, remerciement (FR, administratif, EN)', () => {
  assert.deepEqual(LETTER_KINDS, ['candidature', 'stage', 'relance', 'remerciement']);
  for (const kind of ['stage', 'relance', 'remerciement']) {
    for (const style of ['standard', 'administratif', 'en']) {
      const cv = createSampleJunior();
      cv.letter.kind = kind;
      cv.letter.style = style;
      cv.letter.organization = 'Senelec';
      Object.assign(cv.letter, draftLetter(cv, style, TODAY));
      const r = checkLetter(cv);
      const got = r.issues.map((i) => i.id);
      assert.ok(got.includes('letter.placeholder'), `${kind}/${style}`);
      for (const bad of ['letter.body', 'letter.long', 'letter.consistency', 'letter.salutation', 'letter.closing', 'letter.paragraphs']) assert.ok(!got.includes(bad), `${kind}/${style} : ${bad}`);
      if (style !== 'en') assert.doesNotMatch(cv.letter.body, /je me permets/i);
    }
  }
  const cv = createSampleJunior();
  cv.letter.kind = 'stage';
  Object.assign(cv.letter, draftLetter(cv, 'administratif', TODAY));
  assert.match(cv.letter.subject, /^Demande de stage/);
  assert.match(cv.letter.body, /convention de stage/);
  assert.match(cv.letter.enclosures, /relevés de notes/);
  cv.letter.kind = 'relance';
  cv.letter.body = 'mot '.repeat(300);
  assert.ok(checkLetter(cv).issues.some((i) => i.id === 'letter.long'), 'une relance de 300 mots est trop longue');
  assert.equal(normalizeCV({ letter: { kind: 'inconnu' } }).letter.kind, 'candidature');
});
