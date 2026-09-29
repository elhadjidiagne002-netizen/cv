// Structure « documentaire » du CV (blocs) → texte brut (formulaires en ligne, e-mail, WhatsApp) et Word (.docx).
// C'est aussi ce qu'un logiciel de tri (ATS) « voit » : si le texte brut est clair, le CV est bien lu.
// Module pur (sans DOM). Respecte le modèle choisi (langue, rubriques exclues, mode anonyme, éléments masqués).
//
// Blocs : { t: 'name' | 'title' | 'contact' | 'h' | 'item' | 'sub' | 'bullet' | 'p' | 'right' | 'signature' | 'gap', text, date? }

import { buildView, getTemplate } from './render.js';
import { t, formatRange, formatDate } from './i18n.js';
import { contactItems, personalItems, fullName, label, languageLevel, customSection } from './templates/parts.js';

const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim()).filter(Boolean);
const join = (...p) => p.filter(Boolean).join(', ');

function bodyBlocks(view, key) {
  const { lang } = view;
  const range = (it) => formatRange(it.start, it.end, it.current, lang, view.dateStyle);
  const date = (d) => formatDate(d, lang, view.dateStyle);
  const desc = (text) => {
    const l = lines(text);
    if (l.length === 1) return [{ t: 'p', text: l[0] }];
    return l.map((x) => ({ t: 'bullet', text: x }));
  };
  const dated = (title, sub, it, text) => [{ t: 'item', text: title, date: range(it) }, ...(sub ? [{ t: 'sub', text: sub }] : []), ...desc(text)];
  const cs = customSection(view, key);
  if (cs) return cs.items.flatMap((it) => dated(it.title, it.subtitle, it, it.description));
  const list = view.cv[key] || [];
  const p = (text) => ({ t: 'p', text });
  switch (key) {
    case 'experiences': return list.flatMap((it) => dated(it.position, join(it.employer, it.city), it, it.description));
    case 'education': return list.flatMap((it) => dated(it.degree, join(it.school, it.city), it, it.description));
    case 'volunteering': return list.flatMap((it) => dated(it.role, it.organization, it, it.description));
    case 'projects':
      return list.flatMap((it) => [{ t: 'item', text: it.name, date: date(it.date) }, ...(it.role || it.url ? [{ t: 'sub', text: [it.role, it.url].filter(Boolean).join(' — ') }] : []), ...desc(it.description)]);
    case 'skills': return list.map((g) => p(`${g.name}${g.keywords.length ? `${lang === 'fr' ? ' :' : ':'} ${g.keywords.join(', ')}` : ''}`));
    case 'languages': return list.map((l) => p(`${l.name}${languageLevel(lang, l) ? ` — ${languageLevel(lang, l)}` : ''}${l.certificate ? ` (${l.certificate})` : ''}`));
    case 'certifications': return list.map((c) => p(`${c.name}${join(c.issuer, date(c.date)) ? ` — ${join(c.issuer, date(c.date))}` : ''}`));
    case 'awards':
      return list.map((a) => p(`${a.name}${join(a.issuer, date(a.date)) ? ` — ${join(a.issuer, date(a.date))}` : ''}${a.description ? ` : ${a.description.replace(/\s*\n\s*/g, ' ')}` : ''}`));
    case 'publications': return list.map((pb) => p([pb.authors, pb.date ? `(${pb.date.slice(0, 4)})` : '', pb.title, pb.venue, pb.url].filter(Boolean).join('. ')));
    case 'interests': return list.length ? [p(list.map((i) => i.name).join(' · '))] : [];
    case 'references':
      if (!list.length) return view.cv.referencesOnRequest ? [p(t(lang, 'referencesOnRequest'))] : [];
      return list.map((r) => p([r.name, join(r.position, r.company), r.contact].filter(Boolean).join(' — ')));
    default: return [];
  }
}

/** Ligne de coordonnées (e-mail, téléphones, ville, liens, informations personnelles choisies). */
export function contactLine(view) {
  const plain = ['email', 'phone', 'phone2', 'city', 'address', 'anonymous'];
  return [...contactItems(view), ...personalItems(view)]
    .map((c) => (plain.includes(c.key) ? c.value : `${c.label}${view.lang === 'fr' ? ' :' : ':'} ${c.value}`))
    .join(' | ');
}

/** Blocs du CV pour un modèle donné (ordre de lecture = ordre du modèle). */
export function cvBlocks(cv, templateId = cv.meta.templateId, opts = {}) {
  const template = typeof templateId === 'object' && templateId ? templateId : getTemplate(templateId);
  const view = buildView(cv, template, opts);
  const out = [];
  const name = fullName(view);
  if (name) out.push({ t: 'name', text: name });
  if (view.targetTitle) out.push({ t: 'title', text: view.targetTitle });
  const contact = contactLine(view);
  if (contact) out.push({ t: 'contact', text: contact });
  if (view.summary.trim()) out.push({ t: 'h', text: label(view, 'summary') }, { t: 'p', text: view.summary.trim() });
  const keys = template.id === 'us-resume' || template.id === 'europass' ? templateOrder(view, template) : view.order;
  for (const key of keys) {
    const body = bodyBlocks(view, key);
    if (!body.length) continue;
    out.push({ t: 'h', text: label(view, key) }, ...body);
  }
  return { blocks: out, view };
}

/** Ordre imposé par certains modèles (reproduit ici pour que texte brut et Word suivent le PDF). */
function templateOrder(view, template) {
  const fixed = template.id === 'us-resume'
    ? ['experiences', 'education', 'skills', 'certifications', 'awards', 'publications', 'projects', 'volunteering', 'languages']
    : ['experiences', 'education', 'languages', 'skills', 'certifications', 'publications', 'awards', 'projects', 'volunteering', 'interests', 'references'];
  return [...fixed.filter((k) => view.order.includes(k)), ...view.order.filter((k) => k.startsWith('custom:'))];
}

/** Blocs → texte brut. */
export function blocksToText(blocks) {
  const out = [];
  let prev = null;
  for (const b of blocks) {
    switch (b.t) {
      case 'name': out.push(b.text.toUpperCase()); break;
      case 'h': out.push('', b.text.toUpperCase()); break;
      case 'item':
        // Une ligne vide entre deux éléments d'une même rubrique.
        if (prev && !['h', 'name', 'title', 'contact'].includes(prev.t)) out.push('');
        out.push([b.text, b.date].filter(Boolean).join(' | '));
        break;
      case 'bullet': out.push(`- ${b.text}`); break;
      case 'gap': out.push(''); break;
      default: out.push(b.text);
    }
    prev = b;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Texte brut du CV pour un modèle donné. */
export function cvPlainText(cv, templateId = cv.meta.templateId, opts = {}) {
  return blocksToText(cvBlocks(cv, templateId, opts).blocks);
}
