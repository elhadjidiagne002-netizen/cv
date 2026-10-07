// Simulateur d'entretien, portfolio en ligne (serveur + rendu), préparation aux concours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../functions/_lib/api.js';
import { cleanPortfolio, portfolioPage } from '../functions/_lib/portfolio.js';
import { onRequestGet as portfolioRoute } from '../functions/p/[slug].js';
import { createD1 } from './helpers/d1.js';
import { createEmptyCV } from '../public/js/model.js';
import { cvToPortfolio, suggestSlug, publicFields, portfolioBody } from '../public/js/portfolio-core.js';
import { questionMessages, feedbackMessages, normalizeQuestions, normalizeFeedback, bankQuestions, quickTips, BANK } from '../public/js/interview-core.js';
import { daysLeft, countdownText, nextDeadline, icsFor, letterText, salutation, cleanConcours, FAMILIES } from '../public/js/concours-core.js';
import { profileForAI } from '../public/js/ai.js';

const ORIGIN = 'https://cv.nexusmarket.sn';

function server() {
  const env = { DB: createD1() };
  const call = async (method, path, body, { key, ip = '2.2.2.2', origin = ORIGIN } = {}) => {
    const headers = { origin, 'cf-connecting-ip': ip };
    if (key) headers['x-portfolio-key'] = key;
    const init = { method, headers };
    if (body !== undefined) { init.body = JSON.stringify(body); headers['content-type'] = 'application/json'; }
    const res = await handle(new Request(`${ORIGIN}${path}`, init), env);
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return { env, call };
}

function sampleCV() {
  const cv = createEmptyCV();
  Object.assign(cv.identity, { firstName: 'Awa', lastName: 'Ndiaye (exemple)', email: 'awa@exemple.sn', phone: '77 000 00 00', address: 'Rue 10, Dakar', city: 'Dakar', birthDate: '1998-01-01', nationality: 'Sénégalaise' });
  cv.targetTitle = 'Développeuse web';
  cv.summary = 'Trois ans de projets web pour des PME.';
  cv.projects = [{ id: 'p1', name: 'Site de la coopérative (exemple)', role: 'Développement', url: 'example.org', description: 'Catalogue et commandes.' }];
  cv.experiences = [{ id: 'e1', position: 'Développeuse', employer: 'Agence (exemple)', start: '2023-02', current: true, description: 'Sites vitrines.' }];
  cv.skills = [{ id: 's1', name: 'Techniques', keywords: ['JavaScript', 'HTML'] }];
  return cv;
}

test('portfolio : rien de sensible publié par défaut, coordonnées seulement si cochées', () => {
  const cv = sampleCV();
  const p = cvToPortfolio(cv, {});
  assert.equal(p.name, 'Awa Ndiaye (exemple)');
  assert.equal(p.contact.email, '');
  assert.equal(p.contact.whatsapp, '');
  assert.equal(p.city, '');
  const json = JSON.stringify(p);
  for (const secret of ['Rue 10', '1998', 'Sénégalaise']) assert.ok(!json.includes(secret), `jamais publié : ${secret}`);
  assert.equal(p.experiences[0].period, '02/2023 – aujourd’hui');
  assert.deepEqual(p.skills, ['JavaScript', 'HTML']);
  const withContact = cvToPortfolio(cv, { email: true, whatsapp: true, city: true, sections: ['projects'] });
  assert.equal(withContact.contact.whatsapp, '770000000');
  assert.equal(withContact.city, 'Dakar');
  assert.equal(withContact.summary, '');
  assert.equal(withContact.experiences.length, 0);
  assert.ok(publicFields(withContact).includes('numéro WhatsApp'));
  assert.equal(suggestSlug(cv), 'awa-ndiaye-exemple');
});

test('portfolio : publication, adresse unique, clé obligatoire pour modifier / supprimer, page publique échappée', async () => {
  const { env, call } = server();
  const data = cvToPortfolio(sampleCV(), { email: true });
  assert.equal((await call('POST', '/api/portfolios', { slug: 'awa-ndiaye', data })).status, 400, 'accord exigé');
  assert.equal((await call('POST', '/api/portfolios', { slug: 'a b', data, consent: true })).status, 400);
  assert.equal((await call('POST', '/api/portfolios', { slug: 'admin', data, consent: true })).status, 409);
  const r = await call('POST', '/api/portfolios', { slug: 'awa-ndiaye', data, consent: true });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.url, `${ORIGIN}/p/awa-ndiaye`);
  assert.ok(r.data.key.length >= 24);
  assert.equal((await call('GET', '/api/portfolios/check/awa-ndiaye')).data.available, false);
  assert.equal((await call('GET', '/api/portfolios/check/awa-sow')).data.available, true);
  assert.equal((await call('POST', '/api/portfolios', { slug: 'awa-ndiaye', data, consent: true }, { ip: '3.3.3.3' })).status, 409);
  // Modification : mauvaise clé refusée.
  assert.equal((await call('PUT', '/api/portfolios/awa-ndiaye', { data: { ...data, title: 'Pirate' } }, { key: 'faux' })).status, 403);
  assert.equal((await call('PUT', '/api/portfolios/awa-ndiaye', { data: { ...data, title: 'Développeuse full-stack <script>' } }, { key: r.data.key })).status, 200);
  const page = await portfolioRoute({ request: new Request(`${ORIGIN}/p/awa-ndiaye`), env, params: { slug: 'awa-ndiaye' } });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await page.text();
  assert.ok(html.includes('Développeuse full-stack &lt;script&gt;'));
  assert.ok(!html.includes('<script'));
  assert.ok(!/style="/.test(html), 'aucun style en ligne (CSP)');
  assert.ok(html.includes('https://example.org/'));
  assert.equal(env.DB.raw.prepare('SELECT views FROM portfolios').get().views, 1);
  // Origine étrangère refusée (CSRF).
  assert.equal((await call('DELETE', '/api/portfolios/awa-ndiaye', undefined, { key: r.data.key, origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('DELETE', '/api/portfolios/awa-ndiaye', undefined, { key: r.data.key })).status, 200);
  const gone = await portfolioRoute({ request: new Request(`${ORIGIN}/p/awa-ndiaye`), env, params: { slug: 'awa-ndiaye' } });
  assert.equal(gone.status, 404);
});

test('portfolio : nettoyage serveur (liens http(s) seulement, e-mail valide, taille bornée)', () => {
  const p = cleanPortfolio({ name: 'X', title: 'T', contact: { email: 'pas-un-mail', website: 'javascript:alert(1)', linkedin: 'linkedin.com/in/x' }, projects: [{ name: 'P', link: 'ftp://x' }] });
  assert.equal(p.contact.email, '');
  assert.equal(p.contact.website, '');
  assert.equal(p.contact.linkedin, 'https://linkedin.com/in/x');
  assert.equal(p.projects[0].link, '');
  assert.throws(() => cleanPortfolio({ name: '' }), /nom/);
  assert.throws(() => cleanPortfolio({ name: 'X' }), /vide/);
  assert.equal(portfolioBody(p).includes('LinkedIn'), true);
  assert.match(portfolioPage(p, 'x', ORIGIN), /pf-c0/);
});

test('entretien : messages IA sans identité, langues, normalisation robuste', () => {
  const cv = sampleCV();
  const m = questionMessages({ offer: 'Développeur web junior, JavaScript, Dakar.', profile: profileForAI(cv), lang: 'wo', count: 20 });
  assert.match(m[0].content, /WOLOF/);
  assert.match(m[0].content, /discriminatoire/);
  const payload = JSON.parse(m[1].content);
  assert.equal(payload.nombre_de_questions, 10, 'au plus 10 questions');
  assert.ok(!m[1].content.includes('Ndiaye') && !m[1].content.includes('awa@exemple.sn'), 'ni nom ni e-mail envoyés');
  assert.match(feedbackMessages({ question: 'Q', answer: 'R', lang: 'en' })[0].content, /ENGLISH/);
  assert.deepEqual(normalizeQuestions({ questions: [{ q: 'Pourquoi ce poste ?', why: 'Motivation' }, { q: 'x' }, 'Parlez-moi d’un projet.'] }).map((x) => x.q), ['Pourquoi ce poste ?', 'Parlez-moi d’un projet.']);
  const f = normalizeFeedback({ note: 14, points_forts: 'Clair', a_ameliorer: ['Chiffrer'], exemple: 'STAR' });
  assert.deepEqual([f.note, f.strengths, f.improve, f.example], [10, ['Clair'], ['Chiffrer'], 'STAR']);
  assert.equal(normalizeFeedback({}).note, null);
});

test('entretien : questions classiques (3 langues) et conseils sans IA', () => {
  for (const lang of ['fr', 'wo', 'en']) {
    const q = bankQuestions(lang, 6, 3);
    assert.equal(q.length, 6);
    assert.equal(q[0].q, BANK[lang][0], 'commence par « présentez-vous »');
    assert.equal(new Set(q.map((x) => x.q)).size, 6);
  }
  assert.ok(quickTips('Oui.', 'fr').some((t) => /courte/.test(t)));
  const good = `Lorsque j'étais stagiaire, j'ai repris le suivi des commandes : ${'nous avons traité les demandes et '.repeat(8)}réduit les retards de 30 % en deux mois.`;
  assert.deepEqual(quickTips(good, 'fr').length, 1);
  assert.match(quickTips(good, 'fr')[0], /Bonne longueur/);
});

test('concours : compte à rebours, prochaine échéance, agenda .ics, lettre et formule d’appel', () => {
  const now = new Date(2026, 9, 7, 10);
  assert.equal(daysLeft('2026-10-07', now), 0);
  assert.equal(daysLeft('2026-10-17', now), 10);
  assert.equal(daysLeft('pas une date', now), null);
  assert.equal(countdownText(1), 'demain');
  assert.equal(countdownText(-2), 'passé');
  const c = cleanConcours({ family: 'douane', title: 'Concours d’agents des Douanes (exemple)', deadline: '2026-10-20', exam: '2026-11-15', place: 'Dakar', done: ['cv', 'casier', 'inconnu'] });
  assert.deepEqual(c.done, ['cv', 'casier']);
  assert.deepEqual(nextDeadline(c, now), { label: 'Dépôt du dossier', day: '2026-10-20', n: 13 });
  assert.equal(nextDeadline({ ...c, deadline: '2026-10-01' }, now).label, 'Épreuves');
  const ics = icsFor(c, new Date('2026-10-07T10:00:00Z'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART;VALUE=DATE:20261020/);
  assert.match(ics, /DTEND;VALUE=DATE:20261021/);
  assert.match(ics, /TRIGGER:-P3D/);
  assert.ok(ics.includes('\r\n'));
  const letter = letterText(c, { firstName: 'Awa', lastName: 'Diop', city: 'Thiès' }, { date: now });
  assert.match(letter, /Thiès, le 7 octobre 2026/);
  assert.match(letter, /À Monsieur le Directeur général des Douanes/);
  assert.match(letter, /^Monsieur le Directeur général,$/m);
  assert.match(letter, /- Extrait du casier judiciaire/);
  assert.match(letter, /\[diplôme exigé par l’avis\]/);
  assert.equal(salutation('Monsieur le Ministre de l’Éducation nationale'), 'Monsieur le Ministre');
  assert.ok(Object.values(FAMILIES).every((f) => f.authority && f.epreuves.length));
});
