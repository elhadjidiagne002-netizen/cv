// Interopérabilité avec le format ouvert JSON Resume (https://jsonresume.org/schema, v1.0.0) :
// export pour réutiliser son CV dans d'autres outils, import d'un fichier créé ailleurs.
// Module pur (sans DOM). Les champs sans équivalent sont ignorés ; rien n'est envoyé nulle part.

import { createEmptyCV, createItem, normalizeCV, CEFR_LEVELS } from './model.js';
import { looksFrench } from './norms.js';

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const ym = (d) => {
  const m = str(d).match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return '';
  return m[2] ? `${m[1]}-${m[2]}` : m[1];
};
const lines = (text) => str(text).split(/\r?\n/).map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim()).filter(Boolean);
const visible = (list) => (list || []).filter((it) => !it.hidden);

/** Niveau CECRL → « fluency » lisible (JSON Resume n'impose pas d'échelle). */
function fluency(level) {
  if (level === 'native') return 'Native speaker';
  return CEFR_LEVELS.includes(level) ? `CEFR ${level}` : str(level);
}

/** « fluency » libre → niveau CECRL quand c'est possible. */
export function levelFromFluency(text) {
  const s = str(text);
  const cefr = s.toUpperCase().match(/\b([ABC][12])\b/);
  if (cefr) return cefr[1];
  if (/native|maternelle|mother|bilingu/i.test(s)) return 'native';
  if (/full professional|courant|fluent/i.test(s)) return 'C1';
  if (/professional working|professionnel/i.test(s)) return 'B2';
  if (/limited working|interm/i.test(s)) return 'B1';
  if (/elementary|élémentaire|notions|basic|débutant|beginner/i.test(s)) return 'A2';
  return '';
}

/** CV → objet JSON Resume. */
export function toJSONResume(cv) {
  const id = cv.identity;
  const profiles = id.linkedin ? [{ network: 'LinkedIn', url: id.linkedin }] : [];
  const period = (it) => ({ startDate: it.start || undefined, endDate: it.current ? undefined : it.end || undefined });
  const out = {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: [id.firstName, id.lastName].filter(Boolean).join(' '),
      label: cv.targetTitle,
      email: id.email,
      phone: id.phone,
      url: id.website,
      summary: cv.summary,
      location: { address: id.address, city: id.city, countryCode: /s[ée]n[ée]gal/i.test(id.country) ? 'SN' : undefined, region: id.country },
      profiles,
    },
    work: visible(cv.experiences).map((e) => ({ name: e.employer, position: e.position, location: e.city, ...period(e), highlights: lines(e.description) })),
    volunteer: visible(cv.volunteering).map((v) => ({ organization: v.organization, position: v.role, ...period(v), highlights: lines(v.description) })),
    education: visible(cv.education).map((e) => ({ institution: e.school, studyType: e.degree, area: '', ...period(e), courses: lines(e.description) })),
    awards: visible(cv.awards).map((a) => ({ title: a.name, date: a.date || undefined, awarder: a.issuer, summary: a.description })),
    certificates: visible(cv.certifications).map((c) => ({ name: c.name, date: c.date || undefined, issuer: c.issuer })),
    publications: visible(cv.publications).map((p) => ({ name: p.title, publisher: p.venue, releaseDate: p.date || undefined, url: p.url, summary: p.authors })),
    skills: visible(cv.skills).map((g) => ({ name: g.name, keywords: g.keywords })),
    languages: visible(cv.languages).map((l) => ({ language: l.name, fluency: [fluency(l.level), l.mode === 'oral' ? 'spoken' : '', l.certificate].filter(Boolean).join(', ') })),
    interests: visible(cv.interests).map((i) => ({ name: i.name })),
    references: visible(cv.references).map((r) => ({ name: r.name, reference: [r.position, r.company, r.contact].filter(Boolean).join(' — ') })),
    projects: visible(cv.projects).map((p) => ({ name: p.name, description: p.description, startDate: p.date || undefined, url: p.url, roles: p.role ? [p.role] : [] })),
    meta: { version: 'v1.0.0', lastModified: cv.meta.updatedAt, canonical: 'cv-en-ligne' },
  };
  return JSON.parse(JSON.stringify(out)); // retire les « undefined »
}

