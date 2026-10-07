// Page « Préparer un concours » : mes concours (dates, rappels .ics), pièces du dossier, lettre de candidature, épreuves.
// Données dans ce navigateur seulement (localStorage), comme le CV.
import { createStore } from './storage.js';
import { track } from './premium.js';
import { STORE_KEY, FAMILIES, CHECKLIST, daysLeft, countdownText, nextDeadline, icsFor, letterText, cleanConcours } from './concours-core.js';

const root = document.getElementById('cc-app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = () => { try { return (JSON.parse(localStorage.getItem(STORE_KEY) || '[]') || []).map(cleanConcours); } catch { return []; } };
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch { alert('Stockage du navigateur plein : exportez une sauvegarde de votre CV puis libérez de la place.'); } };
const store = createStore();
const list = store.list();
const identity = list.length ? (store.load(list[0].id)?.identity || {}) : {};

let items = load();
let open = null;      // id du concours affiché
let editing = null;   // brouillon du formulaire
let showLetter = false;
// Concours annoncés par l'équipe (avec le lien vers l'avis officiel) : chargés en ligne, absents hors ligne.
let annonces = [];
fetch('/api/concours').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && Array.isArray(d.concours)) { annonces = d.concours; if (!editing && !open) home(); } }).catch(() => {});
const fmtDay = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

