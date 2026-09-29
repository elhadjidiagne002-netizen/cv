// Cycle 3 : réalités sénégalaises (téléphone, FCFA, diplômes, concours, langues nationales),
// lettre de motivation, texte brut, aide par métier, éléments masqués.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSampleCV, createSampleJunior, createEmptyCV, createItem, normalizeCV, COUNTRIES, LETTER_STYLES,
} from '../public/js/model.js';
import { checkCV, applyFix, COUNTRY_PROFILES } from '../public/js/norms.js';
import { renderCV, TEMPLATES } from '../public/js/render.js';
import {
  parseSenegalPhone, formatSenegalPhone, findCFAAmounts, convertCFA, foreignDiplomas, isNationalLanguage, DOSSIER_ITEMS, DIPLOMAS,
} from '../public/js/senegal.js';
import {
  draftLetter, checkLetter, renderLetter, letterText, salutationFor, closingFor, placeAndDate, wordCount,
} from '../public/js/letter.js';
import { cvPlainText } from '../public/js/plaintext.js';
import { JOBS, getJob } from '../public/js/phrases.js';

const TODAY = new Date('2026-09-29T12:00:00Z');
const check = (cv, tpl = 'sobre', opts = {}) => checkCV(cv, tpl, { today: TODAY, pages: 1, ...opts });
const ids = (r) => r.issues.map((i) => i.id);
const has = (cv, id, tpl) => ids(check(cv, tpl)).some((x) => x === id || x.startsWith(`${id}.`));

// ——— Téléphone sénégalais ———

test('téléphone sénégalais : analyse et mise en forme +221 XX XXX XX XX', () => {
  assert.deepEqual(parseSenegalPhone('77 123 45 67'), { national: '771234567' });
  assert.deepEqual(parseSenegalPhone('00221771234567'), { national: '771234567' });
  assert.deepEqual(parseSenegalPhone('+221 33 821 00 00'), { national: '338210000' });
  assert.equal(parseSenegalPhone('+33 6 12 34 56 78'), null);
  assert.equal(parseSenegalPhone('+221 77 12 34').invalid, true);
  assert.equal(parseSenegalPhone('+221 99 123 45 67').invalid, true, 'préfixe inexistant');
  assert.equal(formatSenegalPhone('771234567'), '+221 77 123 45 67');
  assert.equal(formatSenegalPhone('00221-78-234-56-78'), '+221 78 234 56 78');
});

test('règles téléphone : numéro local corrigé en un clic, numéro +221 incorrect, second numéro', () => {
  const cv = createSampleCV();
  cv.identity.phone = '771234567';
  const is = check(cv).issues.find((i) => i.id === 'identity.phone.intl');
  assert.equal(is.fix, 'phone:phone');
  applyFix(cv, is.fix);
  assert.equal(cv.identity.phone, '+221 77 123 45 67');
  assert.equal(has(cv, 'identity.phone'), false);
  cv.identity.phone = '+221 77 12 34';
  assert.ok(has(cv, 'identity.phone.sn'));
  cv.identity.phone = '+221 77 123 45 67';
  cv.identity.phone2 = '76.123.45.67';
  assert.ok(ids(check(cv)).includes('identity.phone.intl.2'));
});

// ——— Francs CFA ———

test('montants en FCFA : détection et conversion (parité fixe 655,957)', () => {
  const found = findCFAAmounts('Budget de 45 millions FCFA, prime de 250 000 F CFA et 1,2 milliard de francs CFA.');
  assert.deepEqual(found.map((f) => f.amount), [45e6, 250000, 1.2e9]);
  assert.equal(convertCFA(655957), '1 000 €');
  assert.equal(convertCFA(45e6), '69 000 €');
  assert.match(convertCFA(45e6, 'USD'), /\$$/);
});

