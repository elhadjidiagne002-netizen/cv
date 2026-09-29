// Briques de rendu partagées par toutes les familles de modèles.
// Tout contenu utilisateur passe par esc() : l'aperçu est injecté en innerHTML.
// Aucun attribut style="" (interdit par la CSP) : l'apparence vient des classes CSS.

import { t, levelLabel, formatRange, formatDate, formatBirthDate } from '../i18n.js';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Texte libre → liste à puces (plusieurs lignes) ou paragraphe (une ligne). */
export function richText(text, cls = 'cv-desc') {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim())
    .filter(Boolean);
  if (!lines.length) return '';
  if (lines.length === 1) return `<p class="${cls}">${esc(lines[0])}</p>`;
  return `<ul class="${cls}">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
}

function safeHref(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

/** Affichage lisible d'une URL (sans protocole). */
export function prettyUrl(url) {
  return String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

export function fullName(view) {
  if (view.anonymous) return t(view.lang, 'anonymousName');
  return [view.identity.firstName, view.identity.lastName].filter(Boolean).join(' ');
}

/** Coordonnées dans l'ordre de lecture attendu : e-mail, téléphone, ville, liens. */
export function contactItems(view) {
  const { identity: id, lang } = view;
  if (view.anonymous) return [{ key: 'anonymous', label: t(lang, 'contact'), value: t(lang, 'anonymousContact') }];
  const items = [];
  if (id.email) items.push({ key: 'email', label: t(lang, 'email'), value: id.email, href: `mailto:${id.email}` });
  if (id.phone) items.push({ key: 'phone', label: t(lang, 'phone'), value: id.phone, href: `tel:${id.phone.replace(/[^\d+]/g, '')}` });
  if (id.address) items.push({ key: 'address', label: t(lang, 'address'), value: [id.address, id.city, id.country].filter(Boolean).join(', ') });
  else if (id.city || id.country) items.push({ key: 'city', label: t(lang, 'address'), value: [id.city, id.country].filter(Boolean).join(', ') });
  if (id.linkedin) items.push({ key: 'linkedin', label: t(lang, 'linkedin'), value: prettyUrl(id.linkedin), href: safeHref(id.linkedin) });
  if (id.website) items.push({ key: 'website', label: t(lang, 'website'), value: prettyUrl(id.website), href: safeHref(id.website) });
  return items;
}

/** Informations personnelles facultatives (uniquement si l'utilisateur a choisi de les afficher). */
export function personalItems(view) {
  const { identity: id, lang, show } = view;
  const items = [];
  if (show.birthDate && id.birthDate) items.push({ key: 'birthDate', label: t(lang, 'birthDate'), value: formatBirthDate(id.birthDate, lang) });
  if (show.nationality && id.nationality) items.push({ key: 'nationality', label: t(lang, 'nationality'), value: id.nationality });
  if (show.maritalStatus && id.maritalStatus) items.push({ key: 'maritalStatus', label: t(lang, 'maritalStatus'), value: id.maritalStatus });
  if (show.drivingLicence && id.drivingLicence) items.push({ key: 'drivingLicence', label: t(lang, 'drivingLicence'), value: id.drivingLicence });
  return items;
}

const PERSONAL_KEYS = new Set(['birthDate', 'nationality', 'maritalStatus', 'drivingLicence']);

function contactValue(c) {
  return c.href ? `<a href="${esc(c.href)}">${esc(c.value)}</a>` : esc(c.value);
}

/** Coordonnées en ligne (séparateurs typographiques, sans icône porteuse d'information). */
export function contactInline(view, sep = ' · ') {
  const all = [...contactItems(view), ...personalItems(view)];
  if (!all.length) return '';
  return `<p class="cv-contact">${all
    .map((c) => (PERSONAL_KEYS.has(c.key)
      ? `<span class="cv-c cv-c-${c.key}">${esc(c.label)}${view.lang === 'fr' ? ' :' : ':'} ${esc(c.value)}</span>`
      : `<span class="cv-c cv-c-${c.key}">${contactValue(c)}</span>`))
    .join(`<span class="cv-sep" aria-hidden="true">${esc(sep)}</span>`)}</p>`;
}

/** Coordonnées en liste libellée (colonnes latérales, Europass). */
export function contactList(view, { withPersonal = true } = {}) {
  const all = [...contactItems(view), ...(withPersonal ? personalItems(view) : [])];
  if (!all.length) return '';
  return `<ul class="cv-contact-list">${all
    .map((c) => `<li class="cv-c cv-c-${c.key}"><span class="cv-c-label">${esc(c.label)}</span> <span class="cv-c-value">${contactValue(c)}</span></li>`)
    .join('')}</ul>`;
}

export function photo(view) {
  if (!view.photo) return '';
  return `<img class="cv-photo" src="${esc(view.photo)}" alt="${esc(t(view.lang, 'photoAlt'))}">`;
}

/** Bloc d'en-tête du document (dans le corps : nom, titre visé, coordonnées). */
export function head(view, { contact = 'inline', withPhoto = true, extraClass = '', withPersonal = true } = {}) {
  const name = fullName(view);
  return `<div class="cv-head ${extraClass}">${withPhoto ? photo(view) : ''}<div class="cv-head-text">${
    name ? `<h1 class="cv-name">${esc(name)}</h1>` : ''
  }${view.targetTitle ? `<p class="cv-title">${esc(view.targetTitle)}</p>` : ''}${
    contact === 'inline' ? contactInline(view) : contact === 'list' ? contactList(view, { withPersonal }) : ''
  }</div></div>`;
}

/** Libellé de rubrique : libellé standard, ou libellé officiel propre au modèle (ex. Europass). */
export function label(view, key) {
  return (view.labels && view.labels[key]) || t(view.lang, key);
}

export function sectionTitle(view, key) {
  return `<h2 class="cv-h">${esc(label(view, key))}</h2>`;
}

function range(view, it) {
  return formatRange(it.start, it.end, it.current, view.lang, view.dateStyle);
}

function datedItem(view, title, sub, it, desc) {
  const r = range(view, it);
  return `<div class="cv-item"><div class="cv-item-head"><h3 class="cv-item-title">${esc(title)}</h3>${
    r ? `<span class="cv-date">${esc(r)}</span>` : ''
  }</div>${sub ? `<p class="cv-item-sub">${esc(sub)}</p>` : ''}${richText(desc)}</div>`;
}

const join = (...parts) => parts.filter(Boolean).join(', ');

/** Rendu du contenu d'une rubrique (sans titre). variant : 'default' | 'tags' | 'compact' */
export function sectionBody(view, key, variant = 'default') {
  const list = view.cv[key] || [];
  const { lang } = view;
  switch (key) {
    case 'experiences':
      if (variant === 'compact') {
        // CV fonctionnel : parcours condensé (poste, employeur, dates), réalisations regroupées ailleurs.
        return `<ul class="cv-list cv-timeline-compact">${list
          .map((it) => {
            const r = range(view, it);
            return `<li><strong>${esc(it.position)}</strong>${join(it.employer, it.city) ? ` — ${esc(join(it.employer, it.city))}` : ''}${
              r ? ` <span class="cv-date">${esc(r)}</span>` : ''
            }</li>`;
          })
          .join('')}</ul>`;
      }
      return list.map((it) => datedItem(view, it.position, join(it.employer, it.city), it, it.description)).join('');
    case 'education':
      return list.map((it) => datedItem(view, it.degree, join(it.school, it.city), it, it.description)).join('');
    case 'volunteering':
      return list.map((it) => datedItem(view, it.role, it.organization, it, it.description)).join('');
    case 'projects':
      return list
        .map((it) => {
          const d = formatDate(it.date, lang, view.dateStyle);
          return `<div class="cv-item"><div class="cv-item-head"><h3 class="cv-item-title">${esc(it.name)}</h3>${
            d ? `<span class="cv-date">${esc(d)}</span>` : ''
          }</div>${it.role || it.url ? `<p class="cv-item-sub">${esc(it.role)}${it.role && it.url ? ' — ' : ''}${
            it.url ? `<a href="${esc(safeHref(it.url))}">${esc(prettyUrl(it.url))}</a>` : ''
          }</p>` : ''}${richText(it.description)}</div>`;
        })
        .join('');
    case 'skills':
      if (variant === 'groups') {
        // Une catégorie = un sous-titre et une liste à puces (CV fonctionnel).
        return list
          .map((g) => `<div class="cv-skill-group cv-skill-block"><h3 class="cv-skill-name">${esc(g.name)}</h3>${
            g.keywords.length ? `<ul class="cv-desc">${g.keywords.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''
          }</div>`)
          .join('');
      }
      if (variant === 'tags') {
        return list
          .map((g) => `<div class="cv-skill-group"><h3 class="cv-skill-name">${esc(g.name)}</h3><ul class="cv-tags">${g.keywords
            .map((k) => `<li>${esc(k)}</li>`)
            .join('')}</ul></div>`)
          .join('');
      }
      return list
        .map((g) => `<p class="cv-skill"><strong class="cv-skill-name">${esc(g.name)}${g.keywords.length ? (lang === 'fr' ? ' :' : ':') : ''}</strong> ${esc(g.keywords.join(', '))}</p>`)
        .join('');
    case 'awards':
      return `<ul class="cv-list cv-awards">${list
        .map((a) => {
          const meta = join(a.issuer, formatDate(a.date, lang, view.dateStyle));
          return `<li><strong>${esc(a.name)}</strong>${meta ? ` — ${esc(meta)}` : ''}${a.description ? `<span class="cv-award-desc"> ${esc(a.description.replace(/\s*\n\s*/g, ' '))}</span>` : ''}</li>`;
        })
        .join('')}</ul>`;
    case 'publications':
      // Présentation bibliographique : Auteurs (année). Titre. Revue. Lien.
      return `<ol class="cv-list cv-pubs">${list
        .map((pb) => {
          const year = (String(pb.date || '').match(/^\d{4}/) || [''])[0];
          const who = [pb.authors, year ? `(${year})` : ''].filter(Boolean).join(' ');
          return `<li>${who ? `${esc(who)}. ` : ''}<span class="cv-pub-title">${esc(pb.title)}</span>.${pb.venue ? ` <em class="cv-pub-venue">${esc(pb.venue)}</em>.` : ''}${
            pb.url ? ` <a href="${esc(safeHref(pb.url))}">${esc(prettyUrl(pb.url))}</a>` : ''
          }</li>`;
        })
        .join('')}</ol>`;
    case 'languages':
      if (variant === 'bars') {
        // Infographie modérée : le niveau CECRL reste écrit en toutes lettres ; la jauge est décorative.
        return `<ul class="cv-langs cv-langs-bars">${list
          .map((l) => `<li><span class="cv-lang-name">${esc(l.name)}</span>${l.level ? ` <span class="cv-lang-level">— ${esc(levelLabel(lang, l.level))}</span><span class="cv-gauge lvl-${esc(l.level)}" aria-hidden="true"></span>` : ''}${
            l.certificate ? ` <span class="cv-lang-cert">(${esc(l.certificate)})</span>` : ''
          }</li>`)
          .join('')}</ul>`;
      }
      return `<ul class="cv-langs">${list
        .map((l) => `<li><span class="cv-lang-name">${esc(l.name)}</span>${l.level ? ` <span class="cv-lang-level">— ${esc(levelLabel(lang, l.level))}</span>` : ''}${
          l.certificate ? ` <span class="cv-lang-cert">(${esc(l.certificate)})</span>` : ''
        }</li>`)
        .join('')}</ul>`;
    case 'certifications':
      return `<ul class="cv-list">${list
        .map((c) => {
          const meta = join(c.issuer, formatDate(c.date, lang, view.dateStyle));
          return `<li><strong>${esc(c.name)}</strong>${meta ? ` — ${esc(meta)}` : ''}</li>`;
        })
        .join('')}</ul>`;
    case 'interests':
      if (variant === 'tags') return `<ul class="cv-tags">${list.map((i) => `<li>${esc(i.name)}</li>`).join('')}</ul>`;
      return `<p class="cv-interests">${esc(list.map((i) => i.name).join(' · '))}</p>`;
    case 'references':
      if (!list.length) return view.cv.referencesOnRequest ? `<p class="cv-refs-demand">${esc(t(lang, 'referencesOnRequest'))}</p>` : '';
      return `<ul class="cv-list cv-refs">${list
        .map((r) => `<li><strong>${esc(r.name)}</strong>${join(r.position, r.company) ? ` — ${esc(join(r.position, r.company))}` : ''}${
          r.contact ? ` — ${esc(r.contact)}` : ''
        }</li>`)
        .join('')}</ul>`;
    default:
      return '';
  }
}

