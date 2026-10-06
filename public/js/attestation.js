// Page « Attestation » : formulaire → aperçu A4 en direct → impression (texte réel, PDF par le navigateur).
// Brouillon gardé dans ce navigateur (localStorage) pour délivrer la suivante plus vite.
import { TYPES, CONTRATS, clean, checks, paragraphs, dateFr, fileName } from './attestation-core.js';

const KEY = 'cv-attestation-brouillon';
const form = document.getElementById('att-form');
const doc = document.getElementById('att-doc');
const missing = document.getElementById('att-missing');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = new Date().toISOString().slice(0, 10);

let data;
try { data = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { data = clean({}); }
if (!data.date) data.date = today;

const F = (path, label, attrs = '', hint = '') => {
  const id = `a-${path.replace(/\./g, '-')}`;
  return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" data-path="${path}" ${attrs}>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
};
const get = (path) => path.split('.').reduce((o, k) => (o ? o[k] : ''), data);

function build() {
  const t = data.type;
  form.innerHTML = `
    <fieldset class="att-types"><legend>Type</legend>${Object.entries(TYPES).map(([k, v]) => `<label class="att-chip"><input type="radio" name="type" value="${k}"${k === t ? ' checked' : ''}> ${esc(v.label)}</label>`).join('')}</fieldset>
    <h2>L'employeur / l'organisme</h2>
    <div class="grid">${F('employer.name', 'Raison sociale')}${F('employer.address', 'Adresse')}${F('employer.ninea', 'NINEA (facultatif)')}${F('employer.phone', 'Téléphone (facultatif)', 'inputmode="tel"')}</div>
    <div class="grid">${F('signer.name', 'Nom du signataire')}${F('signer.role', 'Qualité du signataire', 'placeholder="Directeur général, Gérant, Responsable RH…"')}</div>
    <h2>${t === 'stage' ? 'Le stagiaire' : t === 'formation' ? 'Le participant' : 'Le salarié'}</h2>
    <div class="grid">
      <div class="field"><label for="a-civ">Civilité</label><select id="a-civ" data-path="person.civ"><option value="">—</option><option value="M."${data.person.civ === 'M.' ? ' selected' : ''}>M.</option><option value="Mme"${data.person.civ === 'Mme' ? ' selected' : ''}>Mme</option></select></div>
      ${F('person.name', 'Prénom(s) et nom')}${F('person.birth', 'Date de naissance (facultatif)', 'type="date"')}${F('person.birthPlace', 'Lieu de naissance (facultatif)')}${F('person.id', 'N° de pièce d’identité (facultatif)')}
    </div>
    <h2>${t === 'formation' ? 'La formation' : t === 'stage' ? 'Le stage' : 'L’emploi'}</h2>
    <div class="grid">
      ${t === 'formation' ? `${F('course', 'Intitulé de la formation')}${F('hours', 'Durée (heures)', 'inputmode="numeric"')}${F('result', 'Résultat (facultatif)', 'placeholder="Validée, avec mention Bien…"')}` : F('job', t === 'stage' ? 'Poste / service (facultatif)' : 'Poste occupé')}
      ${t === 'travail' ? `<div class="field"><label for="a-contract">Contrat (facultatif)</label><select id="a-contract" data-path="contract"><option value="">—</option>${CONTRATS.map((c) => `<option${data.contract === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>` : ''}
      ${t === 'stage' ? F('school', 'Établissement du stagiaire (facultatif)') : ''}
      ${F('start', 'Date de début', 'type="date"')}${F('end', 'Date de fin', 'type="date"')}
    </div>
    ${t === 'travail' ? `<label class="field-check"><input type="checkbox" data-path="ongoing"${data.ongoing ? ' checked' : ''}> Toujours en poste (attestation « est employé depuis »)</label>` : ''}
    ${t === 'stage' ? `<div class="field"><label for="a-missions">Missions réalisées (facultatif)</label><textarea id="a-missions" data-path="missions" rows="3"></textarea></div>` : ''}
    <div class="grid">${F('place', 'Fait à', 'placeholder="Dakar"')}${F('date', 'Le', 'type="date"')}</div>
    <p class="hint">Les informations facultatives (naissance, pièce d’identité) ne sont à indiquer que si le destinataire les demande.</p>`;
  for (const el of form.querySelectorAll('[data-path]')) {
    const v = get(el.dataset.path);
    if (el.type === 'checkbox') el.checked = Boolean(v); else if (el.tagName !== 'SELECT') el.value = v || '';
  }
}

function render() {
  const a = clean(data);
  const errs = checks(a);
  missing.textContent = errs.length ? `À compléter : ${errs.join(' · ')}` : 'Prêt à imprimer, signer et tamponner.';
  document.getElementById('att-print').disabled = errs.length > 0;
  doc.innerHTML = `
    <header class="att-head"><strong>${esc(a.employer.name || '[Raison sociale]')}</strong>${a.employer.address ? `<br>${esc(a.employer.address)}` : ''}${a.employer.phone ? `<br>Tél. ${esc(a.employer.phone)}` : ''}${a.employer.ninea ? `<br>NINEA ${esc(a.employer.ninea)}` : ''}</header>
    <h1 class="att-title">${TYPES[a.type].title}</h1>
    ${(a.person.name && a.signer.name && a.start ? paragraphs(a) : ['Remplissez le formulaire : le texte de l’attestation apparaît ici.']).map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="att-date">Fait à ${esc(a.place || '…………')}, le ${esc(dateFr(a.date) || '…………')}</p>
    <div class="att-sign"><p>${esc(a.signer.name || '')}${a.signer.role ? `<br>${esc(a.signer.role)}` : ''}</p><p class="att-sign-space">Signature et cachet</p></div>`;
}

function set(path, value) {
  const keys = path.split('.');
  let o = data;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]] = value;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* navigation privée */ }
  render();
}

function onEdit(e) {
  const el = e.target;
  if (el.name === 'type') { if (data.type !== el.value) { data.type = el.value; build(); render(); } return; }
  if (el.dataset.path) set(el.dataset.path, el.type === 'checkbox' ? el.checked : el.value);
}
form.addEventListener('input', onEdit);
form.addEventListener('change', onEdit); // listes déroulantes, cases et dates sur certains téléphones
document.getElementById('att-print').addEventListener('click', () => {
  const prev = document.title;
  document.title = fileName(clean(data));
  window.print();
  setTimeout(() => { document.title = prev; }, 500);
});

build();
render();