test('FCFA : conseil de conversion pour une candidature à l\'étranger, pas au Sénégal ni en zone CFA', () => {
  const cv = createSampleCV(); // « 45 millions FCFA » dans la 1re expérience
  assert.equal(has(cv, 'money.cfa'), false, 'sans pays visé, en français');
  for (const c of ['SN', 'SNFP', 'CI']) {
    cv.meta.country = c;
    assert.equal(has(cv, 'money.cfa'), false, c);
  }
  cv.meta.country = 'FR';
  const is = check(cv).issues.find((i) => i.id === 'money.cfa');
  assert.ok(is);
  assert.match(is.message, /69 000 €/);
  cv.experiences[0].description = cv.experiences[0].description.replace('45 millions FCFA', '45 millions FCFA (≈ 69 000 €)');
  assert.equal(has(cv, 'money.cfa'), false, 'équivalent déjà indiqué');
});

// ——— Diplômes ———

test('diplômes sénégalais peu connus à l\'étranger : équivalence proposée et ajoutée', () => {
  assert.equal(foreignDiplomas('BFEM')[0].diploma.id, 'bfem');
  assert.equal(foreignDiplomas('Licence en droit').length, 0);
  assert.ok(DIPLOMAS.every((d) => d.fr && d.en && d.label));
  const cv = createSampleCV();
  cv.education.push(createItem('education', { degree: 'DTS Génie civil', school: 'ESP', end: '2016-07' }));
  assert.equal(has(cv, 'education'), false, 'au Sénégal, pas de conseil');
  cv.meta.country = 'CA';
  const is = check(cv, 'quebec').issues.find((i) => /equivalent$/.test(i.id));
  assert.ok(is, 'conseil pour le Canada');
  applyFix(cv, is.fix);
  assert.equal(cv.education[2].degree, 'DTS Génie civil (Bac + 2, équivalent du BTS)');
  assert.equal(check(cv, 'quebec').issues.some((i) => /equivalent$/.test(i.id)), false);
});

// ——— Informations à ne jamais mettre ———

test('religion, confrérie, ethnie : alerte ; nom d\'établissement confessionnel : pas d\'alerte', () => {
  const cv = createSampleCV();
  cv.education[0].school = 'Université catholique de l\'Afrique de l\'Ouest (UCAO)';
  assert.equal(has(cv, 'sensitive.religion'), false);
  cv.interests.push(createItem('interests', { name: 'Dahira des étudiants mourides' }));
  const is = check(cv).issues.find((i) => i.id === 'sensitive.religion');
  assert.equal(is.severity, 'warning');
  assert.equal(is.target, 'interests.3.name');
});

test('numéro de CNI ou de passeport : alerte ; taille et poids : conseil', () => {
  const cv = createSampleCV();
  assert.equal(has(cv, 'sensitive.idnumber'), false);
  cv.identity.address = 'CNI n° 1751199501234';
  assert.ok(has(cv, 'sensitive.idnumber'));
  cv.identity.address = 'Passeport : A 01234567';
  assert.ok(has(cv, 'sensitive.idnumber'));
  cv.identity.address = '';
  assert.equal(has(cv, 'sensitive.physical'), false);
  cv.summary += ' Taille : 185 cm.';
  assert.ok(has(cv, 'sensitive.physical'));
});

test('exemples insérés non personnalisés [ … ] : alerte', () => {
  const cv = createSampleCV();
  cv.experiences[0].description += '\nRéduire de [n] jours le délai de clôture';
  const is = check(cv).issues.find((i) => i.id === 'placeholder');
  assert.equal(is.target, 'experiences.0.description');
});

// ——— Profils pays et dossier de concours ———

test('nouveaux profils pays : Sénégal fonction publique, Côte d\'Ivoire, Maroc, Belgique, Suisse', () => {
  for (const c of ['SNFP', 'CI', 'MA', 'BE', 'CH']) {
    assert.ok(COUNTRIES.includes(c), c);
    assert.ok(COUNTRY_PROFILES[c].inName, c);
  }
  for (const [code, p] of Object.entries(COUNTRY_PROFILES)) for (const id of p.templates) assert.ok(TEMPLATES.some((t) => t.id === id), `${code} → ${id}`);
  const cv = createSampleCV();
  cv.meta.country = 'SNFP';
  const is = check(cv).issues.find((i) => i.id === 'dossier.incomplete');
  assert.ok(is);
  assert.equal(is.target, 'dossier');
  assert.equal(check(cv).score, 100, 'le suivi du dossier ne pénalise pas le score du CV');
  cv.meta.dossier = DOSSIER_ITEMS.map((d) => d.id);
  assert.equal(has(cv, 'dossier'), false);
  const again = normalizeCV(JSON.parse(JSON.stringify(cv)));
  assert.deepEqual(again.meta.dossier, cv.meta.dossier);
  cv.meta.country = 'MA';
  assert.match(check(cv).issues.find((i) => i.id === 'identity.phone.country').message, /au Maroc/);
});

