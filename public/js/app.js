// Éditeur de CV : formulaires par rubrique, aperçu en direct, contrôle de conformité,
// galerie de modèles, sauvegarde automatique, export PDF (impression) et JSON.

import {
  createEmptyCV, createSampleCV, createSampleCVEnglish, createItem, cloneCV, getByPath, setByPath, moveItem,
  normalizeDate, ITEM_FIELDS, IDENTITY_FIELDS, SENSITIVE_IDENTITY_FIELDS, CEFR_LEVELS,
} from './model.js';
import { createStore, exportJSON, importJSON, createAutosaver, QuotaError } from './storage.js';
import { renderCV, TEMPLATES, getTemplate, effectivePaper } from './render.js';
import { checkCV, applyFix } from './norms.js';
import { levelLabel } from './i18n.js';
import { esc } from './templates/parts.js';

const $ = (sel, root = document) => root.querySelector(sel);

/** Libellés de l'éditeur (toujours en français), par rubrique. */
const SECTION_UI = {
  experiences: { title: 'Expérience professionnelle', item: 'Expérience', add: 'Ajouter une expérience', itemTitle: (it) => [it.position, it.employer].filter(Boolean).join(' — ') },
  education: { title: 'Formation', item: 'Formation', add: 'Ajouter une formation', itemTitle: (it) => [it.degree, it.school].filter(Boolean).join(' — ') },
  skills: { title: 'Compétences', item: 'Groupe de compétences', add: 'Ajouter un groupe de compétences', itemTitle: (it) => it.name },
  languages: { title: 'Langues', item: 'Langue', add: 'Ajouter une langue', itemTitle: (it) => it.name },
  certifications: { title: 'Certifications', item: 'Certification', add: 'Ajouter une certification', itemTitle: (it) => it.name },
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
  references: 'Demandez l\'accord de la personne avant de la citer.',
};

