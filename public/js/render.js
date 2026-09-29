// Moteur de rendu : données du CV + modèle → HTML (chaîne). Sans DOM : testable sous Node.
// Le résultat est un <article class="cv …"> dont l'ordre HTML suit l'ordre de lecture visuel.

import { TEMPLATES, getTemplate } from './templates/index.js';
import { cloneCV, LIST_SECTIONS } from './model.js';

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
  const p = data.privacy || {};
  const personalAllowed = !template.noPersonal && !anonymous;
  const show = {
    birthDate: personalAllowed && p.showBirthDate,
    nationality: personalAllowed && p.showNationality,
    maritalStatus: personalAllowed && p.showMaritalStatus,
    drivingLicence: !template.noPersonal && p.showDrivingLicence,
  };
  const photo = template.photo && !anonymous && p.showPhoto && data.identity.photo ? data.identity.photo : '';
  if (anonymous) {
    // CV anonyme : nom, photo, adresse, âge, situation familiale, nationalité et références masqués.
    data.identity = { ...data.identity, firstName: '', lastName: '', email: '', phone: '', address: '', linkedin: '', website: '', photo: '', birthDate: '', nationality: '', maritalStatus: '' };
    data.references = [];
    if (cv.references.length) data.referencesOnRequest = true;
  }
  const exclude = template.excludeSections || [];
  const order = (data.meta.sectionOrder || LIST_SECTIONS).filter((k) => LIST_SECTIONS.includes(k) && !exclude.includes(k));
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
    show,
    photo,
    order,
  };
}

/**
 * Rendu complet d'un CV. Renvoie une chaîne HTML (un seul élément <article>).
 * opts : { anonymous?: boolean, extraClass?: string }
 */
export function renderCV(cv, templateId, opts = {}) {
  const template = typeof templateId === 'object' && templateId ? templateId : getTemplate(templateId || cv.meta.templateId);
  const view = buildView(cv, template, opts);
  const classes = ['cv', `tpl-${template.id}`, `fam-${template.family}`, `paper-${view.paper.toLowerCase()}`, `cols-${template.columns}`];
  if (view.photo) classes.push('has-photo');
  if (view.anonymous) classes.push('is-anonymous');
  if (opts.extraClass) classes.push(opts.extraClass);
  return `<article class="${classes.join(' ')}" lang="${view.lang}" data-template="${template.id}" data-paper="${view.paper}">${template.render(view)}</article>`;
}