// ——— Langues nationales à l'oral, WhatsApp, lieu de naissance ———

test('langue « à l\'oral » : normalisée, affichée en toutes lettres (FR, EN, Europass, jauges)', () => {
  assert.ok(isNationalLanguage('Wolof') && isNationalLanguage('Diola (joola)') && !isNationalLanguage('Anglais'));
  const cv = createSampleCV();
  cv.languages[0].mode = 'oral';
  cv.languages[1].mode = 'bizarre';
  const n = normalizeCV(cv);
  assert.equal(n.languages[0].mode, 'oral');
  assert.equal(n.languages[1].mode, '');
  assert.match(renderCV(n, 'sobre'), /Langue maternelle, à l&#39;oral/);
  assert.match(renderCV(n, 'europass'), /Wolof \(à l&#39;oral\)/);
  assert.match(renderCV(n, 'infographie'), /à l&#39;oral/);
  n.meta.lang = 'en';
  assert.match(renderCV(n, 'uk-cv'), /Native, spoken/);
});

test('WhatsApp, second numéro et lieu de naissance (masqué par défaut, jamais sur un CV US)', () => {
  const cv = createSampleCV();
  cv.identity.whatsapp = true;
  cv.identity.phone2 = '+221 76 000 00 00';
  cv.identity.birthPlace = 'Thiès';
  let html = renderCV(cv, 'sobre');
  assert.match(html, /\+221 77 123 45 67 \(WhatsApp\)/);
  assert.match(html, /\+221 76 000 00 00/);
  assert.doesNotMatch(html, /Thiès<\/span>/, 'lieu de naissance masqué par défaut');
  cv.privacy.showBirthPlace = true;
  html = renderCV(cv, 'classique');
  assert.match(html, /Lieu de naissance/);
  assert.doesNotMatch(renderCV(cv, 'us-resume'), /Place of birth/);
  cv.meta.anonymous = true;
  html = renderCV(cv, 'sobre');
  assert.doesNotMatch(html, /76 000|WhatsApp/);
  assert.equal(normalizeCV({ identity: { whatsapp: 'oui' } }).identity.whatsapp, true);
});

// ——— Éléments masqués (versions ciblées) ———

test('élément masqué : absent du CV, du texte brut et des contrôles ; chemins des alertes corrects', () => {
  const cv = createSampleCV();
  cv.experiences[0].hidden = true;
  const html = renderCV(cv, 'sobre');
  assert.doesNotMatch(html, /Teranga Distribution/);
  assert.match(html, /Baobab Mobile Services/);
  assert.doesNotMatch(cvPlainText(cv), /Teranga Distribution/);
  cv.experiences[2].start = '';
  const is = check(cv).issues.find((i) => /\.start$/.test(i.id));
  assert.equal(is.target, 'experiences.2.start', 'chemin ramené à la position réelle dans l\'éditeur');
  assert.equal(normalizeCV(cv).experiences[0].hidden, true);
  assert.equal(createItem('skills').hidden, false);
});

// ——— Lettre de motivation ———

test('formules d\'appel et de politesse cohérentes', () => {
  assert.equal(salutationFor('Monsieur le Directeur des ressources humaines'), 'Monsieur le Directeur,');
  assert.equal(salutationFor('Madame la Directrice générale de la SENELEC'), 'Madame la Directrice générale,');
  assert.equal(salutationFor(''), 'Madame, Monsieur,');
  assert.equal(salutationFor('Monsieur le Directeur', 'en'), 'Dear Hiring Manager,');
  assert.match(closingFor('Monsieur le Directeur,', 'administratif'), /agréer, Monsieur le Directeur, l'expression de ma haute considération/);
  assert.match(closingFor('Madame, Monsieur,'), /salutations distinguées/);
  assert.equal(closingFor('Dear Hiring Manager,', 'en'), 'Yours faithfully,');
});

test('brouillon de lettre : 3 paragraphes, reprend le CV, passages à personnaliser signalés', () => {
  for (const style of LETTER_STYLES) {
    const cv = createSampleCV();
    cv.letter.style = style;
    cv.letter.organization = 'Sonatel';
    cv.letter.recipientTitle = 'Monsieur le Directeur des ressources humaines';
    Object.assign(cv.letter, draftLetter(cv, style, TODAY));
    assert.equal(cv.letter.body.split('\n\n').length, 3, style);
    assert.match(cv.letter.body, style === 'administratif' ? /votre structure/ : /Sonatel/);
    assert.match(cv.letter.body, /Teranga Distribution/);
    const r = checkLetter(cv);
    assert.ok(r.issues.some((i) => i.id === 'letter.placeholder'), style);
    assert.ok(!r.issues.some((i) => ['letter.body', 'letter.salutation', 'letter.closing', 'letter.consistency'].includes(i.id)), `${style} : ${r.issues.map((i) => i.id)}`);
  }
  const cv = createSampleCV();
  Object.assign(cv.letter, draftLetter(cv, 'standard', TODAY));
  assert.match(cv.letter.body, /d'augmenter de 38 %/, 'élision « d\' » devant une voyelle');
  const junior = createSampleJunior();
  Object.assign(junior.letter, draftLetter(junior, 'administratif', TODAY));
  assert.match(junior.letter.subject, /^Demande d'emploi/);
  assert.match(junior.letter.closing, /haute considération/);
});

test('contrôle de la lettre : vide, trop longue, formule incohérente, clichés', () => {
  const cv = createSampleCV();
  let r = checkLetter(cv);
  assert.equal(r.issues[0].id, 'letter.body');
  cv.letter.body = Array.from({ length: 4 }, () => 'mot '.repeat(130)).join('\n\n');
  cv.letter.salutation = 'Monsieur le Directeur,';
  cv.letter.closing = 'Je vous prie d\'agréer, Madame, Monsieur, mes salutations.';
  r = checkLetter(cv, { pages: 2 });
  const got = r.issues.map((i) => i.id);
  for (const id of ['letter.long', 'letter.consistency', 'letter.pages', 'letter.recipient']) assert.ok(got.includes(id), id);
  cv.letter.body = 'Je me permets de vous écrire. Je suis motivé. Je veux ce poste. Je travaille bien. Je suis là.';
  assert.ok(checkLetter(cv).issues.some((i) => i.id === 'letter.cliche'));
  assert.ok(checkLetter(cv).issues.some((i) => i.id === 'letter.je'));
  assert.equal(wordCount('Un deux trois'), 3);
});

test('rendu de la lettre : assorti au modèle, texte réel, pas de style="", échappement', () => {
  const cv = createSampleCV();
  cv.letter.style = 'administratif';
  cv.letter.organization = 'Port autonome de Dakar <script>';
  cv.letter.recipientTitle = 'Monsieur le Directeur général';
  cv.letter.date = '2026-10-01';
  Object.assign(cv.letter, draftLetter(cv, 'administratif', TODAY));
  for (const t of TEMPLATES) {
    const html = renderLetter(cv, t.id, { today: TODAY });
    assert.match(html, new RegExp(`class="cv letter tpl-${t.id} `), t.id);
    assert.doesNotMatch(html, /style="/, t.id);
    assert.doesNotMatch(html, /<script>/, t.id);
  }
  const html = renderLetter(cv, 'dakar', { today: TODAY });
  assert.match(html, /<h1 class="cv-name">Awa Ndiaye<\/h1>/);
  assert.match(html, /Dakar, le 1er octobre 2026/);
  assert.match(html, /<span class="lt-line">À<\/span><span class="lt-line">Monsieur le Directeur général<\/span>/);
  assert.match(html, /Objet :<\/strong> Demande d&#39;emploi/);
  cv.meta.anonymous = true;
  assert.match(renderLetter(cv, 'sobre', { today: TODAY }), /Awa Ndiaye/, 'une lettre est toujours nominative');
  assert.equal(placeAndDate({ ...cv, letter: { ...cv.letter, style: 'en', place: 'Dakar' } }, TODAY), 'Dakar, 1 October 2026');
  const txt = letterText(cv, TODAY);
  assert.match(txt, /^Objet : Demande d'emploi/);
  assert.match(txt, /Awa Ndiaye\n\+221 77 123 45 67/);
});

test('lettre : normalisation (import d\'un ancien CV sans lettre, valeurs invalides)', () => {
  const cv = normalizeCV({ identity: { firstName: 'A' } });
  assert.equal(cv.letter.style, 'standard');
  assert.equal(cv.letter.salutation, '');
  const empty = createEmptyCV();
  assert.equal(empty.letter.salutation, 'Madame, Monsieur,');
  const bad = normalizeCV({ letter: { style: 'x', date: 'demain', body: 42 } });
  assert.equal(bad.letter.style, 'standard');
  assert.equal(bad.letter.date, '');
  assert.equal(bad.letter.body, '42');
});

// ——— Texte brut ———

test('texte brut : ordre de lecture, rubriques standard, modèle respecté', () => {
  const cv = createSampleCV();
  const txt = cvPlainText(cv, 'sobre');
  assert.match(txt, /^AWA NDIAYE\nChargée de marketing digital\nawa\.ndiaye@example\.com \| \+221 77 123 45 67/);
  const order = ['PROFIL', 'EXPÉRIENCE PROFESSIONNELLE', 'FORMATION', 'COMPÉTENCES', 'LANGUES'].map((h) => txt.indexOf(`\n${h}\n`));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), order.join());
  assert.match(txt, /Chargée de marketing digital \| 03\/2022 – Aujourd'hui/);
  assert.match(txt, /- Piloter un budget/);
  const us = cvPlainText(createSampleCV(), 'us-resume');
  assert.doesNotMatch(us, /CENTRES D'INTÉRÊT|INTERESTS/);
  cv.meta.anonymous = true;
  assert.doesNotMatch(cvPlainText(cv), /Awa|awa\.ndiaye|77 123/);
});

// ——— Aide par métier et exemples ———

test('aide à la rédaction : métiers complets, lignes commençant par un verbe d\'action', () => {
  assert.ok(JOBS.length >= 20);
  const idsSeen = new Set();
  for (const j of JOBS) {
    assert.ok(!idsSeen.has(j.id), j.id);
    idsSeen.add(j.id);
    assert.ok(j.lines.length >= 4 && j.skills.keywords.length >= 3 && j.summary, j.id);
    const cv = createSampleCV();
    cv.experiences[0].description = j.lines.map((l) => l.replace(/\[[^\]]+\]/g, '12')).join('\n');
    assert.equal(check(cv).issues.some((i) => i.id === 'experiences.verbs'), false, `${j.id} : verbes d'action`);
  }
  assert.equal(getJob('comptable').sector, 'Finance');
  assert.equal(getJob('inconnu'), null);
});

test('exemple « jeune diplômé » : valide, 1 page, langues nationales à l\'oral', () => {
  const cv = createSampleJunior();
  assert.equal(cv.meta.country, 'SN');
  assert.equal(cv.languages.filter((l) => l.mode === 'oral').length, 2);
  const r = check(cv, cv.meta.templateId);
  assert.ok(r.score >= 95, ids(r).join());
  assert.doesNotMatch(renderCV(cv), /style="/);
});

// ——— Polices étendues ———

test('polices « latin étendu » (ŋ, ɓ, ɗ, ƴ) déclarées, locales, avec unicode-range', () => {
  const css = readFileSync(new URL('../public/css/fonts.css', import.meta.url), 'utf8');
  const ext = css.split('\n').filter((l) => l.includes('latin-ext'));
  assert.ok(ext.length >= 15);
  for (const l of ext) {
    assert.match(l, /url\(\.\.\/fonts\//);
    assert.match(l, /unicode-range: U\+0100-02BA/);
  }
});