/** Le document ressemble-t-il à un JSON Resume ? */
export function isJSONResume(data) {
  return Boolean(data && typeof data === 'object' && data.basics && typeof data.basics === 'object')
    || Boolean(data && typeof data === 'object' && Array.isArray(data.work) && !data.experiences);
}

const description = (summary, highlights) => [...lines(summary), ...(Array.isArray(highlights) ? highlights.map(str).filter(Boolean) : [])].join('\n');

/** Objet JSON Resume → CV (nouvel identifiant). */
export function fromJSONResume(data) {
  const b = data.basics || {};
  const [firstName, ...rest] = str(b.name).split(/\s+/);
  const loc = b.location || {};
  const linkedin = (Array.isArray(b.profiles) ? b.profiles : []).find((p) => /linkedin/i.test(`${p.network} ${p.url}`));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const cv = createEmptyCV({
    meta: { title: `${str(b.name) || 'CV'} (JSON Resume)` },
    identity: {
      firstName: firstName || '',
      lastName: rest.join(' '),
      email: str(b.email),
      phone: str(b.phone),
      website: str(b.url || b.website),
      linkedin: linkedin ? str(linkedin.url) : '',
      city: str(loc.city),
      country: str(loc.region) || (str(loc.countryCode) === 'SN' ? 'Sénégal' : str(loc.countryCode)),
      address: str(loc.address),
    },
    targetTitle: str(b.label),
    summary: str(b.summary),
  });
  const cur = (e) => Boolean(e.startDate) && !e.endDate;
  cv.experiences = arr(data.work).map((e) => createItem('experiences', {
    position: str(e.position), employer: str(e.name || e.company), city: str(e.location), start: ym(e.startDate), end: ym(e.endDate), current: cur(e), description: description(e.summary, e.highlights),
  }));
  cv.volunteering = arr(data.volunteer).map((v) => createItem('volunteering', {
    role: str(v.position), organization: str(v.organization), start: ym(v.startDate), end: ym(v.endDate), current: cur(v), description: description(v.summary, v.highlights),
  }));
  cv.education = arr(data.education).map((e) => createItem('education', {
    degree: [str(e.studyType), str(e.area)].filter(Boolean).join(' — '), school: str(e.institution), start: ym(e.startDate), end: ym(e.endDate),
    description: [e.score ? `Mention / note : ${str(e.score)}` : '', ...arr(e.courses).map(str)].filter(Boolean).join('\n'),
  }));
  cv.skills = arr(data.skills).map((s) => createItem('skills', { name: str(s.name) || 'Compétences', keywords: arr(s.keywords).map(str).filter(Boolean) }));
  cv.languages = arr(data.languages).map((l) => createItem('languages', {
    name: str(l.language), level: levelFromFluency(l.fluency), mode: /spoken|oral/i.test(str(l.fluency)) ? 'oral' : '',
  }));
  cv.certifications = arr(data.certificates).map((c) => createItem('certifications', { name: str(c.name), issuer: str(c.issuer), date: ym(c.date) }));
  cv.awards = arr(data.awards).map((a) => createItem('awards', { name: str(a.title), issuer: str(a.awarder), date: ym(a.date), description: str(a.summary) }));
  cv.publications = arr(data.publications).map((p) => createItem('publications', { title: str(p.name), venue: str(p.publisher), date: ym(p.releaseDate), url: str(p.url), authors: str(p.summary).length < 120 ? str(p.summary) : '' }));
  cv.projects = arr(data.projects).map((p) => createItem('projects', {
    name: str(p.name), role: arr(p.roles).map(str).join(', '), date: ym(p.startDate), url: str(p.url), description: description(p.description, p.highlights),
  }));
  cv.interests = arr(data.interests).map((i) => createItem('interests', { name: [str(i.name), ...arr(i.keywords).map(str)].filter(Boolean).join(' : ') }));
  cv.references = arr(data.references).map((r) => createItem('references', { name: str(r.name), contact: str(r.reference).slice(0, 200) }));
  // Langue déduite du contenu (JSON Resume est souvent rédigé en anglais).
  const sample = [b.summary, ...arr(data.work).flatMap((e) => [e.summary, ...arr(e.highlights)])].map(str).join(' ');
  if (sample.split(/\s+/).length >= 6 && !looksFrench(sample)) cv.meta.lang = 'en';
  return normalizeCV(cv);
}