export function hasContent(view, key) {
  if (key === 'summary') return Boolean(view.summary.trim());
  if (key === 'references') return view.cv.references.length > 0 || view.cv.referencesOnRequest;
  return (view.cv[key] || []).length > 0;
}

/** Rubrique complète (titre standard + contenu) ; chaîne vide si rien à afficher. */
export function section(view, key, variant = 'default') {
  if (!hasContent(view, key)) return '';
  const body = key === 'summary' ? `<p class="cv-summary">${esc(view.summary)}</p>` : sectionBody(view, key, variant);
  if (!body) return '';
  return `<section class="cv-section cv-s-${key}" data-section="${key}">${sectionTitle(view, key)}${body}</section>`;
}

/** Plusieurs rubriques dans l'ordre choisi par l'utilisateur. */
export function sections(view, keys, variantFor = () => 'default') {
  return keys.map((k) => section(view, k, variantFor(k))).join('');
}

/** Ordre imposé par un modèle pour certaines rubriques, puis les autres dans l'ordre de l'utilisateur. */
export function reorder(view, first) {
  const head = first.filter((k) => view.order.includes(k));
  return [...head, ...view.order.filter((k) => !head.includes(k))];
}

/** Rubrique « Informations personnelles » (uniquement les champs que l'utilisateur a choisi d'afficher). */
export function personalSection(view) {
  const items = personalItems(view);
  if (!items.length) return '';
  return `<section class="cv-section cv-s-personal">${sectionTitle(view, 'personal')}<ul class="cv-list cv-personal">${items
    .map((c) => `<li><span class="cv-c-label">${esc(c.label)}</span> <span class="cv-c-value">${esc(c.value)}</span></li>`)
    .join('')}</ul></section>`;
}
