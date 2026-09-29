// Lettre de motivation assortie au CV : même en-tête, mêmes polices et couleurs que le modèle choisi.
// Trois usages : « standard » (lettre française), « administratif » (usage sénégalais : « À Monsieur le
// Directeur… », objet, formule de haute considération), « en » (cover letter).
// Module pur (sans DOM) : brouillon guidé (vous / moi / nous), contrôles, rendu HTML et texte brut.

import { buildView, getTemplate } from './render.js';
import { head, esc } from './templates/parts.js';
import { LABELS } from './i18n.js';
import { yearsOfExperience, SEVERITY_WEIGHT } from './norms.js';
import { matchOffer } from './match.js';

/** Langue de la lettre (le style « en » est rédigé en anglais). */
export const letterLang = (letter) => (letter.style === 'en' ? 'en' : 'fr');

/** Date de la lettre : « Dakar, le 29 septembre 2026 » / « Dakar, 29 September 2026 ». */
export function placeAndDate(cv, today = new Date()) {
  const { letter } = cv;
  const lang = letterLang(letter);
  let d = today;
  const m = String(letter.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const month = LABELS[lang].months[d.getMonth()];
  const day = lang === 'fr' && d.getDate() === 1 ? '1er' : String(d.getDate());
  const date = lang === 'en' ? `${d.getDate()} ${month} ${d.getFullYear()}` : `le ${day} ${month} ${d.getFullYear()}`;
  const place = letter.place || cv.identity.city;
  return place ? `${place}, ${date}` : lang === 'en' ? date : date.charAt(0).toUpperCase() + date.slice(1);
}

/**
 * Formule d'appel déduite du destinataire : « Monsieur le Directeur des ressources humaines »
 * → « Monsieur le Directeur, » (on reprend le titre sans son complément).
 */
export function salutationFor(recipientTitle, style = 'standard') {
  if (style === 'en') return 'Dear Hiring Manager,';
  const m = String(recipientTitle || '').trim().match(/^(Monsieur|Madame)\s+(le|la|l')\s*([A-Za-zÀ-ÿ-]+)(\s+(g[ée]n[ée]ral(e)?|adjoint(e)?))?/i);
  if (!m) return 'Madame, Monsieur,';
  const civ = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  const art = m[2].toLowerCase();
  return `${civ} ${art}${art === 'l\'' ? '' : ' '}${m[3]}${m[4] || ''},`;
}

/** Formule de politesse cohérente avec la formule d'appel. */
export function closingFor(salutation, style = 'standard') {
  const who = String(salutation || 'Madame, Monsieur,').replace(/,\s*$/, '');
  if (style === 'en') return /^Dear (Mr|Ms|Mrs|Dr)\b/.test(salutation) ? 'Yours sincerely,' : 'Yours faithfully,';
  if (style === 'administratif') return `Dans l'attente d'une suite favorable, je vous prie d'agréer, ${who}, l'expression de ma haute considération.`;
  return `Je vous prie d'agréer, ${who}, l'expression de mes salutations distinguées.`;
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const cleanLine = (l) => l.replace(/^\s*[-•*–]\s*/, '').replace(/[.;]\s*$/, '').trim();
const isInfinitive = (l) => /^[a-zàâçéèêëîïôûùüÿœ'-]+(er|ir|re|oir)\b/i.test(l);
/** « de » + infinitif, avec élision devant une voyelle (« d'augmenter »). */
const deInf = (l) => (/^[aeiouyéèêàâîôûh]/i.test(l) ? `d'${lowerFirst(l)}` : `de ${lowerFirst(l)}`);

/**
 * Brouillon de lettre construit à partir du CV (et de l'offre si elle est collée).
 * Les passages entre crochets [ … ] sont à personnaliser : le contrôleur les signale tant qu'il en reste.
 */
export function draftLetter(cv, style = cv.letter.style || 'standard', today = new Date()) {
  const L = cv.letter;
  const title = cv.targetTitle || (style === 'en' ? '[position]' : '[intitulé du poste]');
  const org = L.organization || (style === 'en' ? '[company]' : '[nom de l\'entreprise]');
  const years = Math.floor(yearsOfExperience(cv, today)); // jamais arrondi à la hausse
  const exp = cv.experiences.filter((e) => !e.hidden);
  const last = exp[0];
  const skills = cv.skills.filter((g) => !g.hidden).flatMap((g) => g.keywords);
  // « Stratégie social media » → « stratégie social media » en milieu de phrase ; « Excel », « SEO » inchangés.
  const inSentence = (k) => (/^[A-ZÀ-Ý][a-zà-ÿ]+\s/.test(k) ? lowerFirst(k) : k);
  let keywords = skills.slice(0, 4);
  if (cv.meta.jobOffer && cv.meta.jobOffer.trim()) {
    const matched = matchOffer(cv, cv.meta.jobOffer).matched.map((k) => k.term);
    if (matched.length) keywords = matched.slice(0, 4);
  }
  keywords = keywords.map(inSentence);
  const bullets = last ? String(last.description || '').split(/\r?\n/).map(cleanLine).filter(Boolean).slice(0, 2) : [];
  const latestEdu = cv.education.find((e) => !e.hidden);
  const salutation = style === 'en' ? 'Dear Hiring Manager,' : salutationFor(L.recipientTitle, style);

  if (style === 'en') {
    const body = [
      `I am writing to apply for the ${title} position${L.reference ? ` (ref. ${L.reference})` : ''} at ${org}. [One sentence on what attracts you to the company: a project, its values, recent news.]`,
      last
        ? `${years ? `With ${years} year${years > 1 ? 's' : ''} of experience` : 'With my experience'} as ${last.position}${last.employer ? ` at ${last.employer}` : ''}, I have developed solid skills in ${keywords.length ? keywords.join(', ') : '[key skills]'}. ${bullets.length ? `My achievements include: ${bullets.map(lowerFirst).join('; ')}.` : '[One measurable achievement.]'}`
        : `${latestEdu ? `As a graduate of ${latestEdu.school || latestEdu.degree}, ` : ''}I have developed skills in ${keywords.length ? keywords.join(', ') : '[key skills]'}. [One project or internship that proves it.]`,
      `I would welcome the opportunity to contribute to ${org} and to discuss my application with you at your convenience. Thank you for your time and consideration.`,
    ].join('\n\n');
    return { subject: `Application for the ${title} position`, salutation, body, closing: closingFor(salutation, 'en'), enclosures: 'Resume' };
  }

  let moi;
  if (last) {
    const dur = years >= 1 ? `Avec ${years} an${years > 1 ? 's' : ''} d'expérience, notamment comme ${lowerFirst(last.position)}` : `Grâce à mon expérience de ${lowerFirst(last.position)}`;
    const where = last.employer ? ` chez ${last.employer}` : '';
    let achievements = '';
    if (bullets.length && bullets.every(isInfinitive)) achievements = ` J'y ai eu pour missions ${bullets.map(deInf).join(' et ')}.`;
    else if (bullets.length) achievements = ` Parmi mes réalisations : ${bullets.map(lowerFirst).join(' ; ')}.`;
    else achievements = ' [Une réalisation chiffrée qui prouve vos compétences.]';
    moi = `${dur}${where}, j'ai développé des compétences en ${keywords.length ? keywords.join(', ') : '[compétences clés du poste]'}.${achievements}`;
  } else {
    moi = `${latestEdu ? `Titulaire ${/^[aeiouyéèêàâîôûh]/i.test(latestEdu.degree) ? 'd\'' : 'du '}${latestEdu.degree}${latestEdu.school ? ` (${latestEdu.school})` : ''}, ` : ''}j'ai acquis des compétences en ${keywords.length ? keywords.join(', ') : '[compétences clés du poste]'}. [Un stage, un projet ou un engagement qui le prouve.]`;
  }
  const vous = style === 'administratif'
    ? `J'ai l'honneur de solliciter auprès de votre haute bienveillance un emploi de ${lowerFirst(title)} au sein de votre structure${L.reference ? ` (avis de recrutement ${L.reference})` : ''}. [Ce qui vous attire dans ses missions.]`
    : `${L.reference ? `Votre offre ${L.reference} pour le poste de ${lowerFirst(title)} au sein de ${org} a retenu toute mon attention.` : `Le poste de ${lowerFirst(title)} au sein de ${org} correspond pleinement à mon parcours et à mon projet professionnel.`} [Ce qui vous attire chez cet employeur : projets, valeurs, actualité.]`;
  const nous = style === 'administratif'
    ? `Rigueur, disponibilité et sens du service : telles sont les qualités que je souhaite mettre au service de votre structure. Dans l'attente de vous exposer mes motivations lors d'un entretien, je reste à votre disposition à la date qui vous conviendra.`
    : `Mettre ces compétences au service de ${org} et contribuer à [un objectif précis du poste] : telle est ma motivation. Je me tiens à votre disposition pour un entretien, à votre convenance.`;
  const subject = style === 'administratif'
    ? (cv.targetTitle ? `Demande d'emploi en qualité de ${lowerFirst(cv.targetTitle)}` : 'Demande d\'emploi')
    : (cv.targetTitle ? `Candidature au poste de ${lowerFirst(cv.targetTitle)}` : 'Candidature spontanée');
  return {
    subject,
    salutation,
    body: [vous, moi, nous].join('\n\n'),
    closing: closingFor(salutation, style),
    enclosures: style === 'administratif' ? 'Curriculum vitae, copies des diplômes et attestations' : 'Curriculum vitae',
  };
}

/** Paragraphes du corps (séparés par une ligne vide). */
export function paragraphs(text) {
  return String(text || '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

export const wordCount = (text) => (String(text || '').match(/[A-Za-zÀ-ÿœŒ0-9'’-]+/g) || []).length;

/**
 * Contrôle de la lettre. Renvoie { score, issues: [{ id, severity, message, target }] }.
 * opts : { pages?: number (mesuré dans l'aperçu) }
 */
export function checkLetter(cv, opts = {}) {
  const L = cv.letter;
  const issues = [];
  const add = (id, severity, message, target) => issues.push({ id, severity, message, target });
  const lang = letterLang(L);
  const words = wordCount(L.body);
  if (!L.body.trim()) add('letter.body', 'error', 'La lettre est vide : cliquez sur « Proposer un brouillon » puis personnalisez-le.', 'letter.body');
  else {
    if (words > 450) add('letter.long', 'warning', `Lettre de ${words} mots : visez 250 à 400 mots pour tenir sur une page.`, 'letter.body');
    else if (words < 120) add('letter.short', 'info', `Lettre de ${words} mots : développez (250 à 400 mots), en 3 paragraphes (vous, moi, nous).`, 'letter.body');
    const n = paragraphs(L.body).length;
    if (n < 3) add('letter.paragraphs', 'info', `${n} paragraphe${n > 1 ? 's' : ''} : structurez en 3 ou 4 (ce qui vous attire chez l'employeur, ce que vous apportez, la suite proposée). Séparez-les par une ligne vide.`, 'letter.body');
  }
  const all = [L.subject, L.salutation, L.body, L.closing, L.recipientTitle, L.organization].join('\n');
  if (/\[[^\]]+\]/.test(all)) add('letter.placeholder', 'warning', 'Il reste des passages entre crochets [ … ] à personnaliser.', /\[[^\]]+\]/.test(L.body) ? 'letter.body' : 'letter.organization');
  if (!L.subject.trim()) add('letter.subject', L.style === 'administratif' ? 'warning' : 'info', 'Ajoutez l\'objet de la lettre (ex. : Candidature au poste de comptable).', 'letter.subject');
  if (!L.organization.trim() && !L.recipientTitle.trim()) add('letter.recipient', 'warning', 'Indiquez le destinataire (entreprise ou administration, et si possible la fonction de la personne).', 'letter.organization');
  if (!L.salutation.trim()) add('letter.salutation', 'warning', 'Ajoutez une formule d\'appel (ex. : « Madame, Monsieur, »).', 'letter.salutation');
  if (!L.closing.trim()) add('letter.closing', 'warning', 'Ajoutez une formule de politesse en fin de lettre.', 'letter.closing');
  else if (lang === 'fr' && L.salutation.trim()) {
    const who = L.salutation.replace(/,\s*$/, '').trim();
    if (who && !L.closing.includes(who)) add('letter.consistency', 'info', `La formule de politesse doit reprendre la formule d'appel (« ${who} »).`, 'letter.closing');
  }
  if (!(cv.identity.firstName || cv.identity.lastName)) add('letter.signature', 'warning', 'Votre nom (rubrique Identité) sert de signature : renseignez-le.', 'identity.firstName');
  if (lang === 'fr' && /\bje me permets\b|\bsuite à votre annonce\b/i.test(L.body)) add('letter.cliche', 'info', 'Formules toutes faites (« je me permets », « suite à votre annonce ») : allez droit au but.', 'letter.body');
  const sentences = String(L.body).split(/[.!?]\s+/).filter((s) => s.trim());
  const je = sentences.filter((s) => /^\s*(je|j')/i.test(s)).length;
  if (lang === 'fr' && sentences.length >= 5 && je / sentences.length > 0.5) add('letter.je', 'info', `${je} phrases sur ${sentences.length} commencent par « Je » : variez (parlez aussi de l'employeur et de ses besoins).`, 'letter.body');
  if (cv.meta.jobOffer && cv.meta.jobOffer.trim() && L.body.trim()) {
    const letterCV = { ...cv, experiences: [], education: [], skills: [], summary: L.body, targetTitle: L.subject };
    const r = matchOffer(letterCV, cv.meta.jobOffer);
    if (r.total && r.matched.length < Math.min(3, r.total)) add('letter.keywords', 'info', `La lettre ne reprend que ${r.matched.length} mot${r.matched.length > 1 ? 's' : ''}-clé${r.matched.length > 1 ? 's' : ''} de l'offre : citez 2 ou 3 compétences demandées.`, 'letter.body');
  }
  if (opts.pages > 1) add('letter.pages', 'warning', `La lettre fait ${opts.pages} pages : une lettre de motivation tient sur une seule page.`, 'letter.body');
  const penalty = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0);
  const order = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score: Math.max(0, 100 - penalty), issues, words };
}

/**
 * Rendu HTML de la lettre, assorti au modèle du CV (classes .cv .tpl-<id> : mêmes polices et couleurs).
 * Toujours nominative (le mode anonyme concerne le CV).
 */
export function renderLetter(cv, templateId = cv.meta.templateId, opts = {}) {
  const template = typeof templateId === 'object' && templateId ? templateId : getTemplate(templateId);
  const L = cv.letter;
  const lang = letterLang(L);
  const view = buildView({ ...cv, meta: { ...cv.meta, lang } }, { ...template, lang }, { anonymous: false, today: opts.today });
  view.targetTitle = '';
  view.photo = '';
  const lines = (arr) => arr.filter(Boolean).map((l) => `<span class="lt-line">${esc(l)}</span>`).join('');
  const admin = L.style === 'administratif';
  const recipient = lines([
    admin && (L.recipientTitle || L.organization) ? 'À' : '',
    L.recipientName && !admin ? L.recipientName : '',
    L.recipientTitle,
    L.organization,
    admin && L.recipientName ? `(à l'attention de ${L.recipientName})` : '',
    L.recipientAddress,
  ]);
  const date = `<p class="lt-date">${esc(placeAndDate(cv, opts.today))}</p>`;
  const recipientBlock = recipient ? `<p class="lt-recipient">${recipient}</p>` : '';
  const colon = lang === 'fr' ? ' :' : ':';
  const subjectLabel = lang === 'fr' ? 'Objet' : 'Subject';
  const refLabel = lang === 'fr' ? 'Réf.' : 'Ref.';
  const encLabel = lang === 'fr' ? 'P. J.' : 'Enclosure';
  const name = [cv.identity.firstName, cv.identity.lastName].filter(Boolean).join(' ');
  const classes = ['cv', 'letter', `tpl-${template.id}`, `fam-${template.family}`, `paper-${view.paper.toLowerCase()}`, `letter-${L.style}`];
  if (template.layoutClass) classes.push(template.layoutClass);
  return `<article class="${classes.join(' ')}" lang="${lang}" data-template="${template.id}" data-paper="${view.paper}" data-doc="letter">${
    head(view, { contact: 'inline', withPhoto: false })
  }<div class="lt-top">${admin ? date + recipientBlock : recipientBlock + date}</div>${
    L.subject ? `<p class="lt-subject"><strong>${subjectLabel}${colon}</strong> ${esc(L.subject)}</p>` : ''
  }${L.reference ? `<p class="lt-ref"><strong>${refLabel}${colon}</strong> ${esc(L.reference)}</p>` : ''}${
    L.salutation ? `<p class="lt-salutation">${esc(L.salutation)}</p>` : ''
  }<div class="lt-body">${paragraphs(L.body).map((p) => `<p>${esc(p)}</p>`).join('')}</div>${
    L.closing ? `<p class="lt-closing">${esc(L.closing.replace(/\s*\n\s*/g, ' '))}</p>` : ''
  }${name ? `<p class="lt-signature">${esc(name)}</p>` : ''}${
    L.enclosures ? `<p class="lt-enclosures"><strong>${encLabel}${colon}</strong> ${esc(L.enclosures)}</p>` : ''
  }</article>`;
}

/** Lettre en texte brut (copier-coller dans un formulaire ou le corps d'un e-mail). */
export function letterText(cv, today = new Date()) {
  const L = cv.letter;
  const lang = letterLang(L);
  const out = [];
  if (L.subject) out.push(`${lang === 'fr' ? 'Objet :' : 'Subject:'} ${L.subject}`, '');
  if (L.salutation) out.push(L.salutation, '');
  for (const p of paragraphs(L.body)) out.push(p, '');
  if (L.closing) out.push(L.closing.replace(/\s*\n\s*/g, ' '), '');
  const name = [cv.identity.firstName, cv.identity.lastName].filter(Boolean).join(' ');
  if (name) out.push(name);
  const contact = [cv.identity.phone, cv.identity.email].filter(Boolean).join(' · ');
  if (contact) out.push(contact);
  out.push('', placeAndDate(cv, today));
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