const store = createStore();
const state = { cv: null, pages: 1, galleryFilter: 'Tous', openSections: new Set(['identity', 'headline']) };
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
        .map((o) => `<option value="${o}"${o === value ? ' selected' : ''}>${o ? esc(levelLabel('fr', o)) : '— Choisir —'}</option>`)
        .join('')}</select></div>`;
    case 'list':
      return `<div class="field field-wide">${label}<input type="text" id="${id}" data-path="${path}" data-type="list" value="${esc((value || []).join(', '))}"></div>`;
    case 'month':
      return `<div class="field">${label}<input type="month" id="${id}" data-path="${path}" data-type="month" placeholder="AAAA-MM" value="${esc(value)}"${req}${extra}></div>`;
    default: {
      const ac = f.autocomplete ? ` autocomplete="${f.autocomplete}"` : '';
      return `<div class="field">${label}<input type="${f.type}" id="${id}" data-path="${path}" value="${esc(value)}"${ac}${req}${extra}></div>`;
    }
  }
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
      return `<li><fieldset class="ed-item" data-item="${base}">
        <legend>${esc(ui.item)} ${i + 1}${t ? ` : ${esc(t)}` : ''}</legend>
        <div class="grid">${fields}</div>
        <div class="item-actions">
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
    <summary><h2>${esc(ui.title)} <span class="count">(${items.length})</span></h2></summary>
    <div class="ed-body">
      ${SECTION_HINTS[key] ? `<p class="hint">${esc(SECTION_HINTS[key])}</p>` : ''}
      <div class="section-actions">
        <span class="hint">Position de la rubrique dans le CV :</span>
        <button type="button" class="btn btn-small" data-act="section-up" data-section="${key}"${index === 0 ? ' disabled' : ''} aria-label="Monter la rubrique ${esc(ui.title)}">Monter</button>
        <button type="button" class="btn btn-small" data-act="section-down" data-section="${key}"${index === total - 1 ? ' disabled' : ''} aria-label="Descendre la rubrique ${esc(ui.title)}">Descendre</button>
        ${['experiences', 'education', 'volunteering'].includes(key) && items.length > 1 ? `<button type="button" class="btn btn-small" data-act="sort" data-section="${key}">Trier du plus récent au plus ancien</button>` : ''}
      </div>
      <ol class="items">${itemsHTML}</ol>
      ${extra}
      <button type="button" class="btn btn-add" data-act="item-add" data-section="${key}">+ ${esc(ui.add)}</button>
    </div>
  </details>`;
}

function renderEditor() {
  const cv = state.cv;
  const order = cv.meta.sectionOrder;
  $('#sections').innerHTML = identityHTML(cv) + headlineHTML(cv) + order.map((k, i) => listSectionHTML(cv, k, i, order.length)).join('');
}

function renderSettings() {
  const { meta } = state.cv;
  $('#set-title').value = meta.title;
  $('#set-lang').value = meta.lang;
  $('#set-paper').value = meta.paper;
  $('#set-datestyle').value = meta.dateStyle;
  $('#set-accent').value = meta.accent || '#1f3a5f';
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

const MM = 96 / 25.4;

function applyAccent(root) {
  const article = root.querySelector('.cv');
  if (!article) return;
  const accent = state.cv.meta.accent;
  if (accent) {
    article.style.setProperty('--accent', accent);
    article.style.setProperty('--accent-2', accent);
  }
}

function measurePages(article, paper) {
  const cs = getComputedStyle(article);
  const inner = article.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const pageH = paper === 'Letter' ? 10 * 96 : 273 * MM; // hauteur utile (marges d'impression déduites)
  // Contenu réel : on retire le « min-height » de la page vide.
  const content = [...article.children].reduce((max, el) => Math.max(max, el.offsetTop + el.offsetHeight), 0) - parseFloat(cs.paddingTop);
  return { pages: Math.max(1, Math.ceil((Math.min(inner, content) - 2) / pageH)), pageH, padTop: parseFloat(cs.paddingTop) };
}

function updatePreview() {
  const cv = state.cv;
  const tpl = getTemplate(cv.meta.templateId);
  const preview = $('#preview');
  preview.innerHTML = renderCV(cv, tpl.id);
  applyAccent(preview);
  const article = preview.querySelector('.cv');
  const paper = effectivePaper(cv, tpl);
  const { pages, pageH, padTop } = measurePages(article, paper);
  state.pages = pages;
  // Repères de fin de page
  preview.querySelectorAll('.page-break').forEach((n) => n.remove());
  for (let p = 1; p < Math.max(pages, 1) + 0; p += 1) {
    const mark = document.createElement('div');
    mark.className = 'page-break';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = `Fin de la page ${p}`;
    mark.style.top = `${padTop + p * pageH}px`;
    preview.appendChild(mark);
  }
  fitPreview();
  $('#template-info').innerHTML = `Modèle : <strong>${esc(tpl.name)}</strong> · ${tpl.ats ? 'ATS' : 'créatif'} · ${paper} · ${pages} page${pages > 1 ? 's' : ''}`;
  renderNorms(checkCV(cv, tpl, { pages }));
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

function renderNorms(result) {
  const { score, issues } = result;
  const level = score >= 85 ? 'good' : score >= 60 ? 'mid' : 'bad';
  const sevLabel = { error: 'Erreur', warning: 'À corriger', info: 'Conseil' };
  const counts = issues.reduce((acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] || 0) + 1 }), {});
  const summary = [counts.error && `${counts.error} erreur${counts.error > 1 ? 's' : ''}`, counts.warning && `${counts.warning} point${counts.warning > 1 ? 's' : ''} à corriger`, counts.info && `${counts.info} conseil${counts.info > 1 ? 's' : ''}`]
    .filter(Boolean)
    .join(', ');
  $('#norms').innerHTML = `<details class="norms-box norms-${level}" ${state.normsOpen === false ? '' : 'open'}>
    <summary><span class="score" aria-hidden="true">${score}</span><span class="norms-title"><span>Conformité aux normes : <strong>${score}/100</strong></span><span class="norms-sub">${
      summary || 'Aucun problème détecté'
    }</span></span></summary>
    ${issues.length ? `<ul class="issues">${issues
      .map((is, i) => `<li class="issue sev-${is.severity}"><span class="sev">${sevLabel[is.severity]}</span>
        <button type="button" class="issue-link" data-issue="${i}">${esc(is.message)}</button>
        ${is.advice ? `<span class="issue-advice">${esc(is.advice)}</span>` : ''}
        ${is.fix ? `<button type="button" class="btn btn-small" data-fix="${esc(is.fix)}">${esc(is.fixLabel || 'Corriger')}</button>` : ''}</li>`)
      .join('')}</ul>` : '<p class="norms-ok">Votre CV respecte les règles vérifiées.</p>'}
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
  const first = target.split('.')[0];
  const sectionKey = first === 'identity' ? 'identity' : first === 'privacy' ? 'privacy' : ['targetTitle', 'summary'].includes(first) ? 'headline' : first;
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

