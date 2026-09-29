// Éditeur de CV : formulaires par rubrique, aperçu en direct, contrôle de conformité,
// galerie de modèles, sauvegarde automatique, export PDF (impression) et JSON.

import {
  createEmptyCV, createSampleCV, createSampleCVEnglish, createSampleJunior, createItem, cloneCV, getByPath, setByPath, moveItem,
  normalizeDate, normalizeCV, ITEM_FIELDS, IDENTITY_FIELDS, SENSITIVE_IDENTITY_FIELDS, CEFR_LEVELS, MAX_FIT, LETTER_FIELDS,
  CUSTOM_ITEM_FIELDS, CUSTOM_TITLES, MAX_CUSTOM_SECTIONS, createCustomSection, createCustomItem, customKey, findCustom,
} from './model.js';
import { cvToDocx, letterToDocx, DOCX_MIME } from './docx.js';
import { paginate, drawPageGaps } from './paginate.js';
import { readZipAsync } from './zip.js';
import { fromLinkedIn } from './linkedin.js';
import {
  STATUSES, CHANNELS, createApplicationStore, createApplication, normalizeApplication, setStatus as setAppStatus,
  dueFollowUps, sortApplications, stats as appStats, toCSV, addDays, FOLLOW_UP_DAYS,
} from './applications.js';
import { toJSONResume } from './jsonresume.js';
import { createStore, exportJSON, importJSON, createAutosaver, QuotaError, defaultStorage } from './storage.js';
import { renderCV, TEMPLATES, getTemplate, effectivePaper, applyTheme, effectivePalette } from './render.js';
import { checkCV, applyFix } from './norms.js';
import { matchOffer } from './match.js';
import { registerServiceWorker, setupInstallButton } from './pwa.js';
import { levelLabel } from './i18n.js';
import { esc } from './templates/parts.js';
import { SCHOOLS, CITIES, LANGUAGES, DIPLOMAS, DOSSIER_ITEMS, isNationalLanguage } from './senegal.js';
import { JOBS, getJob } from './phrases.js';
import { cvPlainText } from './plaintext.js';
import {
  renderLetter, checkLetter, draftLetter, letterText, wordCount, salutationFor, closingFor,
} from './letter.js';

const $ = (sel, root = document) => root.querySelector(sel);

/** Libellés de l'éditeur (toujours en français), par rubrique. */
const SECTION_UI = {
  experiences: { title: 'Expérience professionnelle', item: 'Expérience', add: 'Ajouter une expérience', itemTitle: (it) => [it.position, it.employer].filter(Boolean).join(' — ') },
  education: { title: 'Formation', item: 'Formation', add: 'Ajouter une formation', itemTitle: (it) => [it.degree, it.school].filter(Boolean).join(' — ') },
  skills: { title: 'Compétences', item: 'Groupe de compétences', add: 'Ajouter un groupe de compétences', itemTitle: (it) => it.name },
  languages: { title: 'Langues', item: 'Langue', add: 'Ajouter une langue', itemTitle: (it) => it.name },
  certifications: { title: 'Certifications', item: 'Certification', add: 'Ajouter une certification', itemTitle: (it) => it.name },
  awards: { title: 'Distinctions', item: 'Distinction', add: 'Ajouter une distinction', itemTitle: (it) => it.name },
  publications: { title: 'Publications', item: 'Publication', add: 'Ajouter une publication', itemTitle: (it) => it.title },
  projects: { title: 'Projets', item: 'Projet', add: 'Ajouter un projet', itemTitle: (it) => it.name },
  volunteering: { title: 'Bénévolat', item: 'Engagement', add: 'Ajouter un engagement bénévole', itemTitle: (it) => [it.role, it.organization].filter(Boolean).join(' — ') },
  interests: { title: 'Centres d\'intérêt', item: 'Centre d\'intérêt', add: 'Ajouter un centre d\'intérêt', itemTitle: (it) => it.name },
  references: { title: 'Références', item: 'Référence', add: 'Ajouter une référence', itemTitle: (it) => it.name },
};

const SECTION_HINTS = {
  experiences: 'Du plus récent au plus ancien. Une ligne par réalisation : verbe d\'action + résultat chiffré.',
  education: 'Du plus récent au plus ancien. Indiquez le diplôme exact et l\'établissement.',
  skills: 'Regroupez par catégorie ; reprenez les mots-clés de l\'offre (les logiciels de tri les recherchent).',
  languages: 'Niveau selon le CECRL (A1 à C2) — pas d\'étoiles ni de barres.',
  interests: 'Soyez précis : « Basket en club depuis 8 ans » plutôt que « Sport ».',
  awards: 'Prix, bourses, concours, mentions : indiquez l\'organisme et l\'année.',
  publications: 'Surtout pour un CV académique : articles, communications, ouvrages, du plus récent au plus ancien.',
  references: 'Demandez l\'accord de la personne avant de la citer.',
};

const store = createStore();
const appStore = createApplicationStore(defaultStorage());
const state = {
  cv: null, pages: 1, galleryFilter: 'Tous', openSections: new Set(['identity', 'headline']),
  doc: 'cv', helperJob: '', helperTarget: 0,
};
let renderTimer = null;

const autosaver = createAutosaver((cv) => {
  try {
    store.save(cv);
    setStatus('Enregistré dans ce navigateur');
    renderPicker();
  } catch (e) {
    setStatus(e instanceof QuotaError ? e.message : 'Échec de l\'enregistrement local.');
  }
}, 500);

function setStatus(msg) {
  $('#save-status').textContent = msg;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3500);
}

// ————————————————————————— Formulaires —————————————————————————

const fieldId = (path) => `f-${path.replace(/\./g, '-')}`;

function fieldHTML(path, f, value, extra = '') {
  const id = fieldId(path);
  const req = f.required ? ' aria-required="true"' : '';
  const label = `<label for="${id}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>`;
  switch (f.type) {
    case 'checkbox':
      return `<div class="field field-check"><input type="checkbox" id="${id}" data-path="${path}"${value ? ' checked' : ''}>${label}</div>`;
    case 'textarea':
      return `<div class="field field-wide">${label}<textarea id="${id}" data-path="${path}" rows="4"${req}>${esc(value)}</textarea></div>`;
    case 'select':
      return `<div class="field">${label}<select id="${id}" data-path="${path}"${req}>${f.options
        .map((o) => `<option value="${o}"${o === value ? ' selected' : ''}>${esc(f.optionLabels ? f.optionLabels[o] : o ? levelLabel('fr', o) : '— Choisir —')}</option>`)
        .join('')}</select></div>`;
    case 'list':
      return `<div class="field field-wide">${label}<input type="text" id="${id}" data-path="${path}" data-type="list" value="${esc((value || []).join(', '))}"></div>`;
    case 'month':
      return `<div class="field">${label}<input type="month" id="${id}" data-path="${path}" data-type="month" placeholder="AAAA-MM" value="${esc(value)}"${req}${extra}></div>`;
    default: {
      const ac = f.autocomplete ? ` autocomplete="${f.autocomplete}"` : '';
      const dl = datalistFor(path);
      return `<div class="field">${label}<input type="${f.type}" id="${id}" data-path="${path}" value="${esc(value)}"${ac}${dl ? ` list="${dl}"` : ''}${req}${extra}></div>`;
    }
  }
}

/** Suggestions de saisie (référentiel sénégalais, hors ligne) selon le champ. */
function datalistFor(path) {
  if (/(^|\.)city$/.test(path) || path === 'letter.place') return 'dl-cities';
  if (/^education\.\d+\.school$/.test(path)) return 'dl-schools';
  if (/^education\.\d+\.degree$/.test(path)) return 'dl-diplomas';
  if (/^languages\.\d+\.name$/.test(path)) return 'dl-languages';
  return '';
}