function home() {
  const sorted = [...items].sort((a, b) => (nextDeadline(a)?.n ?? 9999) - (nextDeadline(b)?.n ?? 9999));
  root.innerHTML = `<div class="tool-noprint">
    <div class="tool-row"><button type="button" class="btn btn-primary" data-act="new">＋ Ajouter un concours</button></div>
    ${sorted.length ? `<ul class="tool-list tool-card">${sorted.map((c) => {
      const nd = nextDeadline(c);
      const done = c.done.filter((id) => CHECKLIST.some((d) => d.id === id)).length;
      return `<li><button type="button" class="btn" data-open="${esc(c.id)}">${esc(c.title || FAMILIES[c.family].label)}</button>
        <span class="tool-muted">${esc(FAMILIES[c.family].label)} · dossier ${done}/${CHECKLIST.length}</span>
        ${nd ? ` · <span class="cc-days${nd.n <= 7 ? ' soon' : ''}">${esc(nd.label)} ${esc(countdownText(nd.n))}</span>` : ''}</li>`;
    }).join('')}</ul>` : `<div class="tool-card"><p>Aucun concours pour l'instant. Ajoutez celui que vous préparez : vous aurez le compte à rebours, la liste des pièces et la lettre de candidature.</p></div>`}
    ${annonces.length ? `<h2>Concours annoncés</h2>
    <p class="tool-muted">Relevés par l'équipe CV en ligne, chacun avec le lien vers l'avis officiel. <strong>Vérifiez toujours l'avis</strong> : conditions, pièces et dates peuvent changer.</p>
    <ul class="tool-list tool-card">${annonces.map((a) => {
      const nd = nextDeadline(a);
      const mine = items.some((c) => c.source === a.id);
      return `<li><strong>${esc(a.title)}</strong><div class="tool-muted">${esc(FAMILIES[a.family]?.label || '')}${a.organisme ? ` · ${esc(a.organisme)}` : ''}${a.deadline ? ` · dépôt avant le ${esc(fmtDay(a.deadline))}` : ''}${a.exam ? ` · épreuves le ${esc(fmtDay(a.exam))}` : ''}${nd ? ` · <span class="cc-days${nd.n <= 7 ? ' soon' : ''}">${esc(countdownText(nd.n))}</span>` : ''}</div>
        ${a.notes ? `<div class="tool-muted">${esc(a.notes)}</div>` : ''}
        <div class="tool-row"><a class="btn btn-small" href="${esc(a.source_url)}" target="_blank" rel="noopener nofollow">Voir l'avis officiel</a>
        ${mine ? '<span class="tool-muted">✓ Dans mes concours</span>' : `<button type="button" class="btn btn-small btn-primary" data-annonce="${esc(a.id)}">Ajouter à mes concours</button>`}</div></li>`;
    }).join('')}</ul>` : ''}
    <h2>Familles de concours</h2>
    <div class="tool-grid">${Object.entries(FAMILIES).filter(([k]) => k !== 'autre').map(([k, f]) => `<div class="tool-card"><strong>${esc(f.label)}</strong>
      <p class="tool-muted">Épreuves habituelles : ${esc(f.epreuves.join(', '))}.</p><button type="button" class="btn btn-small" data-new="${k}">Préparer ce concours</button></div>`).join('')}</div>
    <p class="tool-muted">Épreuves indiquées à titre indicatif : elles varient selon le corps, le grade et la session.</p></div>`;
}

function form() {
  const c = editing;
  const F = (k, label, attrs = '') => `<div class="field"><label for="cc-${k}">${label}</label><input id="cc-${k}" data-k="${k}" value="${esc(c[k])}" ${attrs}></div>`;
  root.innerHTML = `<div class="tool-card tool-noprint">
    <h2>${items.some((x) => x.id === c.id) ? 'Modifier le concours' : 'Nouveau concours'}</h2>
    <div class="field"><label for="cc-family">Type</label><select id="cc-family" data-k="family">${Object.entries(FAMILIES).map(([k, f]) => `<option value="${k}"${k === c.family ? ' selected' : ''}>${esc(f.label)}</option>`).join('')}</select></div>
    ${F('title', 'Intitulé exact (tel qu’écrit dans l’avis)', 'maxlength="160" placeholder="Ex. : concours direct d’entrée à … , section …"')}
    <div class="tool-grid">${F('organisme', 'Organisme (facultatif)', 'maxlength="160"')}${F('session', 'Session (facultatif)', 'maxlength="40" placeholder="2026"')}</div>
    ${F('authority', 'Lettre adressée à', `maxlength="200" placeholder="${esc(FAMILIES[c.family].authority)}"`)}
    <div class="tool-grid">${F('deadline', 'Date limite de dépôt du dossier', 'type="date"')}${F('exam', 'Date des épreuves', 'type="date"')}</div>
    ${F('place', 'Lieu de dépôt ou des épreuves (facultatif)', 'maxlength="160"')}
    <div class="field"><label for="cc-notes">Notes (conditions de l’avis, contacts…)</label><textarea id="cc-notes" data-k="notes" rows="3" maxlength="1500">${esc(c.notes)}</textarea></div>
    <div class="tool-row"><button type="button" class="btn btn-primary" data-act="save">Enregistrer</button><button type="button" class="btn" data-act="cancel">Annuler</button></div></div>`;
}

function detail() {
  const c = items.find((x) => x.id === open);
  if (!c) { open = null; return home(); }
  const fam = FAMILIES[c.family];
  const extra = fam.extra.map((label, i) => ({ id: `x-${c.family}-${i}`, label }));
  const checks = [...CHECKLIST, ...extra];
  const row = (label, day) => { const n = daysLeft(day); return day ? `<li>${esc(label)} : <strong>${esc(new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</strong> <span class="cc-days${n !== null && n <= 7 && n >= 0 ? ' soon' : ''}">${esc(countdownText(n))}</span></li>` : ''; };
  root.innerHTML = `<div class="tool-noprint">
    <div class="tool-row"><button type="button" class="btn" data-act="back">← Mes concours</button><button type="button" class="btn" data-act="edit">Modifier</button>
      ${c.deadline || c.exam ? '<button type="button" class="btn" data-act="ics">📅 Ajouter à mon agenda</button>' : ''}</div>
    <div class="tool-card"><h2>${esc(c.title || fam.label)}</h2><p class="tool-muted">${esc(fam.label)}${c.organisme ? ` · ${esc(c.organisme)}` : ''}${c.session ? ` · session ${esc(c.session)}` : ''}</p>
      <ul class="tool-list">${row('Dépôt du dossier', c.deadline)}${row('Épreuves', c.exam)}</ul>${c.place ? `<p>📍 ${esc(c.place)}</p>` : ''}${c.notes ? `<p class="tool-muted">${esc(c.notes)}</p>` : ''}
      ${!c.deadline && !c.exam ? '<p class="tool-warn">Ajoutez les dates de l’avis (bouton Modifier) pour le compte à rebours et les rappels.</p>' : ''}</div>
    <div class="tool-card"><h2>Pièces du dossier (${c.done.filter((id) => checks.some((d) => d.id === id)).length} / ${checks.length})</h2>
      <p class="tool-muted">Liste habituelle : l'avis du concours peut en demander d'autres (ou moins). Pensez aux légalisations et aux délais (extrait de naissance et casier de moins de 3 mois).</p>
      <div class="tool-checks">${checks.map((d) => `<label><input type="checkbox" data-done="${esc(d.id)}"${c.done.includes(d.id) ? ' checked' : ''}> ${esc(d.label)}</label>`).join('')}</div>
      <div class="tool-row"><a class="btn" href="app.html">Mettre à jour mon CV daté et signé</a></div></div>
    <div class="tool-card"><h2>Épreuves à préparer</h2><ul>${fam.epreuves.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      <p class="tool-muted">Indicatif : vérifiez le programme dans l'avis. Entraînez-vous aussi à l'oral avec le <a href="entretien.html">simulateur d'entretien</a>.</p></div>
    <div class="tool-row"><button type="button" class="btn btn-primary" data-act="letter">${showLetter ? 'Masquer la lettre' : '✉️ Lettre de demande de candidature'}</button>
      <button type="button" class="btn btn-danger" data-act="delete">Supprimer ce concours</button></div></div>
    ${showLetter ? `<div class="tool-card"><p class="tool-noprint tool-muted">Relisez et complétez les passages entre crochets. Beaucoup d'avis demandent une demande <strong>manuscrite</strong> : servez-vous de ce texte comme modèle à recopier.</p>
      <div class="cc-letter" id="cc-letter">${esc(letterText(c, identity))}</div>
      <div class="tool-row tool-noprint"><button type="button" class="btn btn-primary" data-act="print">Imprimer</button><button type="button" class="btn" data-act="copy">Copier le texte</button></div></div>` : ''}`;
}

function draw() { if (editing) form(); else if (open) detail(); else home(); }

root.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k && editing) editing[k] = e.target.value; });
root.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.k === 'family' && editing) { editing.family = t.value; form(); return; }
  if (t.dataset.done && open) {
    const c = items.find((x) => x.id === open);
    c.done = t.checked ? [...new Set([...c.done, t.dataset.done])] : c.done.filter((id) => id !== t.dataset.done);
    save(); detail();
  }
});
root.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.open) { open = b.dataset.open; showLetter = false; return draw(); }
  if (b.dataset.new) { editing = cleanConcours({ family: b.dataset.new }); return draw(); }
  if (b.dataset.annonce) {
    const a = annonces.find((x) => x.id === b.dataset.annonce);
    if (!a) return;
    const c = { ...cleanConcours({ family: a.family, title: a.title, organisme: a.organisme, deadline: a.deadline, exam: a.exam, notes: [a.notes, `Avis officiel : ${a.source_url}`].filter(Boolean).join('\n') }), source: a.id };
    items = [...items, c]; save(); track('concours', c.family); open = c.id; return draw();
  }
  const c = items.find((x) => x.id === open);
  switch (b.dataset.act) {
    case 'new': editing = cleanConcours({ family: 'ena' }); break;
    case 'cancel': editing = null; break;
    case 'save': {
      const clean = cleanConcours(editing);
      if (!clean.title) { alert('Indiquez l’intitulé du concours.'); return; }
      if (!items.some((x) => x.id === clean.id)) track('concours', clean.family);
      items = [...items.filter((x) => x.id !== clean.id), { ...clean, source: items.find((x) => x.id === clean.id)?.source }];
      save(); open = clean.id; editing = null; break;
    }
    case 'back': open = null; break;
    case 'edit': editing = { ...c }; break;
    case 'letter': showLetter = !showLetter; break;
    case 'print': window.print(); return;
    case 'copy': navigator.clipboard?.writeText(letterText(c, identity)).then(() => { b.textContent = 'Texte copié ✓'; }); return;
    case 'delete':
      if (!confirm('Supprimer ce concours de votre liste ?')) return;
      items = items.filter((x) => x.id !== open); save(); open = null; break;
    case 'ics': {
      const url = URL.createObjectURL(new Blob([icsFor(c)], { type: 'text/calendar' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${(c.title || 'concours').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.ics`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    default: return;
  }
  draw();
});

draw();