function changed({ structural = false } = {}) {
  state.cv.meta.updatedAt = new Date().toISOString();
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
  setByPath(state.cv, path, value);
  if (path === 'summary') $('#summary-count').textContent = `${value.length} / 500 caractères`;
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
  const structural = path === 'meta.lang' || (path.startsWith('privacy.') && e.type === 'change');
  changed({ structural: false });
  if (path === 'meta.title') renderPicker();
  if (structural) renderSettings();
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

// ————————————————————————— Gestion des CV —————————————————————————

function openCV(cv) {
  autosaver.flush();
  state.cv = cv;
  store.setActiveId(cv.id);
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
  const cv = kind === 'sample' ? createSampleCV() : kind === 'sample-en' ? createSampleCVEnglish() : createEmptyCV({ meta: { title: 'Nouveau CV' } });
  autosaver.flush();
  state.cv = cv;
  saveNow();
  openCV(cv);
  toast(kind === 'empty' ? 'Nouveau CV créé.' : 'Exemple chargé : remplacez les informations par les vôtres.');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
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
  root.innerHTML = renderCV(state.cv, state.cv.meta.templateId);
  applyAccent(root);
}

function printCV() {
  autosaver.flush();
  preparePrint();
  const previous = document.title;
  const { firstName, lastName } = state.cv.identity;
  document.title = state.cv.meta.anonymous ? 'CV anonyme' : `CV ${[firstName, lastName].filter(Boolean).join(' ')}`.trim();
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
        <span class="thumb" aria-hidden="true"><span class="thumb-inner">${renderCV(state.cv, t.id)}</span></span>
        <span class="tpl-name">${esc(t.name)}${t.id === state.cv.meta.templateId ? ' <span class="current-label">(actuel)</span>' : ''}</span>
      </button>
      <p class="tpl-badges">${templateBadges(t)}</p>
      <p class="tpl-desc" id="tpl-desc-${t.id}">${esc(t.description)}</p>
    </li>`)
    .join('');
  if (state.cv.meta.accent) document.querySelectorAll('#gallery-grid .thumb-inner').forEach((n) => applyAccent(n));
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

function renderAll() {
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
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { cv, warnings } = importJSON(await file.text());
      autosaver.flush();
      state.cv = cv;
      saveNow();
      openCV(cv);
      toast(warnings.length ? `CV importé (${warnings.length} point(s) à vérifier).` : 'CV importé.');
    } catch (err) {
      toast(err.message);
    }
  });
  $('#btn-print').addEventListener('click', printCV);
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

  $('#norms').addEventListener('click', (e) => {
    const fix = e.target.closest('button[data-fix]');
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
  bind();
  renderAll();
  setStatus('Vos données restent dans ce navigateur');
  // Exposé pour le débogage et les tests d'interface.
  window.__cvApp = { state, store, cloneCV, getByPath, CEFR_LEVELS };
}

init();