function renderDatalists() {
  const dl = (id, values) => `<datalist id="${id}">${values.map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  $('#datalists').innerHTML = dl('dl-cities', CITIES) + dl('dl-schools', SCHOOLS) + dl('dl-languages', LANGUAGES)
    + dl('dl-diplomas', DIPLOMAS.map((d) => d.label)) + dl('dl-custom-titles', CUSTOM_TITLES);
}

function detailsOpen(key) {
  return state.openSections.has(key) ? ' open' : '';
}

function identityHTML(cv) {
  const id = cv.identity;
  const p = cv.privacy;
  const tpl = getTemplate(cv.meta.templateId);
  const photoNote = tpl.photo ? '' : '<p class="hint">Le modèle actuel n\'affiche pas de photo.</p>';
  return `<details class="ed-section" data-section="identity"${detailsOpen('identity')}>
    <summary><h2>Identité et coordonnées</h2></summary>
    <div class="ed-body">
      <div class="grid">${IDENTITY_FIELDS.map((f) => fieldHTML(`identity.${f.key}`, f, id[f.key])).join('')}</div>
      <details class="sensitive" data-section="privacy"${detailsOpen('privacy')}>
        <summary>Photo et informations personnelles facultatives</summary>
        <div class="ed-body">
          <p class="hint">Photo, âge, situation familiale et nationalité ne sont <strong>jamais exigibles</strong> : la loi interdit
          de discriminer sur ces critères. Ils sont masqués par défaut ; ne les affichez que si c'est l'usage dans le pays visé.
          Les modèles anglo-saxons (US, UK) ne les affichent jamais.</p>
          <div class="grid">
            <div class="field field-wide">
              <span class="label" id="photo-label">Photo</span>
              <div class="photo-row">
                ${id.photo ? `<img class="photo-thumb" src="${esc(id.photo)}" alt="Photo actuelle">` : '<span class="hint">Aucune photo</span>'}
                <label class="btn btn-small" for="photo-input">Choisir une photo</label>
                <input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp" class="sr-only" aria-describedby="photo-label">
                ${id.photo ? '<button type="button" class="btn btn-small" data-act="photo-remove">Retirer la photo</button>' : ''}
              </div>
              <div class="field-check"><input type="checkbox" id="f-privacy-showPhoto" data-path="privacy.showPhoto"${p.showPhoto ? ' checked' : ''}><label for="f-privacy-showPhoto">Afficher la photo sur le CV</label></div>
              ${photoNote}
            </div>
            ${SENSITIVE_IDENTITY_FIELDS.map((f) => {
              const showKey = `show${f.key[0].toUpperCase()}${f.key.slice(1)}`;
              return `<div class="field-pair">${fieldHTML(`identity.${f.key}`, f, id[f.key])}<div class="field-check"><input type="checkbox" id="f-privacy-${showKey}" data-path="privacy.${showKey}"${
                p[showKey] ? ' checked' : ''
              }><label for="f-privacy-${showKey}">Afficher sur le CV</label></div></div>`;
            }).join('')}
          </div>
        </div>
      </details>
    </div>
  </details>`;
}

function headlineHTML(cv) {
  return `<details class="ed-section" data-section="headline"${detailsOpen('headline')}>
    <summary><h2>Titre visé et accroche</h2></summary>
    <div class="ed-body">
      ${fieldHTML('targetTitle', { label: 'Titre du poste visé (ex. : Comptable confirmé)', type: 'text' }, cv.targetTitle)}
      <div class="field field-wide">
        <label for="f-summary">Accroche : 2 à 4 lignes, style nominal (qui vous êtes, ce que vous apportez, ce que vous visez)</label>
        <textarea id="f-summary" data-path="summary" rows="4" aria-describedby="summary-count">${esc(cv.summary)}</textarea>
        <p class="hint" id="summary-count">${cv.summary.length} / 500 caractères</p>
      </div>
    </div>
  </details>`;
}

function listSectionHTML(cv, key, index, total) {
  const ui = SECTION_UI[key];
  const items = cv[key];
  const itemsHTML = items
    .map((it, i) => {
      const base = `${key}.${i}`;
      const t = ui.itemTitle(it);
      const fields = ITEM_FIELDS[key]
        .map((f) => fieldHTML(`${base}.${f.key}`, f, it[f.key], f.key === 'end' && it.current ? ' disabled' : ''))
        .join('');
      const oralHint = key === 'languages' && isNationalLanguage(it.name) && !it.mode
        ? '<p class="hint">Langue nationale : si vous la parlez sans l\'écrire couramment, choisissez « À l\'oral uniquement ».</p>' : '';
      return `<li><fieldset class="ed-item${it.hidden ? ' is-hidden' : ''}" data-item="${base}">
        <legend>${esc(ui.item)} ${i + 1}${t ? ` : ${esc(t)}` : ''}${it.hidden ? ' <span class="hidden-label">(masqué sur le CV)</span>' : ''}</legend>
        <div class="grid">${fields}</div>${oralHint}
        <div class="item-actions">
          <button type="button" class="btn btn-small" data-act="item-hide" data-section="${key}" data-index="${i}" aria-pressed="${it.hidden}" aria-label="Masquer ${esc(ui.item.toLowerCase())} ${i + 1} sur le CV (sans la supprimer)">${it.hidden ? 'Afficher sur le CV' : 'Masquer du CV'}</button>
          <button type="button" class="btn btn-small" data-act="item-up" data-section="${key}" data-index="${i}"${i === 0 ? ' disabled' : ''} aria-label="Monter ${esc(ui.item.toLowerCase())} ${i + 1}">Monter</button>
          <button type="button" class="btn btn-small" data-act="item-down" data-section="${key}" data-index="${i}"${i === items.length - 1 ? ' disabled' : ''} aria-label="Descendre ${esc(ui.item.toLowerCase())} ${i + 1}">Descendre</button>
          <button type="button" class="btn btn-small btn-danger" data-act="item-remove" data-section="${key}" data-index="${i}" aria-label="Supprimer ${esc(ui.item.toLowerCase())} ${i + 1}">Supprimer</button>
        </div>
      </fieldset></li>`;
    })
    .join('');
  const extra = key === 'references'
    ? `<div class="field-check"><input type="checkbox" id="f-referencesOnRequest" data-path="referencesOnRequest"${cv.referencesOnRequest ? ' checked' : ''}><label for="f-referencesOnRequest">Afficher « Références disponibles sur demande » si la liste est vide</label></div>`
    : '';
  return `<details class="ed-section" data-section="${key}"${detailsOpen(key)}>
    <summary><h2>${esc(ui.title)} <span class="count">(${items.length}${items.some((it) => it.hidden) ? `, dont ${items.filter((it) => it.hidden).length} masqué${items.filter((it) => it.hidden).length > 1 ? 's' : ''}` : ''})</span></h2></summary>
    <div class="ed-body">
      ${SECTION_HINTS[key] ? `<p class="hint">${esc(SECTION_HINTS[key])}</p>` : ''}
      <div class="section-actions">
        <span class="hint">Position de la rubrique dans le CV :</span>
        <button type="button" class="btn btn-small" data-act="section-up" data-section="${key}"${index === 0 ? ' disabled' : ''} aria-label="Monter la rubrique ${esc(ui.title)}">Monter</button>
        <button type="button" class="btn btn-small" data-act="section-down" data-section="${key}"${index === total - 1 ? ' disabled' : ''} aria-label="Descendre la rubrique ${esc(ui.title)}">Descendre</button>
        ${['experiences', 'education', 'volunteering'].includes(key) && items.length > 1 ? `<button type="button" class="btn btn-small" data-act="sort" data-section="${key}">Trier du plus récent au plus ancien</button>` : ''}
      </div>
      ${key === 'experiences' ? helperHTML(cv) : ''}
      <ol class="items">${itemsHTML}</ol>
      ${extra}
      <button type="button" class="btn btn-add" data-act="item-add" data-section="${key}">+ ${esc(ui.add)}</button>
    </div>
  </details>`;
}

/** Aide à la rédaction par métier : exemples de lignes, compétences et accroche types. */
function helperHTML(cv) {
  const job = getJob(state.helperJob);
  const options = JOBS.map((j) => `<option value="${j.id}"${j.id === state.helperJob ? ' selected' : ''}>${esc(j.name)}</option>`).join('');
  let body = '';
  if (job) {
    const target = Math.min(state.helperTarget, Math.max(0, cv.experiences.length - 1));
    const targets = cv.experiences.length
      ? `<div class="field"><label for="helper-target">Ajouter les lignes à</label><select id="helper-target" data-helper="target">${cv.experiences
        .map((e, i) => `<option value="${i}"${i === target ? ' selected' : ''}>Expérience ${i + 1}${e.position ? ` : ${esc(e.position)}` : ''}</option>`).join('')}</select></div>`
      : '<p class="hint">Aucune expérience : la première ligne ajoutée en créera une.</p>';
    body = `${targets}
      <ul class="helper-lines">${job.lines.map((l, i) => `<li><span>${esc(l)}</span><button type="button" class="btn btn-small" data-act="helper-line" data-line="${i}" aria-label="Ajouter la ligne : ${esc(l)}">Ajouter</button></li>`).join('')}</ul>
      <p class="hint">Remplacez les passages entre crochets [ … ] par vos chiffres réels : un exemple non personnalisé se remarque.</p>
      <div class="helper-actions">
        <button type="button" class="btn btn-small" data-act="helper-skills">Ajouter les compétences types (${esc(job.skills.keywords.slice(0, 3).join(', '))}…)</button>
        <button type="button" class="btn btn-small" data-act="helper-summary">Proposer l'accroche type</button>
      </div>`;
  }
  return `<details class="helper" data-section="helper"${detailsOpen('helper')}>
    <summary>Aide à la rédaction par métier (exemples, sans connexion)</summary>
    <div class="helper-body">
      <div class="field"><label for="helper-job">Votre métier</label><select id="helper-job" data-helper="job"><option value="">— Choisir un métier —</option>${options}</select></div>
      ${body}
    </div>
  </details>`;
}

/** Dossier de concours de la fonction publique sénégalaise (liste de pièces à cocher). */
function dossierHTML(cv) {
  const done = new Set(cv.meta.dossier);
  return `<details class="ed-section" data-section="dossier"${detailsOpen('dossier')}>
    <summary><h2>Dossier de concours <span class="count">(${DOSSIER_ITEMS.filter((d) => done.has(d.id)).length} / ${DOSSIER_ITEMS.length})</span></h2></summary>
    <div class="ed-body">
      <p class="hint">Pièces habituellement demandées pour un concours ou un recrutement dans l'administration sénégalaise.
        <strong>L'avis de concours fait foi</strong> : vérifiez la liste exacte, les délais et le lieu de dépôt. Cochez ce qui est prêt.</p>
      <ul class="dossier-list">${DOSSIER_ITEMS.map((d) => `<li class="field-check"><input type="checkbox" id="dossier-${d.id}" data-dossier="${d.id}"${done.has(d.id) ? ' checked' : ''}><label for="dossier-${d.id}">${esc(d.label)}</label></li>`).join('')}</ul>
      <p class="hint">La demande manuscrite peut être préparée avec l'onglet « Lettre de motivation », style « Administratif (Sénégal) ».</p>
    </div>
  </details>`;
}

const LETTER_KINDS_UI = [
  { id: 'candidature', name: 'Candidature (lettre de motivation / demande d\'emploi)', desc: 'Réponse à une offre ou candidature spontanée : 250 à 400 mots, une page.' },
  { id: 'stage', name: 'Demande de stage', desc: 'Précisez la durée, la date de début et la convention de stage de votre établissement.' },
  { id: 'relance', name: 'Relance après candidature', desc: 'Une à deux semaines après l\'envoi, sans réponse : courte (80 à 180 mots), polie, rappelle votre atout principal.' },
  { id: 'remerciement', name: 'Remerciement après entretien', desc: 'Dans les 24 à 48 heures après l\'entretien : courte, rappelle un point précis de l\'échange.' },
];

const LETTER_STYLES_UI = [
  { id: 'standard', name: 'Standard', desc: 'Lettre de motivation « à la française » : entreprises, ONG, candidatures en ligne.' },
  { id: 'administratif', name: 'Administratif (Sénégal)', desc: '« À Monsieur le Directeur… », objet, formule de haute considération : administrations, sociétés nationales, demande d\'emploi.' },
  { id: 'en', name: 'Anglais (cover letter)', desc: 'Pour une candidature en anglais (organisations internationales, étranger).' },
];

function letterEditorHTML(cv) {
  const L = cv.letter;
  const f = (key) => LETTER_FIELDS.find((x) => x.key === key);
  const field = (key, extra = {}) => fieldHTML(`letter.${key}`, { ...f(key), ...extra }, L[key]);
  return `<section class="ed-section letter-editor" aria-labelledby="letter-title">
    <h2 id="letter-title" class="letter-h">Lettre de motivation</h2>
    <div class="ed-body">
      <p class="hint">La lettre reprend l'en-tête, les polices et les couleurs de votre modèle de CV (${esc(getTemplate(cv.meta.templateId).name)}).
        Une lettre = une candidature : adaptez-la à chaque employeur.</p>
      <div class="field">
        <label for="f-letter-kind">Type de lettre</label>
        <select id="f-letter-kind" data-path="letter.kind">${LETTER_KINDS_UI.map((k) => `<option value="${k.id}"${L.kind === k.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
        <p class="hint">${esc((LETTER_KINDS_UI.find((k) => k.id === L.kind) || LETTER_KINDS_UI[0]).desc)}</p>
      </div>
      <fieldset class="letter-style">
        <legend>Style de lettre</legend>
        ${LETTER_STYLES_UI.map((st) => `<div class="field-check radio"><input type="radio" name="letter-style" id="letter-style-${st.id}" value="${st.id}" data-path="letter.style"${L.style === st.id ? ' checked' : ''} aria-describedby="letter-style-${st.id}-d"><label for="letter-style-${st.id}"><strong>${esc(st.name)}</strong></label><span class="hint" id="letter-style-${st.id}-d">${esc(st.desc)}</span></div>`).join('')}
      </fieldset>
      <h3 class="letter-sub">Destinataire</h3>
      <div class="grid">${['organization', 'recipientTitle', 'recipientName', 'recipientAddress', 'place', 'date'].map((k) => field(k)).join('')}</div>
      <div class="letter-draft">
        <button type="button" class="btn btn-primary" data-act="letter-draft">Proposer un brouillon à partir de mon CV</button>
        <p class="hint">Structure « vous / moi / nous » construite avec votre poste visé, votre dernière expérience et les mots-clés de l'offre collée à droite. Complétez les passages entre crochets.</p>
      </div>
      <div class="grid">${field('subject', { type: 'text' })}${field('reference')}${field('salutation')}</div>
      <div class="field field-wide">
        <label for="f-letter-body">${esc(f('body').label)}</label>
        <textarea id="f-letter-body" data-path="letter.body" rows="16" aria-describedby="letter-count">${esc(L.body)}</textarea>
        <p class="hint" id="letter-count">${wordCount(L.body)} mots (idéal : 250 à 400)</p>
      </div>
      <div class="grid">${field('closing')}${field('enclosures')}</div>
    </div>
  </section>`;
}

function renderEditor() {
  const cv = state.cv;
  if (state.doc === 'letter') {
    $('#sections').innerHTML = letterEditorHTML(cv);
    return;
  }
  const order = cv.meta.sectionOrder;
  const dossier = cv.meta.country === 'SNFP' ? dossierHTML(cv) : '';
  $('#sections').innerHTML = identityHTML(cv) + headlineHTML(cv) + dossier
    + order.map((k, i) => (k.startsWith('custom:') ? customSectionHTML(cv, k, i, order.length) : listSectionHTML(cv, k, i, order.length))).join('')
    + addCustomHTML(cv);
}

/** Rubrique personnalisée : titre standard + éléments libres (intitulé, organisme, dates, détails). */
function customSectionHTML(cv, key, index, total) {
  const cs = findCustom(cv, key);
  if (!cs) return '';
  const ci = cv.custom.indexOf(cs);
  const base = `custom.${ci}`;
  const items = cs.items.map((it, ii) => {
    const ip = `${base}.items.${ii}`;
    const fields = CUSTOM_ITEM_FIELDS.map((f) => fieldHTML(`${ip}.${f.key}`, f, it[f.key], f.key === 'end' && it.current ? ' disabled' : '')).join('');
    const label = `élément ${ii + 1}`;
    return `<li><fieldset class="ed-item${it.hidden ? ' is-hidden' : ''}" data-item="${ip}">
      <legend>Élément ${ii + 1}${it.title ? ` : ${esc(it.title)}` : ''}${it.hidden ? ' <span class="hidden-label">(masqué sur le CV)</span>' : ''}</legend>
      <div class="grid">${fields}</div>
      <div class="item-actions">
        <button type="button" class="btn btn-small" data-act="citem-hide" data-custom="${ci}" data-index="${ii}" aria-pressed="${it.hidden}" aria-label="Masquer ${label} sur le CV">${it.hidden ? 'Afficher sur le CV' : 'Masquer du CV'}</button>
        <button type="button" class="btn btn-small" data-act="citem-up" data-custom="${ci}" data-index="${ii}"${ii === 0 ? ' disabled' : ''} aria-label="Monter ${label}">Monter</button>
        <button type="button" class="btn btn-small" data-act="citem-down" data-custom="${ci}" data-index="${ii}"${ii === cs.items.length - 1 ? ' disabled' : ''} aria-label="Descendre ${label}">Descendre</button>
        <button type="button" class="btn btn-small btn-danger" data-act="citem-remove" data-custom="${ci}" data-index="${ii}" aria-label="Supprimer ${label}">Supprimer</button>
      </div>
    </fieldset></li>`;
  }).join('');
  const name = cs.title || 'Rubrique personnalisée';
  return `<details class="ed-section" data-section="${esc(key)}"${detailsOpen(key)}>
    <summary><h2>${esc(name)} <span class="count">(${cs.items.length}) · personnalisée</span></h2></summary>
    <div class="ed-body">
      <div class="field field-wide">
        <label for="${fieldId(`${base}.title`)}">Titre de la rubrique (intitulé simple et standard)</label>
        <input type="text" id="${fieldId(`${base}.title`)}" data-path="${base}.title" value="${esc(cs.title)}" list="dl-custom-titles" aria-describedby="${fieldId(`${base}.title`)}-hint">
        <p class="hint" id="${fieldId(`${base}.title`)}-hint">Ex. : Stages, Vie associative, Formations complémentaires. Évitez les titres fantaisistes : les logiciels de tri ne les reconnaissent pas.</p>
      </div>
      <div class="section-actions">
        <span class="hint">Position de la rubrique dans le CV :</span>
        <button type="button" class="btn btn-small" data-act="section-up" data-section="${esc(key)}"${index === 0 ? ' disabled' : ''} aria-label="Monter la rubrique ${esc(name)}">Monter</button>
        <button type="button" class="btn btn-small" data-act="section-down" data-section="${esc(key)}"${index === total - 1 ? ' disabled' : ''} aria-label="Descendre la rubrique ${esc(name)}">Descendre</button>
        <button type="button" class="btn btn-small btn-danger" data-act="custom-remove" data-custom="${ci}">Supprimer la rubrique</button>
      </div>
      <ol class="items">${items}</ol>
      <button type="button" class="btn btn-add" data-act="citem-add" data-custom="${ci}">+ Ajouter un élément à « ${esc(name)} »</button>
    </div>
  </details>`;
}

function addCustomHTML(cv) {
  if (cv.custom.length >= MAX_CUSTOM_SECTIONS) return `<p class="hint">Nombre maximal de rubriques personnalisées atteint (${MAX_CUSTOM_SECTIONS}).</p>`;
  return `<div class="add-custom ed-section">
    <div class="ed-body">
      <h2 class="add-custom-h">Ajouter une rubrique personnalisée</h2>
      <p class="hint">Pour ce qui n'entre dans aucune rubrique standard : stages séparés, vie associative, mémoire, formations complémentaires…</p>
      <div class="inline">
        <label for="new-custom-title" class="sr-only">Titre de la nouvelle rubrique</label>
        <input type="text" id="new-custom-title" list="dl-custom-titles" placeholder="Ex. : Stages">
        <button type="button" class="btn" data-act="custom-add">Ajouter la rubrique</button>
      </div>
    </div>
  </div>`;
}

function renderDocSwitch() {
  document.querySelectorAll('.doc-switch button[data-doc]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.doc === state.doc)));
  $('#btn-print').textContent = state.doc === 'letter' ? 'Télécharger la lettre en PDF' : 'Télécharger en PDF';
  $('#btn-fit').hidden = state.doc === 'letter';
  $('#btn-docx').textContent = state.doc === 'letter' ? 'Lettre au format Word (.docx)' : 'CV au format Word (.docx)';
  if (state.doc === 'letter') $('#btn-fit-reset').hidden = true;
}

function renderSettings() {
  const { meta } = state.cv;
  $('#set-title').value = meta.title;
  $('#set-lang').value = meta.lang;
  $('#set-paper').value = meta.paper;
  $('#set-datestyle').value = meta.dateStyle;
  $('#set-accent').value = meta.accent || '#1f3a5f';
  $('#set-country').value = meta.country || '';
  const tpl = getTemplate(meta.templateId);
  const pal = effectivePalette(state.cv, tpl);
  $('#set-palette').innerHTML = (tpl.palettes || [])
    .map((p, i) => `<option value="${esc(p.id)}"${pal && p.id === pal.id ? ' selected' : ''}>${esc(p.name)}${i === 0 ? ' (d\'origine)' : ''}</option>`)
    .join('');
  $('#set-palette').disabled = !(tpl.palettes && tpl.palettes.length > 1);
  $('#btn-fit-reset').hidden = !meta.fit || state.doc === 'letter';
  const anon = $('#btn-anon');
  anon.setAttribute('aria-pressed', String(meta.anonymous));
  anon.textContent = meta.anonymous ? 'CV anonyme : activé' : 'CV anonyme';
}

function renderPicker() {
  const sel = $('#cv-select');
  const list = store.list();
  if (!list.some((e) => e.id === state.cv.id)) list.unshift({ id: state.cv.id, title: state.cv.meta.title });
  sel.innerHTML = list.map((e) => `<option value="${esc(e.id)}"${e.id === state.cv.id ? ' selected' : ''}>${esc(e.title || 'Sans titre')}</option>`).join('');
}

// ————————————————————————— Aperçu et conformité —————————————————————————


/** Applique la palette choisie et la couleur d'accent (CSSOM : autorisé par la CSP). */
function applyAccent(root) {
  root.querySelectorAll('.cv').forEach((article) => applyTheme(article, state.cv, getTemplate(article.dataset.template)));
}

function updatePreview() {
  const cv = state.cv;
  const tpl = getTemplate(cv.meta.templateId);
  const preview = $('#preview');
  if (state.doc === 'letter') {
    updateLetterPreview(cv, tpl, preview);
    return;
  }
  preview.innerHTML = renderCV(cv, tpl.id);
  applyAccent(preview);
  const article = preview.querySelector('.cv');
  const paper = effectivePaper(cv, tpl);
  const layout = paginate(article, paper);
  const { pages } = layout;
  state.pages = pages;
  drawPageGaps(preview, article, layout);
  fitPreview();
  const fitNote = cv.meta.fit ? ` · mise en page resserrée (${cv.meta.fit}/${MAX_FIT})` : '';
  $('#template-info').innerHTML = `Modèle : <strong>${esc(tpl.name)}</strong> · ${tpl.ats ? 'ATS' : 'créatif'} · ${paper} · ${pages} page${pages > 1 ? 's' : ''}${fitNote}`;
  renderNorms(checkCV(cv, tpl, { pages }));
  renderMatch();
}

function updateLetterPreview(cv, tpl, preview) {
  preview.innerHTML = renderLetter(cv, tpl.id);
  applyAccent(preview);
  const article = preview.querySelector('.cv');
  const paper = effectivePaper(cv, tpl);
  const layout = paginate(article, paper);
  const { pages } = layout;
  drawPageGaps(preview, article, layout);
  fitPreview();
  const words = wordCount(cv.letter.body);
  $('#template-info').innerHTML = `Lettre de motivation · modèle <strong>${esc(tpl.name)}</strong> · ${paper} · ${words} mots · ${pages} page${pages > 1 ? 's' : ''}`;
  renderNorms(checkLetter(cv, { pages }), 'letter');
  renderMatch();
}

function fitPreview() {
  const scroll = $('#preview-scroll');
  const stage = $('#preview-stage');
  const preview = $('#preview');
  const article = preview.querySelector('.cv');
  if (!article) return;
  const avail = scroll.clientWidth - 16;
  const scale = Math.min(1, avail / article.offsetWidth);
  preview.style.transform = `scale(${scale})`;
  stage.style.width = `${article.offsetWidth * scale}px`;
  stage.style.height = `${article.offsetHeight * scale}px`;
}

function schedulePreview() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(updatePreview, 120);
}

function renderNorms(result, kind = 'cv') {
  const { score, issues } = result;
  const level = score >= 85 ? 'good' : score >= 60 ? 'mid' : 'bad';
  const sevLabel = { error: 'Erreur', warning: 'À corriger', info: 'Conseil' };
  const counts = issues.reduce((acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] || 0) + 1 }), {});
  const summary = [counts.error && `${counts.error} erreur${counts.error > 1 ? 's' : ''}`, counts.warning && `${counts.warning} point${counts.warning > 1 ? 's' : ''} à corriger`, counts.info && `${counts.info} conseil${counts.info > 1 ? 's' : ''}`]
    .filter(Boolean)
    .join(', ');
  $('#norms').innerHTML = `<details class="norms-box norms-${level}" ${state.normsOpen === false ? '' : 'open'}>
    <summary><span class="score" aria-hidden="true">${score}</span><span class="norms-title"><span>${kind === 'letter' ? 'Qualité de la lettre' : 'Conformité aux normes'} : <strong>${score}/100</strong></span><span class="norms-sub">${
      summary || 'Aucun problème détecté'
    }</span></span></summary>
    ${issues.length ? `<ul class="issues" aria-label="${kind === 'letter' ? 'Points à améliorer dans la lettre' : 'Alertes de conformité du CV'}">${issues
      .map((is, i) => `<li class="issue sev-${is.severity}"><span class="sev">${sevLabel[is.severity]}</span>
        <button type="button" class="issue-link" data-issue="${i}">${esc(is.message)}</button>
        ${is.advice ? `<span class="issue-advice">${esc(is.advice)}</span>` : ''}
        ${is.fix ? `<button type="button" class="btn btn-small" data-fix="${esc(is.fix)}">${esc(is.fixLabel || 'Corriger')}</button>` : ''}</li>`)
      .join('')}</ul>` : `<p class="norms-ok">${kind === 'letter' ? 'Votre lettre respecte les règles vérifiées.' : 'Votre CV respecte les règles vérifiées.'}</p>`}
  </details>`;
  state.issues = issues;
}

