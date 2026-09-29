// Moteur de rendu : données du CV + modèle → HTML (chaîne). Sans DOM : testable sous Node.
// Le résultat est un <article class="cv …"> dont l'ordre HTML suit l'ordre de lecture visuel.

import { TEMPLATES, getTemplate } from './templates/index.js';
import { cloneCV, LIST_SECTIONS, MAX_FIT } from './model.js';

export { TEMPLATES, getTemplate };

/** Langue effective du CV pour un modèle (un modèle peut imposer l'anglais). */
export function effectiveLang(cv, template) {
  return template.lang || cv.meta.lang || 'fr';
}

/** Format de papier effectif (le résumé US impose le format Letter). */
export function effectivePaper(cv, template) {
  return template.forceFormat ? template.format : cv.meta.paper || 'A4';
}

/**
 * Prépare la « vue » : applique le mode anonyme, masque les champs sensibles non choisis
 * ou interdits par le modèle, calcule l'ordre des rubriques.
 */
export function buildView(cv, template, opts = {}) {
  const anonymous = opts.anonymous ?? cv.meta.anonymous;
  const lang = effectiveLang(cv, template);
  const data = cloneCV(cv);
  // Éléments masqués par l'utilisateur (« versions ciblées ») : conservés dans les données, absents du CV.
  for (const s of LIST_SECTIONS) if (Array.isArray(data[s])) data[s] = data[s].filter((it) => !it.hidden);
  data.custom = (data.custom || []).map((c) => ({ ...c, items: c.items.filter((it) => !it.hidden) }));
  const customKeys = data.custom.map((c) => `custom:${c.id}`);
  const p = data.privacy || {};
  const personalAllowed = !template.noPersonal && !anonymous;
  const show = {
    birthDate: personalAllowed && p.showBirthDate,
    birthPlace: personalAllowed && p.showBirthPlace,
    nationality: personalAllowed && p.showNationality,
    maritalStatus: personalAllowed && p.showMaritalStatus,
    drivingLicence: !template.noPersonal && p.showDrivingLicence,
  };
  const photo = template.photo && !anonymous && p.showPhoto && data.identity.photo ? data.identity.photo : '';
  if (anonymous) {
    // CV anonyme : nom, photo, adresse, âge, situation familiale, nationalité et références masqués.
    data.identity = {
      ...data.identity, firstName: '', lastName: '', email: '', phone: '', phone2: '', address: '', linkedin: '', website: '', photo: '', birthDate: '', birthPlace: '', nationality: '', maritalStatus: '',
    };
    data.references = [];
    if (cv.references.length) data.referencesOnRequest = true;
  }
  const exclude = template.excludeSections || [];
  const order = (data.meta.sectionOrder || LIST_SECTIONS).filter((k) => (LIST_SECTIONS.includes(k) || customKeys.includes(k)) && !exclude.includes(k));
  return {
    cv: data,
    template,
    identity: data.identity,
    lang,
    paper: effectivePaper(cv, template),
    dateStyle: template.dateStyle || data.meta.dateStyle || 'numeric',
    labels: template.labels ? template.labels[lang] : null,
    targetTitle: data.targetTitle,
    summary: data.summary,
    anonymous: Boolean(anonymous),
    today: opts.today instanceof Date ? opts.today : new Date(),
    show,
    photo,
    order,
  };
}

/** Palette effective : celle choisie si le modèle la propose, sinon la première (couleurs d'origine). */
export function effectivePalette(cv, template) {
  const list = template.palettes || [];
  return list.find((p) => p.id === cv.meta.palette) || list[0] || null;
}

/**
 * Variables CSS de thème à appliquer sur l'article (palette choisie + couleur d'accent libre).
 * Renvoie {} pour la palette d'origine : les couleurs viennent alors de templates.css.
 * Appliquées par le CSSOM (element.style.setProperty), jamais par un attribut style="" (CSP).
 */
export function themeVars(cv, template) {
  const vars = {};
  const list = template.palettes || [];
  const pal = effectivePalette(cv, template);
  if (pal && pal !== list[0]) {
    vars['--accent'] = pal.accent;
    vars['--accent-2'] = pal.accent;
    vars['--soft'] = pal.soft;
    vars['--deep'] = pal.deep;
    if (template.sideStyle === 'dark') {
      vars['--side-bg'] = pal.accent;
      vars['--side-ink'] = '#ffffff';
    } else if (template.sideStyle === 'light') {
      vars['--side-bg'] = pal.soft;
      vars['--side-ink'] = pal.deep;
    }
  }
  if (cv.meta.accent) {
    vars['--accent'] = cv.meta.accent;
    vars['--accent-2'] = cv.meta.accent;
    if (template.sideStyle === 'dark') vars['--side-bg'] = cv.meta.accent;
  }
  return vars;
}

/** Applique le thème à un article déjà inséré dans la page (navigateur uniquement). */
export function applyTheme(article, cv, template = getTemplate(cv.meta.templateId)) {
  if (!article || !article.style) return;
  for (const [k, v] of Object.entries(themeVars(cv, template))) article.style.setProperty(k, v);
}

/**
 * Rendu complet d'un CV. Renvoie une chaîne HTML (un seul élément <article>).
 * opts : { anonymous?: boolean, extraClass?: string, fit?: number (0 à MAX_FIT) }
 */
export function renderCV(cv, templateId, opts = {}) {
  const template = typeof templateId === 'object' && templateId ? templateId : getTemplate(templateId || cv.meta.templateId);
  const view = buildView(cv, template, opts);
  const classes = ['cv', `tpl-${template.id}`, `fam-${template.family}`, `paper-${view.paper.toLowerCase()}`, `cols-${template.columns}`];
  if (template.layoutClass) classes.push(template.layoutClass);
  if (view.photo) classes.push('has-photo');
  if (view.anonymous) classes.push('is-anonymous');
  const fit = Math.min(MAX_FIT, Math.max(0, Number(opts.fit ?? cv.meta.fit) || 0));
  if (fit) classes.push(`fit-${fit}`);
  if (opts.extraClass) classes.push(opts.extraClass);
  return `<article class="${classes.join(' ')}" lang="${view.lang}" data-template="${template.id}" data-paper="${view.paper}">${template.render(view)}</article>`;
}
