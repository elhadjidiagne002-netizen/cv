// CV en texte brut : à coller dans les formulaires de candidature en ligne, un e-mail ou un message.
// C'est aussi ce qu'un logiciel de tri (ATS) « voit » : si le texte brut est clair, le CV est bien lu.
// Module pur (sans DOM). Respecte le modèle choisi (langue, rubriques exclues, mode anonyme, éléments masqués).

import { buildView, getTemplate } from './render.js';
import { t, formatRange, formatDate } from './i18n.js';
import { contactItems, personalItems, fullName, label, languageLevel } from './templates/parts.js';

const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim()).filter(Boolean);
const join = (...p) => p.filter(Boolean).join(', ');

function bodyLines(view, key) {
  const list = view.cv[key] || [];
  const { lang } = view;
  const range = (it) => formatRange(it.start, it.end, it.current, lang, view.dateStyle);
  const date = (d) => formatDate(d, lang, view.dateStyle);
  const dated = (title, sub, it, desc) => [
    [title, range(it)].filter(Boolean).join(' | '),
    ...(sub ? [sub] : []),
    ...lines(desc).map((l) => `- ${l}`),
    '',
  ];
  switch (key) {
    case 'experiences': return list.flatMap((it) => dated(it.position, join(it.employer, it.city), it, it.description));
    case 'education': return list.flatMap((it) => dated(it.degree, join(it.school, it.city), it, it.description));
    case 'volunteering': return list.flatMap((it) => dated(it.role, it.organization, it, it.description));
    case 'projects': return list.flatMap((it) => [[it.name, date(it.date)].filter(Boolean).join(' | '), ...[it.role, it.url].filter(Boolean), ...lines(it.description).map((l) => `- ${l}`), '']);
    case 'skills': return list.map((g) => `${g.name}${g.keywords.length ? `${lang === 'fr' ? ' :' : ':'} ${g.keywords.join(', ')}` : ''}`);
    case 'languages': return list.map((l) => `${l.name}${languageLevel(lang, l) ? ` — ${languageLevel(lang, l)}` : ''}${l.certificate ? ` (${l.certificate})` : ''}`);
    case 'certifications': return list.map((c) => `${c.name}${join(c.issuer, date(c.date)) ? ` — ${join(c.issuer, date(c.date))}` : ''}`);
    case 'awards': return list.map((a) => `${a.name}${join(a.issuer, date(a.date)) ? ` — ${join(a.issuer, date(a.date))}` : ''}${a.description ? ` : ${a.description.replace(/\s*\n\s*/g, ' ')}` : ''}`);
    case 'publications': return list.map((p) => [p.authors, p.date ? `(${p.date.slice(0, 4)})` : '', p.title, p.venue, p.url].filter(Boolean).join('. '));
    case 'interests': return [list.map((i) => i.name).join(' · ')];
    case 'references':
      if (!list.length) return view.cv.referencesOnRequest ? [t(lang, 'referencesOnRequest')] : [];
      return list.map((r) => [r.name, join(r.position, r.company), r.contact].filter(Boolean).join(' — '));
    default: return [];
  }
}

/** Texte brut du CV pour un modèle donné. */
export function cvPlainText(cv, templateId = cv.meta.templateId, opts = {}) {
  const template = typeof templateId === 'object' && templateId ? templateId : getTemplate(templateId);
  const view = buildView(cv, template, opts);
  const out = [];
  const name = fullName(view);
  if (name) out.push(name.toUpperCase());
  if (view.targetTitle) out.push(view.targetTitle);
  const contact = [...contactItems(view), ...personalItems(view)].map((c) => (['email', 'phone', 'phone2', 'city', 'address', 'anonymous'].includes(c.key) ? c.value : `${c.label}${view.lang === 'fr' ? ' :' : ':'} ${c.value}`));
  if (contact.length) out.push(contact.join(' | '));
  if (view.summary.trim()) out.push('', label(view, 'summary').toUpperCase(), view.summary.trim());
  for (const key of view.order) {
    const body = bodyLines(view, key);
    while (body.length && body[body.length - 1] === '') body.pop();
    if (!body.length) continue;
    out.push('', label(view, key).toUpperCase(), ...body);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