/** Amène l'utilisateur au champ concerné par une alerte. */
function goTo(target) {
  if (!target) return;
  if (target === 'template') {
    openGallery();
    return;
  }
  const wantDoc = target.startsWith('letter.') ? 'letter' : 'cv';
  if (!target.startsWith('meta.') && wantDoc !== state.doc) switchDoc(wantDoc, { focus: false });
  if (target.startsWith('letter.')) {
    const el = document.querySelector(`[data-path="${CSS.escape(target)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
    return;
  }
  if (target.startsWith('meta.')) {
    const settings = document.querySelector('.editor > details');
    settings.open = true;
    const el = settings.querySelector(`[data-path="${CSS.escape(target)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
    return;
  }
  const first = target.split('.')[0];
  const customIndex = first === 'custom' ? Number(target.split('.')[1]) : -1;
  const sectionKey = customIndex >= 0 && state.cv.custom[customIndex] ? customKey(state.cv.custom[customIndex])
    : first === 'identity' ? 'identity' : first === 'privacy' ? 'privacy' : ['targetTitle', 'summary'].includes(first) ? 'headline' : first;
  state.openSections.add(sectionKey);
  if (sectionKey === 'privacy') state.openSections.add('identity');
  document.querySelectorAll('#sections details[data-section]').forEach((d) => {
    if (state.openSections.has(d.dataset.section)) d.open = true;
  });
  let el = document.querySelector(`[data-path="${CSS.escape(target)}"]`);
  if (!el) {
    const sec = document.querySelector(`#sections details[data-section="${CSS.escape(sectionKey)}"]`);
    el = sec && (sec.querySelector('input, textarea, select, button.btn-add') || sec.querySelector('summary'));
  }
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }
}

// ————————————————————————— Modifications —————————————————————————

function changed({ structural = false, immediate = structural } = {}) {
  state.cv.meta.updatedAt = new Date().toISOString();
  recordHistory(immediate);
  setStatus('Modifications en cours…');
  autosaver.schedule(state.cv);
  if (structural) {
    renderSettings();
    renderEditor();
  }
  schedulePreview();
}

function readValue(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.type === 'list') return el.value.split(',').map((s) => s.trim()).filter(Boolean);
  return el.value;
}

