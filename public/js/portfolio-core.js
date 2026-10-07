// Portfolio en ligne : ce qui, du CV, devient PUBLIC (rubrique par rubrique, au choix de la personne). Module pur (testé).
// Jamais publié : photo, adresse, téléphone (sauf WhatsApp coché), date et lieu de naissance, nationalité,
// situation familiale, permis, références.

export const PF_KEY = 'cv-portfolio-v1';          // { slug, key, cvId } gardés dans ce navigateur
export const COLORS = ['#0b5cad', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#111827'];
export const SECTIONS = [
  ['summary', 'Présentation (accroche)'],
  ['projects', 'Projets et réalisations'],
  ['experiences', 'Expériences'],
  ['education', 'Formation'],
  ['skills', 'Compétences'],
  ['languages', 'Langues'],
];

const visible = (list) => (Array.isArray(list) ? list : []).filter((x) => x && !x.hidden);
const ym = (s) => { const m = /^(\d{4})-(\d{2})$/.exec(String(s || '')); return m ? `${m[2]}/${m[1]}` : String(s || ''); };
export const periodText = (it, en = false) => [ym(it.start), it.current ? (en ? 'present' : 'aujourd’hui') : ym(it.end)].filter(Boolean).join(' – ');

/** Suggestion d'adresse : prénom-nom sans accents. */
export function suggestSlug(cv) {
  const base = [cv.identity?.firstName, cv.identity?.lastName].filter(Boolean).join(' ') || cv.targetTitle || 'mon-portfolio';
  return base.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'mon-portfolio';
}

/**
 * Données publiées. choices = { sections: Set|Array, email, whatsapp, linkedin, website, city, color }.
 * Par défaut rien de sensible : chaque coordonnée doit être cochée.
 */
export function cvToPortfolio(cv, choices = {}) {
  const on = new Set(choices.sections || SECTIONS.map(([k]) => k));
  const id = cv.identity || {};
  const en = cv.meta?.lang === 'en';
  return {
    name: [id.firstName, id.lastName].filter(Boolean).join(' ').trim(),
    title: String(cv.targetTitle || '').trim(),
    city: choices.city ? String(id.city || '').trim() : '',
    summary: on.has('summary') ? String(cv.summary || '').trim() : '',
    color: COLORS.includes(choices.color) ? choices.color : COLORS[0],
    contact: {
      email: choices.email ? id.email || '' : '',
      whatsapp: choices.whatsapp ? String(id.phone || '').replace(/[^\d+]/g, '') : '',
      linkedin: choices.linkedin ? id.linkedin || '' : '',
      website: choices.website ? id.website || '' : '',
    },
    skills: on.has('skills') ? visible(cv.skills).flatMap((g) => (Array.isArray(g.keywords) ? g.keywords : [])).map((k) => String(k).trim()).filter(Boolean).slice(0, 30) : [],
    experiences: on.has('experiences') ? visible(cv.experiences).slice(0, 10).map((e) => ({ position: e.position || '', employer: e.employer || '', period: periodText(e, en), description: e.description || '' })) : [],
    projects: on.has('projects') ? visible(cv.projects).slice(0, 12).map((p) => ({ name: p.name || '', description: [p.role, p.description].filter(Boolean).join(' — '), link: p.url || '' })) : [],
    education: on.has('education') ? visible(cv.education).slice(0, 6).map((e) => ({ degree: e.degree || '', school: e.school || '', period: periodText(e, en) })) : [],
    languages: on.has('languages') ? visible(cv.languages).slice(0, 8).map((l) => ({ name: l.name || '', level: l.level || '' })) : [],
    cv_lang: en ? 'en' : 'fr',
  };
}

/** Ce que la personne doit savoir avant de publier (affiché à côté de la case d'accord). */
export function publicFields(p) {
  const out = ['nom'];
  if (p.title) out.push('titre');
  if (p.city) out.push('ville');
  for (const [k, l] of [['email', 'e-mail'], ['whatsapp', 'numéro WhatsApp'], ['linkedin', 'LinkedIn'], ['website', 'site']]) if (p.contact[k]) out.push(l);
  for (const [k, l] of SECTIONS) if ((Array.isArray(p[k]) ? p[k].length : p[k])) out.push(l.toLowerCase());
  return out;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = (s) => esc(s).replace(/\n/g, '<br>');

/** Classe de couleur du thème (pas de style en ligne : CSP). */
export const colorClass = (color) => `pf-c${Math.max(0, COLORS.indexOf(color))}`;

/** Contenu de la page publique /p/<adresse>, aussi utilisé pour l'aperçu dans l'éditeur. */
export function portfolioBody(d, { photoUrl = (im) => im.src || '' } = {}) {
  const en = d.cv_lang === 'en';
  const L = en
    ? { exp: 'Experience', proj: 'Projects', edu: 'Education', skills: 'Skills', lang: 'Languages', contact: 'Contact', see: 'View project', made: 'Portfolio created with', site: 'Website', photos: 'Work samples' }
    : { exp: 'Expérience', proj: 'Projets et réalisations', edu: 'Formation', skills: 'Compétences', lang: 'Langues', contact: 'Me contacter', see: 'Voir le projet', made: 'Portfolio créé avec', site: 'Site', photos: 'Réalisations en images' };
  const c = d.contact || {};
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/^\+/, '').replace(/^(\d{9})$/, '221$1')}` : '';
  const list = (k) => (Array.isArray(d[k]) ? d[k] : []);
  const links = [
    c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '',
    wa ? `<a href="${esc(wa)}" rel="noopener">WhatsApp</a>` : '',
    c.linkedin ? `<a href="${esc(c.linkedin)}" rel="noopener nofollow">LinkedIn</a>` : '',
    c.website ? `<a href="${esc(c.website)}" rel="noopener nofollow">${L.site}</a>` : '',
  ].join('');
  const section = (title, html) => `<section class="pf-sec"><h2>${title}</h2>${html}</section>`;
  return [
    '<main class="pf-main"><header class="pf-head">',
    `<h1>${esc(d.name)}</h1>`,
    d.title ? `<p class="pf-title">${esc(d.title)}</p>` : '',
    d.city ? `<p class="pf-city">${esc(d.city)}</p>` : '',
    links ? `<nav class="pf-links" aria-label="${L.contact}">${links}</nav>` : '',
    '</header>',
    d.summary ? `<section class="pf-sec"><p>${para(d.summary)}</p></section>` : '',
    list('images').length ? section(L.photos, `<div class="pf-photos">${list('images').map((im) => `<figure><img src="${esc(photoUrl(im))}" alt="${esc(im.caption || L.photos)}" loading="lazy">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`) : '',
    list('projects').length ? section(L.proj, `<div class="pf-grid">${list('projects').map((x) => `<article class="pf-card"><h3>${esc(x.name)}</h3>${x.description ? `<p>${para(x.description)}</p>` : ''}${x.link ? `<a href="${esc(x.link)}" rel="noopener nofollow">${L.see} →</a>` : ''}</article>`).join('')}</div>`) : '',
    list('experiences').length ? section(L.exp, list('experiences').map((x) => `<div class="pf-item"><h3>${esc(x.position)}${x.employer ? ` — ${esc(x.employer)}` : ''}</h3>${x.period ? `<p class="pf-period">${esc(x.period)}</p>` : ''}${x.description ? `<p>${para(x.description)}</p>` : ''}</div>`).join('')) : '',
    list('education').length ? section(L.edu, list('education').map((x) => `<div class="pf-item"><h3>${esc(x.degree)}</h3><p class="pf-period">${esc([x.school, x.period].filter(Boolean).join(' · '))}</p></div>`).join('')) : '',
    list('skills').length ? section(L.skills, `<ul class="pf-tags">${list('skills').map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`) : '',
    list('languages').length ? section(L.lang, `<ul class="pf-tags">${list('languages').map((l) => `<li>${esc(l.name)}${l.level ? ` · ${esc(l.level)}` : ''}</li>`).join('')}</ul>`) : '',
    `<footer class="pf-foot">${L.made} <a href="/?src=portfolio">CV en ligne</a></footer></main>`,
  ].join('\n');
}
