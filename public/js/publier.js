// Page « Portfolio en ligne » : choisir ce qui devient public, voir l'aperçu, publier / mettre à jour / supprimer.
// La clé de modification est gardée dans ce navigateur (localStorage) : la perdre = ne plus pouvoir modifier
// (on peut toujours en publier un nouveau ; l'administration retire une page sur demande).
import { createStore } from './storage.js';
import { PF_KEY, COLORS, SECTIONS, cvToPortfolio, suggestSlug, publicFields, portfolioBody, colorClass } from './portfolio-core.js';

const root = document.getElementById('pf-app');
const store = createStore();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readSaved = () => { try { return JSON.parse(localStorage.getItem(PF_KEY) || 'null'); } catch { return null; } };
const writeSaved = (v) => { try { if (v) localStorage.setItem(PF_KEY, JSON.stringify(v)); else localStorage.removeItem(PF_KEY); } catch { /* stockage plein */ } };

async function api(path, { method = 'GET', body, key } = {}) {
  let res;
  try {
    res = await fetch(path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(key ? { 'x-portfolio-key': key } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Pas de connexion internet : la publication a besoin du réseau.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const list = store.list();
let saved = readSaved();
let cv = list.length ? store.load((saved && list.some((c) => c.id === saved.cvId) ? saved.cvId : list[0].id)) : null;
const choices = { sections: new Set(SECTIONS.map(([k]) => k)), email: false, whatsapp: false, linkedin: true, website: true, city: true, color: (saved && saved.color) || COLORS[0] };
let slug = saved?.slug || (cv ? suggestSlug(cv) : '');
let status = null;

function draw() {
  if (!cv) {
    root.innerHTML = `<div class="tool-card"><p>Commencez par créer votre CV : le portfolio reprend ses informations.</p><a class="btn btn-primary" href="app.html">Créer mon CV</a></div>`;
    return;
  }
  const data = cvToPortfolio(cv, choices);
  const pub = publicFields(data);
  root.innerHTML = `
    ${saved ? `<div class="tool-card tool-ok"><p class="tool-big">Votre portfolio est en ligne : <a href="/p/${esc(saved.slug)}" target="_blank" rel="noopener">${esc(location.host)}/p/${esc(saved.slug)}</a></p>
      <div class="tool-row"><button type="button" class="btn" id="pf-copy">Copier le lien</button>
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(`Mon portfolio : ${location.origin}/p/${saved.slug}`)}" target="_blank" rel="noopener">Partager sur WhatsApp</a>
      <button type="button" class="btn btn-danger" id="pf-delete">Supprimer la page</button></div></div>` : ''}
    <div class="tool-card">
      ${list.length > 1 ? `<div class="field"><label for="pf-cv">CV utilisé</label><select id="pf-cv">${list.map((c) => `<option value="${esc(c.id)}"${c.id === cv.id ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></div>` : ''}
      <h2>Rubriques publiées</h2>
      <div class="tool-checks">${SECTIONS.map(([k, l]) => `<label><input type="checkbox" data-sec="${k}"${choices.sections.has(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>
      <h2>Coordonnées publiques <span class="tool-muted">(rien n'est publié sans case cochée)</span></h2>
      <div class="tool-checks">
        ${[['city', `Ville${cv.identity.city ? ` (${cv.identity.city})` : ''}`], ['email', `E-mail${cv.identity.email ? ` (${cv.identity.email})` : ''}`], ['whatsapp', `Numéro WhatsApp${cv.identity.phone ? ` (${cv.identity.phone})` : ''}`],
          ['linkedin', 'LinkedIn'], ['website', 'Site web']].map(([k, l]) => `<label><input type="checkbox" data-c="${k}"${choices[k] ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
      </div>
      <h2>Couleur</h2>
      <div class="tool-row">${COLORS.map((c, i) => `<button type="button" class="tool-color c${i}" data-color="${c}" aria-label="Couleur ${i + 1}" aria-pressed="${c === choices.color}"></button>`).join('')}</div>
      ${saved ? '' : `<h2>Adresse de la page</h2>
      <div class="field"><label for="pf-slug">cv.nexusmarket.sn/p/</label><input id="pf-slug" value="${esc(slug)}" maxlength="40" autocomplete="off" spellcheck="false"><p class="hint" id="pf-slug-hint">3 à 40 lettres minuscules, chiffres ou tirets.</p></div>`}
      <h2>Aperçu</h2>
      <div class="tool-preview"><div class="pf ${colorClass(data.color)}">${data.name ? portfolioBody(data) : '<p class="tool-warn">Ajoutez votre nom dans le CV.</p>'}</div></div>
      <p class="tool-muted">Sera public : ${esc(pub.join(', '))}. Jamais publié : photo, adresse, date de naissance, nationalité, situation familiale, références.</p>
      ${saved ? '' : `<label class="tool-row"><input type="checkbox" id="pf-consent"> J'accepte que ces informations soient publiques, visibles par toute personne qui a le lien (et par les moteurs de recherche).</label>`}
      <div class="tool-row"><button type="button" class="btn btn-primary" id="pf-publish">${saved ? 'Mettre à jour la page' : 'Publier mon portfolio'}</button></div>
      ${status ? `<p class="${status.ok ? 'tool-ok' : 'tool-err'}" role="status">${esc(status.text)}</p>` : ''}
    </div>
    ${saved ? `<details class="tool-card"><summary>Clé de modification (changement d'appareil)</summary><p class="tool-muted">Gardez cette clé si vous changez de téléphone : elle seule permet de modifier ou supprimer la page.</p>
      <p class="tool-key">${esc(saved.key)}</p></details>` : `<details class="tool-card"><summary>J'ai déjà un portfolio (autre appareil)</summary>
      <div class="tool-grid"><div class="field"><label for="pf-old-slug">Adresse</label><input id="pf-old-slug"></div><div class="field"><label for="pf-old-key">Clé de modification</label><input id="pf-old-key"></div></div>
      <div class="tool-row"><button type="button" class="btn" id="pf-restore">Retrouver mon portfolio</button></div></details>`}`;
}

root.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.sec) { t.checked ? choices.sections.add(t.dataset.sec) : choices.sections.delete(t.dataset.sec); draw(); }
  else if (t.dataset.c) { choices[t.dataset.c] = t.checked; draw(); }
  else if (t.id === 'pf-cv') { cv = store.load(t.value); if (!saved) slug = suggestSlug(cv); draw(); }
});
let slugTimer = null;
root.addEventListener('input', (e) => {
  if (e.target.id !== 'pf-slug') return;
  slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  clearTimeout(slugTimer);
  slugTimer = setTimeout(async () => {
    const hint = document.getElementById('pf-slug-hint');
    try { const r = await api(`/api/portfolios/check/${encodeURIComponent(slug || '-')}`); if (hint) hint.textContent = r.available ? '✓ Adresse disponible.' : r.reason; } catch { /* hors ligne */ }
  }, 400);
});
root.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.color) { choices.color = b.dataset.color; draw(); return; }
  if (b.id === 'pf-copy') { navigator.clipboard?.writeText(`${location.origin}/p/${saved.slug}`).then(() => { b.textContent = 'Lien copié ✓'; }); return; }
  if (b.id === 'pf-publish') {
    const data = cvToPortfolio(cv, choices);
    b.disabled = true;
    try {
      if (saved) {
        await api(`/api/portfolios/${encodeURIComponent(saved.slug)}`, { method: 'PUT', body: { data }, key: saved.key });
        saved = { ...saved, color: choices.color, cvId: cv.id };
        status = { ok: true, text: 'Page mise à jour.' };
      } else {
        if (!document.getElementById('pf-consent')?.checked) throw new Error('Cochez la case d’accord avant de publier.');
        const r = await api('/api/portfolios', { method: 'POST', body: { slug, data, consent: true } });
        saved = { slug: r.slug, key: r.key, cvId: cv.id, color: choices.color };
        status = { ok: true, text: 'Portfolio publié ! Gardez la clé de modification si vous changez d’appareil.' };
      }
      writeSaved(saved);
    } catch (err) { status = { ok: false, text: err.message }; }
    draw();
    return;
  }
  if (b.id === 'pf-delete') {
    if (!confirm('Supprimer définitivement votre page portfolio ? Le lien ne marchera plus.')) return;
    try { await api(`/api/portfolios/${encodeURIComponent(saved.slug)}`, { method: 'DELETE', key: saved.key }); saved = null; writeSaved(null); status = { ok: true, text: 'Page supprimée.' }; } catch (err) { status = { ok: false, text: err.message }; }
    draw();
    return;
  }
  if (b.id === 'pf-restore') {
    const s = document.getElementById('pf-old-slug').value.trim().toLowerCase().replace(/^.*\/p\//, '');
    const k = document.getElementById('pf-old-key').value.trim();
    try { await api(`/api/portfolios/${encodeURIComponent(s)}`, { key: k }); saved = { slug: s, key: k, cvId: cv.id, color: choices.color }; writeSaved(saved); status = { ok: true, text: 'Portfolio retrouvé : vous pouvez le mettre à jour.' }; } catch (err) { status = { ok: false, text: err.message }; }
    draw();
  }
});

draw();