function onInput(e) {
  const el = e.target;
  const path = el.dataset && el.dataset.path;
  if (!path) return;
  let value = readValue(el);
  if (el.dataset.type === 'month' && e.type === 'change') {
    value = normalizeDate(value);
    if (value !== el.value) el.value = value;
  }
  if (el.type === 'radio' && !el.checked) return;
  const before = getByPath(state.cv, path);
  setByPath(state.cv, path, value);
  if (path === 'summary') $('#summary-count').textContent = `${value.length} / 500 caractères`;
  if (path === 'letter.body') $('#letter-count').textContent = `${wordCount(value)} mots (idéal : 250 à 400)`;
  if (path === 'letter.style' && before !== value) adaptLetterFormulas(before, value);
  if (path === 'letter.recipientTitle' && e.type === 'change') adaptSalutation(before);
  if (/\.current$/.test(path)) {
    const endPath = path.replace(/\.current$/, '.end');
    const end = document.querySelector(`[data-path="${endPath}"]`);
    if (end) {
      end.disabled = Boolean(value);
      if (value) {
        end.value = '';
        setByPath(state.cv, endPath, '');
      }
    }
  }
  const structural = path === 'meta.lang' || path === 'meta.palette' || (path.startsWith('privacy.') && e.type === 'change')
    || path === 'meta.country' || path === 'letter.style' || path === 'letter.kind';
  if (path === 'meta.palette' && state.cv.meta.accent) {
    // Choisir une palette annule la couleur libre, sinon elle masquerait la palette.
    state.cv.meta.accent = '';
  }
  // Frappe au clavier : regroupée dans l'historique ; listes, cases, sortie de champ : étape immédiate.
  changed({ structural: false, immediate: e.type === 'change' || el.tagName === 'SELECT' || ['checkbox', 'radio', 'color'].includes(el.type) });
  if (path === 'meta.title') renderPicker();
  if (structural) {
    renderSettings();
    if (path === 'meta.country' || path === 'letter.style' || path === 'letter.kind') {
      renderEditor();
      if (path.startsWith('letter.')) focusAfterRender(`#${CSS.escape(el.id)}`);
    }
  }
}

/** Changement de style de lettre : met à jour les formules restées « par défaut ». */
function adaptLetterFormulas(prevStyle, style) {
  const L = state.cv.letter;
  if (!L.salutation || L.salutation === salutationFor(L.recipientTitle, prevStyle) || L.salutation === 'Madame, Monsieur,' || L.salutation === 'Dear Hiring Manager,') {
    L.salutation = salutationFor(L.recipientTitle, style);
  }
  if (!L.closing || L.closing === closingFor(L.salutation, prevStyle) || /salutations distinguées|haute considération|Yours (faithfully|sincerely)/.test(L.closing)) {
    L.closing = L.body.trim() || L.closing ? closingFor(L.salutation, style) : '';
  }
}

/** Destinataire modifié : la formule d'appel (et la formule de politesse) suivent si elles n'ont pas été personnalisées. */
function adaptSalutation(prevTitle) {
  const L = state.cv.letter;
  const old = salutationFor(prevTitle, L.style);
  if (L.salutation && L.salutation !== old && L.salutation !== 'Madame, Monsieur,') return;
  const next = salutationFor(L.recipientTitle, L.style);
  if (next === L.salutation) return;
  if (L.closing === closingFor(L.salutation, L.style)) L.closing = closingFor(next, L.style);
  L.salutation = next;
  // Mise à jour des champs sans reconstruire le formulaire (le focus de l'utilisateur est préservé).
  const sal = $('#f-letter-salutation');
  const clo = $('#f-letter-closing');
  if (sal) sal.value = L.salutation;
  if (clo) clo.value = L.closing;
}

function focusAfterRender(selector) {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (el) el.focus();
  });
}

function onEditorClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const { act, section, index } = btn.dataset;
  const i = Number(index);
  const cv = state.cv;
  switch (act) {
    case 'item-add': {
      cv[section].push(createItem(section));
      state.openSections.add(section);
      changed({ structural: true });
      const n = cv[section].length - 1;
      focusAfterRender(`[data-item="${section}.${n}"] input, [data-item="${section}.${n}"] select`);
      toast(`${SECTION_UI[section].item} ajouté(e).`);
      break;
    }
    case 'item-remove': {
      const it = cv[section][i];
      const label = SECTION_UI[section].itemTitle(it) || `${SECTION_UI[section].item} ${i + 1}`;
      cv[section].splice(i, 1);
      changed({ structural: true });
      focusAfterRender(`button[data-act="item-add"][data-section="${section}"]`);
      toast(`« ${label} » supprimé(e).`);
      break;
    }
    case 'item-up':
    case 'item-down': {
      const d = act === 'item-up' ? -1 : 1;
      cv[section] = moveItem(cv[section], i, d);
      changed({ structural: true });
      focusAfterRender(`button[data-act="${act}"][data-section="${section}"][data-index="${i + d}"]:not([disabled]), [data-item="${section}.${i + d}"] legend`);
      break;
    }
    case 'section-up':
    case 'section-down': {
      const order = cv.meta.sectionOrder;
      const idx = order.indexOf(section);
      cv.meta.sectionOrder = moveItem(order, idx, act === 'section-up' ? -1 : 1);
      changed({ structural: true });
      focusAfterRender(`button[data-act="${act}"][data-section="${section}"]:not([disabled]), details[data-section="${section}"] summary`);
      break;
    }
    case 'sort':
      applyFix(cv, `sort:${section}`);
      changed({ structural: true });
      toast('Rubrique triée du plus récent au plus ancien.');
      break;
    case 'custom-add': {
      const title = $('#new-custom-title').value.trim();
      const cs = createCustomSection({ title, items: [createCustomItem()] });
      cv.custom.push(cs);
      cv.meta.sectionOrder.push(customKey(cs));
      state.openSections.add(customKey(cs));
      changed({ structural: true });
      const ci = cv.custom.length - 1;
      focusAfterRender(title ? `#${fieldId(`custom.${ci}.items.0.title`)}` : `#${fieldId(`custom.${ci}.title`)}`);
      toast(`Rubrique « ${title || 'sans titre'} » ajoutée en fin de CV : déplacez-la avec « Monter ».`);
      break;
    }
    case 'custom-remove': {
      const ci = Number(btn.dataset.custom);
      const cs = cv.custom[ci];
      // eslint-disable-next-line no-alert
      if (cs.items.length && !window.confirm(`Supprimer la rubrique « ${cs.title || 'sans titre'} » et ses ${cs.items.length} élément(s) ? (Annuler reste possible.)`)) break;
      cv.custom.splice(ci, 1);
      cv.meta.sectionOrder = cv.meta.sectionOrder.filter((k) => k !== customKey(cs));
      changed({ structural: true });
      focusAfterRender('#new-custom-title');
      toast(`Rubrique « ${cs.title || 'sans titre'} » supprimée.`);
      break;
    }
    case 'citem-add':
    case 'citem-remove':
    case 'citem-up':
    case 'citem-down':
    case 'citem-hide': {
      const ci = Number(btn.dataset.custom);
      const cs = cv.custom[ci];
      const key = customKey(cs);
      state.openSections.add(key);
      if (act === 'citem-add') {
        cs.items.push(createCustomItem());
        changed({ structural: true });
        focusAfterRender(`#${fieldId(`custom.${ci}.items.${cs.items.length - 1}.title`)}`);
      } else if (act === 'citem-remove') {
        cs.items.splice(i, 1);
        changed({ structural: true });
        focusAfterRender(`button[data-act="citem-add"][data-custom="${ci}"]`);
        toast('Élément supprimé.');
      } else if (act === 'citem-hide') {
        cs.items[i].hidden = !cs.items[i].hidden;
        changed({ structural: true });
        focusAfterRender(`button[data-act="citem-hide"][data-custom="${ci}"][data-index="${i}"]`);
      } else {
        const d = act === 'citem-up' ? -1 : 1;
        cs.items = moveItem(cs.items, i, d);
        changed({ structural: true });
        focusAfterRender(`button[data-act="${act}"][data-custom="${ci}"][data-index="${i + d}"]:not([disabled]), [data-item="custom.${ci}.items.${i + d}"] legend`);
      }
      break;
    }
    case 'item-hide': {
      const it = cv[section][i];
      it.hidden = !it.hidden;
      changed({ structural: true });
      focusAfterRender(`button[data-act="item-hide"][data-section="${section}"][data-index="${i}"]`);
      toast(it.hidden ? 'Élément masqué sur le CV (conservé dans vos données).' : 'Élément de nouveau affiché sur le CV.');
      break;
    }
    case 'helper-line': {
      const job = getJob(state.helperJob);
      if (!job) break;
      const line = job.lines[Number(btn.dataset.line)];
      if (!cv.experiences.length) cv.experiences.push(createItem('experiences'));
      const target = Math.min(state.helperTarget, cv.experiences.length - 1);
      const exp = cv.experiences[target];
      exp.description = exp.description.trim() ? `${exp.description.replace(/\s+$/, '')}\n${line}` : line;
      state.openSections.add('experiences');
      changed({ structural: true });
      focusAfterRender(`button[data-act="helper-line"][data-line="${btn.dataset.line}"]`);
      toast(`Ligne ajoutée à l'expérience ${target + 1} : complétez les passages entre crochets.`);
      break;
    }
    case 'helper-skills': {
      const job = getJob(state.helperJob);
      if (!job) break;
      const existing = cv.skills.find((g) => g.name.toLowerCase() === job.skills.name.toLowerCase());
      if (existing) {
        for (const k of job.skills.keywords) if (!existing.keywords.some((x) => x.toLowerCase() === k.toLowerCase())) existing.keywords.push(k);
      } else cv.skills.push(createItem('skills', { name: job.skills.name, keywords: job.skills.keywords }));
      state.openSections.add('skills');
      changed({ structural: true });
      focusAfterRender('button[data-act="helper-skills"]');
      toast(`Compétences « ${job.skills.name} » ajoutées : retirez celles que vous ne maîtrisez pas.`);
      break;
    }
    case 'helper-summary': {
      const job = getJob(state.helperJob);
      if (!job) break;
      // eslint-disable-next-line no-alert
      if (cv.summary.trim() && !window.confirm('Remplacer votre accroche actuelle par l\'accroche type ?')) break;
      cv.summary = job.summary;
      if (!cv.targetTitle.trim()) cv.targetTitle = job.name.split(/[/(]/)[0].trim();
      state.openSections.add('headline');
      changed({ structural: true });
      focusAfterRender('#f-summary');
      toast('Accroche type insérée : personnalisez-la (chiffres entre crochets).');
      break;
    }
    case 'letter-draft': {
      const L = cv.letter;
      // eslint-disable-next-line no-alert
      if (L.body.trim() && !window.confirm('Remplacer le texte actuel de la lettre par un nouveau brouillon ?')) break;
      if (!L.place) L.place = cv.identity.city;
      Object.assign(L, draftLetter(cv, L.style));
      changed({ structural: true });
      focusAfterRender('#f-letter-body');
      toast('Brouillon proposé : personnalisez les passages entre crochets [ … ].');
      break;
    }
    case 'photo-remove':
      cv.identity.photo = '';
      cv.privacy.showPhoto = false;
      changed({ structural: true });
      focusAfterRender('#photo-input');
      break;
    default:
  }
}

/** Réduit et recadre la photo (carré 400 px, JPEG) pour limiter la taille stockée. */
async function readPhoto(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Format non pris en charge : utilisez une image JPEG, PNG ou WebP.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(400, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function onEditorChange(e) {
  const { helper, dossier } = e.target.dataset || {};
  if (helper) {
    if (helper === 'job') {
      state.helperJob = e.target.value;
      state.helperTarget = 0;
      state.openSections.add('helper');
      renderEditor();
      focusAfterRender('#helper-job');
    } else state.helperTarget = Number(e.target.value) || 0;
    return;
  }
  if (dossier) {
    const set = new Set(state.cv.meta.dossier);
    if (e.target.checked) set.add(dossier);
    else set.delete(dossier);
    state.cv.meta.dossier = DOSSIER_ITEMS.map((d) => d.id).filter((id) => set.has(id));
    changed();
    const count = document.querySelector('details[data-section="dossier"] .count');
    if (count) count.textContent = `(${state.cv.meta.dossier.length} / ${DOSSIER_ITEMS.length})`;
    return;
  }
  if (e.target.id === 'photo-input') {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      state.cv.identity.photo = await readPhoto(file);
      state.cv.privacy.showPhoto = true;
      changed({ structural: true });
      toast('Photo ajoutée.');
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  onInput(e);
}

// ————————————————————————— Ajuster à N pages —————————————————————————

/**
 * Cherche le plus petit niveau de resserrement (espacements, puis police jusqu'à 9 pt) pour que
 * le CV tienne en `target` page(s). Mesure hors écran, avec le modèle et la palette réels.
 */
async function fitToPages(target = 1) {
  const cv = state.cv;
  const tpl = getTemplate(cv.meta.templateId);
  const paper = effectivePaper(cv, tpl);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const probe = document.createElement('div');
  probe.className = 'fit-probe';
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  let chosen = null;
  try {
    for (let level = 0; level <= MAX_FIT; level += 1) {
      probe.innerHTML = renderCV(cv, tpl.id, { fit: level });
      applyAccent(probe);
      if (paginate(probe.firstElementChild, paper).pages <= target) {
        chosen = level;
        break;
      }
    }
  } finally {
    probe.remove();
  }
  const label = target === 1 ? '1 page' : `${target} pages`;
  if (chosen === null) {
    cv.meta.fit = MAX_FIT;
    toast(`Même resserré au maximum (police 9 pt), le CV dépasse ${label} : raccourcissez les descriptions les plus anciennes.`);
  } else {
    cv.meta.fit = chosen;
    toast(chosen === 0 ? `Le CV tient déjà sur ${label} : taille normale conservée.` : `Mise en page resserrée (niveau ${chosen}/${MAX_FIT}) : le CV tient sur ${label}.`);
  }
  renderSettings();
  changed();
}

// ————————————————————————— Correspondance avec une offre —————————————————————————

function renderMatch() {
  const offer = state.cv.meta.jobOffer || '';
  const box = $('#match-result');
  const sub = $('#match-sub');
  if ($('#job-offer').value !== offer && document.activeElement !== $('#job-offer')) $('#job-offer').value = offer;
  if (!offer.trim()) {
    box.innerHTML = '';
    sub.textContent = 'Collez une annonce pour comparer';
    return;
  }
  const r = matchOffer(state.cv, offer);
  if (!r.total) {
    box.innerHTML = '<p class="hint">Aucun mot-clé exploitable dans ce texte.</p>';
    sub.textContent = 'Aucun mot-clé trouvé';
    return;
  }
  sub.textContent = `Correspondance : ${r.score} % (${r.matched.length} mots-clés sur ${r.total})`;
  const level = r.score >= 70 ? 'bon' : r.score >= 45 ? 'moyen' : 'faible';
  box.innerHTML = `<p class="match-score">Taux de correspondance : <strong>${r.score} %</strong> — ${level}
      (${r.matched.length} mot${r.matched.length > 1 ? 's' : ''}-clé${r.matched.length > 1 ? 's' : ''} sur ${r.total}).</p>
    <meter class="match-meter" min="0" max="100" low="45" high="70" optimum="100" value="${r.score}" aria-label="Taux de correspondance">${r.score} %</meter>
    ${r.missing.length ? `<h3>Absents de votre CV (${r.missing.length})</h3>
    <p class="hint">Si vous les maîtrisez, ajoutez-les à vos compétences ou reformulez vos expériences avec ces mots.</p>
    <ul class="kw-list kw-missing">${r.missing
      .map((k) => `<li><span>${esc(k.term)}</span><button type="button" class="btn btn-small" data-add-kw="${esc(k.term)}" aria-label="Ajouter « ${esc(k.term)} » aux compétences">Ajouter</button></li>`)
      .join('')}</ul>` : '<p class="hint">Tous les mots-clés de l\'annonce figurent dans votre CV.</p>'}
    ${r.matched.length ? `<h3>Présents dans votre CV (${r.matched.length})</h3><ul class="kw-list kw-ok">${r.matched.map((k) => `<li>${esc(k.term)}</li>`).join('')}</ul>` : ''}`;
}

/** Ajoute un mot-clé de l'offre au premier groupe de compétences (créé si besoin). */
function addKeyword(term) {
  const cv = state.cv;
  if (!cv.skills.length) cv.skills.push(createItem('skills', { name: cv.meta.lang === 'en' ? 'Skills' : 'Compétences' }));
  const group = cv.skills[0];
  if (!group.keywords.some((k) => k.toLowerCase() === term.toLowerCase())) group.keywords.push(term);
  changed({ structural: true });
  toast(`« ${term} » ajouté au groupe « ${group.name} ».`);
}

// ————————————————————————— Gestion des CV —————————————————————————

function openCV(cv) {
  autosaver.flush();
  state.cv = cv;
  store.setActiveId(cv.id);
  resetHistory();
  renderAll();
}

function saveNow() {
  try {
    store.save(state.cv);
  } catch (e) {
    toast(e.message);
  }
}

function newCV(kind) {
  const makers = { sample: createSampleCV, 'sample-en': createSampleCVEnglish, 'sample-junior': createSampleJunior };
  const cv = makers[kind] ? makers[kind]() : createEmptyCV({ meta: { title: 'Nouveau CV' } });
  autosaver.flush();
  state.cv = cv;
  saveNow();
  openCV(cv);
  toast(kind === 'empty' ? 'Nouveau CV créé.' : 'Exemple chargé : remplacez les informations par les vôtres.');
}

function download(filename, data, type = 'application/json') {
  const blob = new Blob([data], { type: typeof data === 'string' ? `${type};charset=utf-8` : type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(s) {
  return String(s || 'cv').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'cv';
}

function preparePrint() {
  const root = $('#print-root');
  root.innerHTML = state.doc === 'letter' ? renderLetter(state.cv, state.cv.meta.templateId) : renderCV(state.cv, state.cv.meta.templateId);
  applyAccent(root);
}

function printCV() {
  autosaver.flush();
  preparePrint();
  const previous = document.title;
  const { firstName, lastName } = state.cv.identity;
  const who = [firstName, lastName].filter(Boolean).join(' ');
  document.title = state.doc === 'letter' ? `Lettre de motivation ${who}`.trim() : state.cv.meta.anonymous ? 'CV anonyme' : `CV ${who}`.trim();
  window.print();
  setTimeout(() => {
    document.title = previous;
  }, 500);
}

// ————————————————————————— Galerie de modèles —————————————————————————

function templateBadges(t) {
  const b = [];
  b.push(t.ats ? '<span class="badge badge-ats">ATS</span>' : '<span class="badge badge-crea">Moins adapté aux ATS</span>');
  b.push(`<span class="badge">${t.columns} colonne${t.columns > 1 ? 's' : ''}</span>`);
  b.push(`<span class="badge">${t.photo ? 'Photo possible' : 'Sans photo'}</span>`);
  b.push(`<span class="badge">${t.format}${t.lang === 'en' ? ' · anglais' : ''}</span>`);
  return b.join('');
}

function renderGallery() {
  const cats = ['Tous', 'ATS', ...new Set(TEMPLATES.map((t) => t.category).filter((c) => c !== 'ATS'))];
  $('#gallery-filters').innerHTML = cats
    .map((c) => `<button type="button" class="btn btn-small" data-filter="${esc(c)}" aria-pressed="${c === state.galleryFilter}">${esc(c === 'ATS' ? 'Compatibles ATS' : c)}</button>`)
    .join('');
  const list = TEMPLATES.filter((t) => state.galleryFilter === 'Tous' || (state.galleryFilter === 'ATS' ? t.ats : t.category === state.galleryFilter));
  $('#gallery-grid').innerHTML = list
    .map((t) => `<li class="tpl-card${t.id === state.cv.meta.templateId ? ' is-current' : ''}">
      <button type="button" class="tpl-choose" data-template="${t.id}" aria-describedby="tpl-desc-${t.id}"${t.id === state.cv.meta.templateId ? ' aria-current="true"' : ''}>
        <span class="thumb" aria-hidden="true" inert><span class="thumb-inner">${renderCV(state.cv, t.id)}</span></span>
        <span class="tpl-name">${esc(t.name)}${t.id === state.cv.meta.templateId ? ' <span class="current-label">(actuel)</span>' : ''}</span>
      </button>
      <p class="tpl-badges">${templateBadges(t)}</p>
      <p class="tpl-desc" id="tpl-desc-${t.id}">${esc(t.description)}</p>
    </li>`)
    .join('');
  document.querySelectorAll('#gallery-grid .thumb-inner').forEach((n) => applyAccent(n));
  fitThumbs();
}

/** Ajuste chaque miniature à la largeur de sa carte. */
function fitThumbs() {
  document.querySelectorAll('#gallery-grid .thumb').forEach((thumb) => {
    const inner = thumb.querySelector('.thumb-inner');
    const article = inner && inner.firstElementChild;
    if (article && thumb.clientWidth) inner.style.transform = `scale(${thumb.clientWidth / article.offsetWidth})`;
  });
}

function openGallery() {
  renderGallery();
  const dlg = $('#gallery');
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  fitThumbs();
  const current = dlg.querySelector('.tpl-choose[aria-current="true"]') || dlg.querySelector('.tpl-choose');
  if (current) current.focus();
}

function closeGallery() {
  const dlg = $('#gallery');
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.removeAttribute('open');
  $('#btn-gallery').focus();
}

// ————————————————————————— Initialisation —————————————————————————

// ————————————————————————— Historique : annuler / rétablir —————————————————————————

const undoHistory = { undo: [], redo: [], current: null, timer: null };
const HISTORY_MAX = 60;

/** État du CV pour l'historique (sans la date de modification, qui change à chaque frappe). */
function snapshot() {
  return JSON.stringify({ ...state.cv, meta: { ...state.cv.meta, updatedAt: '' } });
}

function resetHistory() {
  clearTimeout(undoHistory.timer);
  undoHistory.undo = [];
  undoHistory.redo = [];
  undoHistory.current = snapshot();
  updateHistoryButtons();
}

/** Enregistre l'état : immédiatement pour une action (ajout, tri…), regroupé pour la frappe. */
function recordHistory(immediate) {
  clearTimeout(undoHistory.timer);
  if (immediate) commitHistory();
  else undoHistory.timer = setTimeout(commitHistory, 700);
}

function commitHistory() {
  clearTimeout(undoHistory.timer);
  undoHistory.timer = null;
  const snap = snapshot();
  if (snap === undoHistory.current) return;
  if (undoHistory.current !== null) undoHistory.undo.push(undoHistory.current);
  if (undoHistory.undo.length > HISTORY_MAX) undoHistory.undo.shift();
  undoHistory.redo = [];
  undoHistory.current = snap;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('#btn-undo').disabled = !undoHistory.undo.length;
  $('#btn-redo').disabled = !undoHistory.redo.length;
}

function travel(direction) {
  if (undoHistory.timer) commitHistory();
  const from = direction === 'undo' ? undoHistory.undo : undoHistory.redo;
  const to = direction === 'undo' ? undoHistory.redo : undoHistory.undo;
  if (!from.length) return;
  to.push(undoHistory.current);
  undoHistory.current = from.pop();
  state.cv = normalizeCV(JSON.parse(undoHistory.current));
  autosaver.schedule(state.cv);
  renderAll();
  updateHistoryButtons();
  toast(direction === 'undo' ? 'Modification annulée.' : 'Modification rétablie.');
}

// ————————————————————————— Import LinkedIn —————————————————————————

/** Archive LinkedIn (.zip) ou fichiers .csv extraits : tout est lu sur l'appareil. */
async function importLinkedIn(files) {
  const texts = {};
  const dec = new TextDecoder();
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const entries = await readZipAsync(new Uint8Array(await f.arrayBuffer()));
      for (const [name, data] of Object.entries(entries)) if (/\.csv$/i.test(name)) texts[name] = dec.decode(data);
    } else if (/\.csv$/i.test(f.name)) texts[f.name] = await f.text();
  }
  const { cv, found, notes } = fromLinkedIn(texts);
  if (!found.length) throw new Error('Aucun fichier LinkedIn reconnu (Profile.csv, Positions.csv, Education.csv…). Importez l\'archive « Obtenir une copie de vos données ».');
  autosaver.flush();
  state.cv = cv;
  saveNow();
  openCV(cv);
  toast(`Profil LinkedIn importé (${found.length} fichier${found.length > 1 ? 's' : ''}). ${notes.join(' ')} Vérifiez l'ordre et les dates.`.trim());
}

// ————————————————————————— Suivi des candidatures —————————————————————————

const appLabel = (id) => (STATUSES.find((st) => st.id === id) || { label: id }).label;
const frDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function updateDueBadge() {
  const n = dueFollowUps(appStore.list()).length;
  const badge = $('#due-badge');
  badge.hidden = !n;
  badge.textContent = n ? `${n} relance${n > 1 ? 's' : ''}` : '';
}

function resetAppForm(values = {}) {
  const a = normalizeApplication({ position: state.cv.targetTitle, ...values });
  $('#app-id').value = values.id || '';
  for (const k of ['company', 'position', 'sentOn', 'followUpOn', 'contact', 'reference', 'notes']) $(`#app-${k}`).value = a[k];
  $('#app-status').value = a.status;
  $('#app-channel').value = a.channel;
  $('#apps-form-title').textContent = values.id ? `Modifier : ${a.company}` : 'Nouvelle candidature';
  $('#app-save').textContent = values.id ? 'Enregistrer les modifications' : 'Enregistrer la candidature';
  $('#app-cancel').hidden = !values.id;
}

function renderApps() {
  const list = sortApplications(appStore.list());
  const due = new Set(dueFollowUps(list).map((a) => a.id));
  const st = appStats(list);
  $('#apps-stats').textContent = list.length
    ? `${st.total} candidature${st.total > 1 ? 's' : ''} · ${st.sent} envoyée${st.sent > 1 ? 's' : ''} · ${st.interviews} entretien${st.interviews > 1 ? 's' : ''} · taux de réponse ${st.responseRate} %`
    : 'Aucune candidature enregistrée pour l\'instant.';
  $('#apps-due').innerHTML = due.size
    ? `<p class="apps-due-note" role="status"><strong>${due.size} relance${due.size > 1 ? 's' : ''} à faire</strong> : sans réponse après ${FOLLOW_UP_DAYS} jours, une relance courte et polie est d'usage.</p>` : '';
  $('#apps-list').innerHTML = list.map((a) => `<li class="app-card${due.has(a.id) ? ' is-due' : ''}">
      <div class="app-main">
        <h4>${esc(a.company)}${a.position ? ` <span class="app-pos">— ${esc(a.position)}</span>` : ''}</h4>
        <p class="app-meta"><span class="app-status st-${a.status}">${esc(appLabel(a.status))}</span>
          ${a.sentOn ? ` · envoyée le ${frDate(a.sentOn)}` : ''}${a.channel ? ` (${esc(a.channel)})` : ''}
          ${a.followUpOn ? ` · relance ${due.has(a.id) ? '<strong>due</strong> depuis' : 'prévue'} le ${frDate(a.followUpOn)}` : ''}</p>
        ${a.contact ? `<p class="app-meta">Contact : ${esc(a.contact)}</p>` : ''}
        ${a.notes ? `<p class="app-meta">${esc(a.notes)}</p>` : ''}
      </div>
      <div class="app-actions">
        <label class="sr-only" for="app-st-${a.id}">Statut de la candidature ${esc(a.company)}</label>
        <select id="app-st-${a.id}" data-app-status="${a.id}">${STATUSES.map((x) => `<option value="${x.id}"${x.id === a.status ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        ${['envoyee', 'relancee'].includes(a.status) ? `<button type="button" class="btn btn-small" data-app-act="followup" data-id="${a.id}">Préparer la relance</button>` : ''}
        ${a.status === 'entretien' ? `<button type="button" class="btn btn-small" data-app-act="thanks" data-id="${a.id}">Lettre de remerciement</button>` : ''}
        <button type="button" class="btn btn-small" data-app-act="edit" data-id="${a.id}" aria-label="Modifier la candidature ${esc(a.company)}">Modifier</button>
        <button type="button" class="btn btn-small btn-danger" data-app-act="remove" data-id="${a.id}" aria-label="Supprimer la candidature ${esc(a.company)}">Supprimer</button>
      </div>
    </li>`).join('');
  updateDueBadge();
}

function openApps() {
  $('#app-status').innerHTML = STATUSES.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join('');
  $('#app-channel').innerHTML = `<option value="">— Choisir —</option>${CHANNELS.map((c) => `<option>${esc(c)}</option>`).join('')}`;
  resetAppForm({ company: state.cv.letter.organization || '' });
  renderApps();
  const dlg = $('#apps-dlg');
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  $('#app-company').focus();
}

function closeApps() {
  const dlg = $('#apps-dlg');
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.removeAttribute('open');
  $('#btn-apps').focus();
}

function saveAppFromForm(e) {
  e.preventDefault();
  const company = $('#app-company').value.trim();
  if (!company) {
    $('#app-company').setAttribute('aria-invalid', 'true');
    $('#app-company').focus();
    toast('Indiquez l\'entreprise ou l\'administration.');
    return;
  }
  $('#app-company').removeAttribute('aria-invalid');
  const id = $('#app-id').value;
  const previous = id ? appStore.list().find((a) => a.id === id) : null;
  let app = normalizeApplication({
    ...(previous || createApplication()),
    company,
    position: $('#app-position').value,
    sentOn: $('#app-sentOn').value,
    followUpOn: $('#app-followUpOn').value,
    channel: $('#app-channel').value,
    contact: $('#app-contact').value,
    reference: $('#app-reference').value,
    notes: $('#app-notes').value,
    cvId: (previous && previous.cvId) || state.cv.id,
  });
  const status = $('#app-status').value;
  if (!previous || previous.status !== status) app = setAppStatus(app, status);
  else if (app.sentOn && !app.followUpOn && ['envoyee', 'relancee'].includes(status)) app.followUpOn = addDays(app.sentOn, FOLLOW_UP_DAYS);
  appStore.save(app);
  resetAppForm();
  renderApps();
  $('#app-company').focus();
  toast(previous ? 'Candidature mise à jour.' : `Candidature « ${company} » enregistrée.`);
}

/** Prépare une lettre de relance ou de remerciement pré-remplie pour une candidature. */
function prepareLetter(app, kind) {
  const L = state.cv.letter;
  // eslint-disable-next-line no-alert
  if (L.body.trim() && !window.confirm('La lettre actuelle sera remplacée par un brouillon. Continuer ? (Annuler reste possible.)')) return;
  L.kind = kind;
  L.organization = app.company;
  L.reference = app.reference;
  if (!L.place) L.place = state.cv.identity.city;
  Object.assign(L, draftLetter(state.cv, L.style));
  if (kind === 'relance' && app.sentOn) {
    const [y, m, d] = app.sentOn.split('-').map(Number);
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const when = L.style === 'en' ? `${d} ${new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${y}` : `${d === 1 ? '1er' : d} ${months[m - 1]} ${y}`;
    L.body = L.body.replace(/\[date\]/, when);
  }
  if (app.position && L.body.includes('[intitulé du poste]')) L.body = L.body.replaceAll('[intitulé du poste]', app.position);
  closeApps();
  state.doc = 'letter';
  changed({ structural: true });
  renderDocSwitch();
  focusAfterRender('#f-letter-body');
  toast(kind === 'relance' ? 'Lettre de relance préparée : relisez-la avant l\'envoi.' : 'Lettre de remerciement préparée : ajoutez un point précis de l\'entretien.');
}

function onAppsClick(e) {
  const b = e.target.closest('button[data-app-act]');
  if (!b) return;
  const app = appStore.list().find((a) => a.id === b.dataset.id);
  if (!app) return;
  switch (b.dataset.appAct) {
    case 'edit':
      resetAppForm(app);
      $('#app-company').focus();
      break;
    case 'remove':
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Supprimer la candidature « ${app.company} » ?`)) return;
      appStore.remove(app.id);
      renderApps();
      $('#app-company').focus();
      toast('Candidature supprimée.');
      break;
    case 'followup':
      prepareLetter(app, 'relance');
      break;
    case 'thanks':
      prepareLetter(app, 'remerciement');
      break;
    default:
  }
}

function onAppsStatusChange(e) {
  const id = e.target.dataset.appStatus;
  if (!id) return;
  const app = appStore.list().find((a) => a.id === id);
  if (!app) return;
  appStore.save(setAppStatus(app, e.target.value));
  renderApps();
  const again = document.querySelector(`[data-app-status="${CSS.escape(id)}"]`);
  if (again) again.focus();
  toast(`Statut : ${appLabel(e.target.value)}.`);
}

// ————————————————————————— Texte brut —————————————————————————

function openTextDialog() {
  autosaver.flush();
  const letter = state.doc === 'letter';
  $('#text-dlg-title').textContent = letter ? 'Lettre en texte brut' : 'CV en texte brut';
  $('#plain-text').value = letter ? letterText(state.cv) : cvPlainText(state.cv);
  $('#text-share').hidden = typeof navigator.share !== 'function';
  const dlg = $('#text-dlg');
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  $('#text-copy').focus();
}

function closeTextDialog() {
  const dlg = $('#text-dlg');
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.removeAttribute('open');
  $('#btn-text').focus();
}

async function copyText() {
  const area = $('#plain-text');
  try {
    await navigator.clipboard.writeText(area.value);
    toast('Texte copié : collez-le dans le formulaire ou le message.');
  } catch {
    area.focus();
    area.select();
    toast('Copie automatique impossible : le texte est sélectionné, faites Ctrl+C (ou « Copier » sur téléphone).');
  }
}

// ————————————————————————— Document : CV ou lettre —————————————————————————

function switchDoc(doc, { focus = true } = {}) {
  if (doc === state.doc) return;
  state.doc = doc;
  renderDocSwitch();
  renderEditor();
  updatePreview();
  if (focus) focusAfterRender(`.doc-switch button[data-doc="${doc}"]`);
}

function renderAll() {
  renderDocSwitch();
  renderPicker();
  renderSettings();
  renderEditor();
  updatePreview();
}

function bind() {
  const sections = $('#sections');
  sections.addEventListener('input', onInput);
  sections.addEventListener('change', onEditorChange);
  sections.addEventListener('click', onEditorClick);
  sections.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.dataset && d.dataset.section) {
      if (d.open) state.openSections.add(d.dataset.section);
      else state.openSections.delete(d.dataset.section);
    }
  }, true);

  const settings = document.querySelector('.editor > details');
  settings.addEventListener('input', onInput);
  settings.addEventListener('change', onInput);
  $('#btn-accent-reset').addEventListener('click', () => {
    state.cv.meta.accent = '';
    renderSettings();
    changed();
  });

  $('#cv-select').addEventListener('change', (e) => {
    const cv = store.load(e.target.value);
    if (cv) openCV(cv);
  });
  $('#new-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-new]');
    if (!b) return;
    $('#new-menu').open = false;
    newCV(b.dataset.new);
  });
  $('#btn-dup').addEventListener('click', () => {
    autosaver.flush();
    saveNow();
    const copy = store.duplicate(state.cv.id);
    if (copy) {
      openCV(copy);
      toast('CV dupliqué.');
    }
  });
  $('#btn-del').addEventListener('click', () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Supprimer définitivement « ${state.cv.meta.title} » de ce navigateur ? Pensez à l'exporter avant.`)) return;
    autosaver.flush();
    store.remove(state.cv.id);
    const next = store.list()[0];
    if (next) openCV(store.load(next.id));
    else newCV('empty');
    toast('CV supprimé.');
  });
  $('#btn-anon').addEventListener('click', () => {
    applyFix(state.cv, state.cv.meta.anonymous ? 'anonymous:off' : 'anonymous:on');
    changed();
    renderSettings();
    toast(state.cv.meta.anonymous ? 'Mode CV anonyme activé : nom, photo, coordonnées, adresse et âge masqués.' : 'Mode CV anonyme désactivé.');
  });
  $('#btn-export').addEventListener('click', () => {
    autosaver.flush();
    download(`${slug(state.cv.meta.title)}.json`, exportJSON(state.cv));
    toast('Fichier exporté : conservez-le pour retrouver votre CV sur un autre appareil.');
  });
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const file = files[0];
    if (!file) return;
    try {
      if (files.some((f) => /\.(zip|csv)$/i.test(f.name))) {
        await importLinkedIn(files);
        return;
      }
      const { cv, warnings, source } = importJSON(await file.text());
      autosaver.flush();
      state.cv = cv;
      saveNow();
      openCV(cv);
      const from = source === 'jsonresume' ? ' depuis le format JSON Resume' : '';
      toast(warnings.length ? `CV importé${from} (${warnings.length} point(s) à vérifier).` : `CV importé${from}.`);
    } catch (err) {
      toast(err.message);
    }
  });
  $('#btn-print').addEventListener('click', printCV);
  document.querySelector('.doc-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-doc]');
    if (b) switchDoc(b.dataset.doc);
  });
  $('#btn-undo').addEventListener('click', () => travel('undo'));
  $('#btn-redo').addEventListener('click', () => travel('redo'));
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    // Dans un champ de saisie, l'annulation native du navigateur reste prioritaire.
    const typing = e.target.closest && e.target.closest('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type]), textarea');
    if (typing) return;
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      travel('undo');
    } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
      e.preventDefault();
      travel('redo');
    }
  });
  $('#btn-text').addEventListener('click', openTextDialog);
  $('#btn-apps').addEventListener('click', openApps);
  $('#apps-close').addEventListener('click', closeApps);
  $('#apps-form').addEventListener('submit', saveAppFromForm);
  $('#app-cancel').addEventListener('click', () => {
    resetAppForm();
    $('#app-company').focus();
  });
  $('#apps-list').addEventListener('click', onAppsClick);
  $('#apps-list').addEventListener('change', onAppsStatusChange);
  $('#apps-export').addEventListener('click', () => {
    download('candidatures.csv', toCSV(sortApplications(appStore.list())), 'text/csv');
    toast('Suivi exporté : ouvrez le fichier avec Excel ou LibreOffice.');
  });
  $('#btn-docx').addEventListener('click', () => {
    autosaver.flush();
    $('#formats-menu').open = false;
    const letter = state.doc === 'letter';
    const bytes = letter ? letterToDocx(state.cv) : cvToDocx(state.cv);
    download(`${letter ? 'lettre-' : ''}${slug(state.cv.meta.title)}.docx`, bytes, DOCX_MIME);
    toast(letter ? 'Lettre exportée au format Word.' : 'CV exporté au format Word : une colonne, titres standard, lisible par les ATS.');
  });
  $('#btn-jsonresume').addEventListener('click', () => {
    autosaver.flush();
    $('#formats-menu').open = false;
    download(`${slug(state.cv.meta.title)}.resume.json`, JSON.stringify(toJSONResume(state.cv), null, 2));
    toast('Exporté au format JSON Resume (réutilisable dans d\'autres outils de CV).');
  });
  $('#text-close').addEventListener('click', closeTextDialog);
  $('#text-copy').addEventListener('click', copyText);
  $('#text-download').addEventListener('click', () => {
    const name = state.doc === 'letter' ? `lettre-${slug(state.cv.meta.title)}` : slug(state.cv.meta.title);
    download(`${name}.txt`, $('#plain-text').value, 'text/plain');
    toast('Fichier texte téléchargé.');
  });
  $('#text-share').addEventListener('click', async () => {
    try {
      await navigator.share({ title: state.doc === 'letter' ? 'Lettre de motivation' : 'CV', text: $('#plain-text').value });
    } catch {
      // Partage annulé par l'utilisateur : rien à faire.
    }
  });
  window.addEventListener('beforeprint', preparePrint);
  $('#btn-gallery').addEventListener('click', openGallery);
  $('#btn-gallery-2').addEventListener('click', openGallery);
  $('#gallery-close').addEventListener('click', closeGallery);
  $('#gallery').addEventListener('click', (e) => {
    const f = e.target.closest('button[data-filter]');
    if (f) {
      state.galleryFilter = f.dataset.filter;
      renderGallery();
      const again = document.querySelector(`#gallery-filters button[data-filter="${CSS.escape(state.galleryFilter)}"]`);
      if (again) again.focus();
      return;
    }
    const c = e.target.closest('button[data-template]');
    if (c) {
      state.cv.meta.templateId = c.dataset.template;
      const tpl = getTemplate(c.dataset.template);
      changed({ structural: true });
      closeGallery();
      toast(`Modèle « ${tpl.name} » appliqué.`);
    }
  });

  $('#btn-fit').addEventListener('click', () => fitToPages(1));
  $('#btn-fit-reset').addEventListener('click', () => {
    state.cv.meta.fit = 0;
    renderSettings();
    changed();
    $('#btn-fit').focus();
    toast('Taille normale rétablie.');
  });
  $('#job-offer').addEventListener('input', (e) => {
    state.cv.meta.jobOffer = e.target.value;
    state.cv.meta.updatedAt = new Date().toISOString();
    autosaver.schedule(state.cv);
    clearTimeout(renderMatch.t);
    renderMatch.t = setTimeout(renderMatch, 250);
  });
  $('#match-result').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-add-kw]');
    if (b) {
      addKeyword(b.dataset.addKw);
      requestAnimationFrame(() => $('#job-offer').focus());
    }
  });
  setupInstallButton($('#btn-install'), () => toast('Application installée : elle fonctionne aussi sans connexion.'));

  $('#norms').addEventListener('click', (e) => {
    const fix = e.target.closest('button[data-fix]');
    if (fix && /^fit(:\d)?$/.test(fix.dataset.fix)) {
      fitToPages(Number(fix.dataset.fix.split(':')[1] || 1));
      return;
    }
    if (fix) {
      applyFix(state.cv, fix.dataset.fix);
      changed({ structural: true });
      toast('Correction appliquée.');
      return;
    }
    const link = e.target.closest('button[data-issue]');
    if (link) goTo(state.issues[Number(link.dataset.issue)].target);
  });
  $('#norms').addEventListener('toggle', (e) => {
    if (e.target.matches('details')) state.normsOpen = e.target.open;
  }, true);

  window.addEventListener('resize', () => requestAnimationFrame(() => {
    fitPreview();
    if ($('#gallery').open) fitThumbs();
  }));
  window.addEventListener('pagehide', () => autosaver.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autosaver.flush();
  });
}

function init() {
  const activeId = store.getActiveId();
  const list = store.list();
  let cv = (activeId && store.load(activeId)) || (list[0] && store.load(list[0].id));
  if (!cv) {
    cv = createSampleCV();
    store.save(cv);
  }
  state.cv = cv;
  store.setActiveId(cv.id);
  renderDatalists();
  bind();
  updateDueBadge();
  resetHistory();
  renderAll();
  // Les polices embarquées changent la hauteur du texte : nouvelle mesure une fois chargées.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => schedulePreview());
  registerServiceWorker();
  setStatus(navigator.onLine === false ? 'Hors ligne — vos données restent dans ce navigateur' : 'Vos données restent dans ce navigateur');
  // Exposé pour le débogage et les tests d'interface.
  window.__cvApp = { state, store, cloneCV, getByPath, CEFR_LEVELS, undoHistory };
}

init();
