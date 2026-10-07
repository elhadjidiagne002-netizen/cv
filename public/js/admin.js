// Tableau de bord d'administration : connexion avec le compte Devizo, suivi des ventes, validation des paiements
// Wave / Orange Money, offres (4 types de pass), modèles premium ou masqués, codes, réglages, journal.
// Toutes les données viennent de /api/admin/* (session HttpOnly, SameSite=Strict).

import { TEMPLATES } from './render.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`;
const date = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');
const tplName = (id) => (TEMPLATES.find((t) => t.id === id) || { name: id }).name;

const state = { tab: 'overview', challenge: null, offers: [], kinds: {}, features: {}, orderFilter: 'pending' };

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 4000);
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(method, path, body) {
  const init = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`/api/admin/${path}`, init);
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  // « me » = simple vérification au chargement : pas de message « expirée » pour une première visite.
  if (res.status === 401 && !path.startsWith('login') && path !== 'me') {
    showLogin('Session expirée : reconnectez-vous.');
    throw new ApiError(401, 'Session expirée.');
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Erreur du serveur.');
  return data;
}

// ————————————————————————— Connexion —————————————————————————

function showLogin(message = '') {
  $('#dash-view').hidden = true;
  $('#login-view').hidden = false;
  $('#btn-logout').hidden = true;
  $('#who').textContent = '';
  $('#login-form').hidden = false;
  $('#code-form').hidden = true;
  $('#login-error').textContent = message;
  $('#login-email').focus();
}

async function showDashboard(email) {
  $('#login-view').hidden = true;
  $('#dash-view').hidden = false;
  $('#btn-logout').hidden = false;
  $('#who').textContent = `Connecté : ${email}`;
  await openTab(state.tab, false);
}

async function onLogin(e) {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const res = await api('POST', 'login', { email: $('#login-email').value, password: $('#login-password').value });
    $('#login-password').value = '';
    if (res.need_code) {
      state.challenge = res.challenge;
      $('#login-form').hidden = true;
      $('#code-form').hidden = false;
      $('#login-code-label').textContent = res.method === 'totp'
        ? 'Code à 6 chiffres de votre application d\'authentification (celle de Devizo)'
        : 'Code à 6 chiffres reçu par e-mail';
      $('#login-code').focus();
      return;
    }
    await showDashboard(res.email);
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
}

async function onCode(e) {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const res = await api('POST', 'login/code', { challenge: state.challenge, code: $('#login-code').value });
    $('#login-code').value = '';
    await showDashboard(res.email);
  } catch (err) {
    $('#login-error').textContent = err.message;
    $('#login-code').select();
  }
}

// ————————————————————————— Onglets —————————————————————————

// ——— Portfolios publics (retrait sur signalement ou abus) ———
async function renderPortfolios(panel) {
  const { portfolios } = await api('GET', 'portfolios');
  panel.innerHTML = `<p class="hint">Pages publiées par les candidats eux-mêmes (/p/…). Retirez une page signalée (contenu choquant, usurpation) : l'action est journalisée.</p>
    ${portfolios.length ? `<table class="data-table"><thead><tr><th scope="col">Adresse</th><th scope="col">Nom</th><th scope="col">Titre</th><th scope="col">Visites</th><th scope="col">Mis à jour</th><th scope="col">Action</th></tr></thead><tbody>
    ${portfolios.map((p) => `<tr><td><a href="/p/${esc(p.slug)}" target="_blank" rel="noopener">${esc(p.slug)}</a></td><td>${esc(p.name)}</td><td>${esc(p.title)}</td><td>${p.views}</td><td>${esc(String(p.updated_at).slice(0, 10))}</td>
      <td><button type="button" class="btn btn-small btn-danger" data-portfolio-delete="${esc(p.slug)}">Retirer</button></td></tr>`).join('')}</tbody></table>` : '<p>Aucun portfolio publié.</p>'}`;
  panel.querySelectorAll('[data-portfolio-delete]').forEach((b) => b.addEventListener('click', async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Retirer définitivement le portfolio « ${b.dataset.portfolioDelete} » ?`)) return;
    try { await api('POST', `portfolios/${b.dataset.portfolioDelete}/delete`, {}); toast('Portfolio retiré.'); openTab('portfolios'); } catch (err) { toast(err.message); }
  }));
}

const RENDERERS = { overview: renderOverview, orders: renderOrders, offers: renderOffers, templates: renderTemplates, codes: renderCodes, settings: renderSettings, portfolios: renderPortfolios, audit: renderAudit };

async function openTab(tab, focus = true) {
  state.tab = tab;
  document.querySelectorAll('.admin-tabs button').forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const panel = $('#panel');
  panel.innerHTML = '<p class="hint">Chargement…</p>';
  try {
    await RENDERERS[tab](panel);
  } catch (err) {
    if (err.status !== 401) panel.innerHTML = `<p class="admin-error" role="alert">${esc(err.message)}</p>`;
  }
  if (focus) panel.focus();
}

// ——— Vue d'ensemble ———

/** Histogramme d'une seule série (barres fines, infobulle native, tableau de données pour l'accessibilité). */
function barChart(title, points, unit) {
  const max = Math.max(1, ...points.map((p) => p.n));
  const w = 640;
  const h = 150;
  const pad = 24;
  const bw = Math.max(4, (w - pad) / Math.max(points.length, 1) - 2);
  const bars = points.map((p, i) => {
    const bh = Math.max(p.n ? 2 : 0, Math.round((p.n / max) * (h - pad - 6)));
    const x = pad + i * (bw + 2);
    return `<rect x="${x.toFixed(1)}" y="${h - pad - bh}" width="${bw.toFixed(1)}" height="${bh}" rx="2" class="bar"><title>${esc(day(p.day))} : ${p.n} ${unit}</title></rect>`;
  }).join('');
  const total = points.reduce((s, p) => s + p.n, 0);
  return `<figure class="chart">
    <figcaption><strong>${esc(title)}</strong> <span class="hint">— ${total} sur 30 jours (max ${max} par jour)</span></figcaption>
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)} : ${total} sur 30 jours">
      <line x1="${pad}" y1="${h - pad}" x2="${w}" y2="${h - pad}" class="axis"></line>
      <text x="${pad - 4}" y="12" class="tick" text-anchor="end">${max}</text>
      <text x="${pad - 4}" y="${h - pad}" class="tick" text-anchor="end">0</text>
      ${bars}
      <text x="${pad}" y="${h - 6}" class="tick">${esc(day(points[0] && points[0].day))}</text>
      <text x="${w}" y="${h - 6}" class="tick" text-anchor="end">${esc(day(points[points.length - 1] && points[points.length - 1].day))}</text>
    </svg>
    <details><summary>Voir les données</summary><table class="data-table"><thead><tr><th scope="col">Jour</th><th scope="col">${esc(unit)}</th></tr></thead>
      <tbody>${points.filter((p) => p.n).map((p) => `<tr><td>${esc(day(p.day))}</td><td>${p.n}</td></tr>`).join('') || '<tr><td colspan="2">Aucune donnée</td></tr>'}</tbody></table></details>
  </figure>`;
}

function last30(days, name) {
  const out = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    const row = days.find((x) => x.day === d && x.name === name);
    out.push({ day: `${d}T12:00:00Z`, n: row ? Number(row.n) : 0 });
  }
  return out;
}

async function renderOverview(panel) {
  const d = await api('GET', 'overview');
  const pendingBadge = $('#pending-badge');
  pendingBadge.hidden = !d.pending.n;
  pendingBadge.textContent = d.pending.n ? `${d.pending.n}` : '';
  const tile = (label, value, sub = '') => `<div class="tile"><span class="tile-label">${esc(label)}</span><span class="tile-value">${esc(value)}</span>${sub ? `<span class="tile-sub">${esc(sub)}</span>` : ''}</div>`;
  const top = d.top_templates;
  const topMax = Math.max(1, ...top.map((t) => t.n));
  panel.innerHTML = `
    ${d.monetization ? '' : '<p class="admin-warn">La monétisation est <strong>désactivée</strong> : tous les modèles sont gratuits. Activez-la dans « Réglages » après avoir vérifié vos offres.</p>'}
    <div class="tiles">
      ${tile('Revenus du mois', fcfa(d.revenue.month.amount), `${d.revenue.month.n} vente(s)`)}
      ${tile('Aujourd\'hui', fcfa(d.revenue.today.amount), `${d.revenue.today.n} vente(s)`)}
      ${tile('Depuis le début', fcfa(d.revenue.total.amount), `${d.revenue.total.n} vente(s)`)}
      ${tile('Paiements à vérifier', String(d.pending.n), d.pending.n ? fcfa(d.pending.amount) : 'aucun')}
      ${tile('Codes actifs', String(d.active_codes))}
    </div>
    <div class="charts">
      ${barChart('Téléchargements PDF par jour', last30(d.days, 'pdf'), 'téléchargements')}
      ${barChart('Visites de l\'éditeur par jour', last30(d.days, 'visit'), 'visites')}
    </div>
    <div class="cols-2">
      <section><h2>Modèles les plus téléchargés (30 jours)</h2>
        ${top.length ? `<ul class="hbars">${top.map((t) => `<li><span class="hbar-label">${esc(tplName(t.key))}</span>
          <span class="hbar-track" aria-hidden="true"><span class="hbar hbar-${Math.round((t.n / topMax) * 20)}"></span></span><span class="hbar-value">${t.n}</span></li>`).join('')}</ul>` : '<p class="hint">Pas encore de téléchargement enregistré.</p>'}
      </section>
      <section><h2>Ventes du mois par offre</h2>
        ${d.by_offer.length ? `<table class="data-table"><thead><tr><th scope="col">Offre</th><th scope="col">Ventes</th><th scope="col">Montant</th></tr></thead><tbody>
          ${d.by_offer.map((o) => `<tr><td>${esc(o.offer_id)}</td><td>${o.n}</td><td>${fcfa(o.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Aucune vente ce mois-ci.</p>'}
      </section>
    </div>
    <section><h2>Dernières actions</h2>${auditList(d.recent_audit)}</section>
    <p class="hint">Statistiques anonymes : compteurs par jour, sans adresse IP ni identifiant. Le contenu des CV n'est jamais envoyé au serveur.</p>`;
}

function auditList(rows) {
  if (!rows.length) return '<p class="hint">Aucune action enregistrée.</p>';
  return `<table class="data-table"><thead><tr><th scope="col">Date</th><th scope="col">Admin</th><th scope="col">Action</th><th scope="col">Objet</th><th scope="col">Détail</th></tr></thead><tbody>
    ${rows.map((a) => `<tr><td>${esc(date(a.created_at))}</td><td>${esc(a.admin)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td>${esc(a.detail)}</td></tr>`).join('')}</tbody></table>`;
}

// ——— Commandes ———

const STATUS = { pending: 'À vérifier', validated: 'Validée', refused: 'Refusée' };

async function renderOrders(panel) {
  const q = state.orderQuery || '';
  const { orders } = await api('GET', `orders?status=${state.orderFilter}&q=${encodeURIComponent(q)}`);
  panel.innerHTML = `
    <div class="toolbar">
      <div class="field"><label for="order-filter">Afficher</label>
        <select id="order-filter">${[['pending', 'À vérifier'], ['validated', 'Validées'], ['refused', 'Refusées'], ['all', 'Toutes']].map(([v, l]) => `<option value="${v}"${v === state.orderFilter ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="order-q">Rechercher (référence, téléphone, nom)</label><input type="search" id="order-q" value="${esc(q)}"></div>
      <a class="btn" href="/api/admin/orders.csv" download>Exporter pour Excel (.csv)</a>
    </div>
    <p class="hint">Vérifiez chaque paiement dans votre application Wave ou Orange Money (montant et référence) <strong>avant</strong> de valider : la validation crée le code.</p>
    ${orders.length ? `<ul class="order-list">${orders.map((o) => `<li class="order-card st-${o.status}" data-id="${esc(o.id)}">
      <div><strong class="mono">${esc(o.reference)}</strong> · ${esc(o.offer.name)}${o.template_id ? ` (${esc(tplName(o.template_id))})` : ''}
        <br><span class="amount">${esc(o.amount_label)}</span> par ${o.channel === 'wave' ? 'Wave' : 'Orange Money'} · tél. ${esc(o.phone || 'effacé')}${o.name ? ` · ${esc(o.name)}` : ''}
        <br><span class="hint">${esc(date(o.created_at))} · <span class="status">${STATUS[o.status] || esc(o.status)}</span>${o.code ? ` · code <span class="mono">${esc(o.code)}</span>` : ''}${o.note ? ` · ${esc(o.note)}` : ''}</span></div>
      ${o.status === 'pending' ? `<div class="order-actions">
        <button type="button" class="btn btn-primary btn-small" data-order="validate" data-id="${esc(o.id)}" data-ref="${esc(o.reference)}">Paiement reçu : valider</button>
        <button type="button" class="btn btn-danger btn-small" data-order="refuse" data-id="${esc(o.id)}" data-ref="${esc(o.reference)}">Refuser</button></div>` : ''}
      <div class="order-result" aria-live="polite"></div></li>`).join('')}</ul>` : '<p class="hint">Aucune commande dans cette liste.</p>'}`;
}

async function onOrdersAction(e) {
  const b = e.target.closest('button[data-order]');
  if (!b) return;
  const card = b.closest('.order-card');
  try {
    if (b.dataset.order === 'validate') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Confirmez-vous avoir reçu le paiement de la commande ${b.dataset.ref} ?`)) return;
      const r = await api('POST', `orders/${b.dataset.id}/validate`, {});
      card.querySelector('.order-actions').remove();
      card.querySelector('.order-result').innerHTML = `<p class="pay-ok">Code créé : <strong class="mono">${esc(r.code)}</strong>.
        L'acheteur peut aussi le récupérer lui-même avec « J'ai payé : vérifier ».
        ${r.whatsapp ? `<a class="btn btn-small" href="${esc(r.whatsapp)}" target="_blank" rel="noopener">Envoyer par WhatsApp</a>` : ''}
        <button type="button" class="btn btn-small" data-copy="${esc(r.message)}">Copier le message</button></p>`;
      toast(`Commande ${b.dataset.ref} validée.`);
    } else {
      // eslint-disable-next-line no-alert
      const note = window.prompt(`Motif du refus de la commande ${b.dataset.ref} (visible par l'acheteur) :`, 'Paiement non reçu');
      if (note === null) return;
      await api('POST', `orders/${b.dataset.id}/refuse`, { note });
      toast(`Commande ${b.dataset.ref} refusée.`);
      await openTab('orders');
    }
  } catch (err) {
    toast(err.message);
  }
}

// ——— Offres ———

function offerForm(o = {}) {
  const kinds = Object.entries(state.kinds);
  const f = (id) => `offer-${id}-${o.id || 'new'}`;
  return `<form class="offer-form" data-offer="${esc(o.id || '')}" novalidate>
    <div class="grid">
      <div class="field"><label for="${f('name')}">Nom</label><input id="${f('name')}" name="name" value="${esc(o.name || '')}" required></div>
      <div class="field"><label for="${f('kind')}">Type de pass</label><select id="${f('kind')}" name="kind">${kinds.map(([k, l]) => `<option value="${k}"${k === o.kind ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label for="${f('price')}">Prix (FCFA)</label><input id="${f('price')}" name="price" type="number" min="0" step="50" value="${esc(o.price ?? 1000)}"></div>
      <div class="field"><label for="${f('days')}">Durée (jours, 0 = illimitée)</label><input id="${f('days')}" name="days" type="number" min="0" value="${esc(o.days ?? 30)}"></div>
      <div class="field"><label for="${f('credits')}">Téléchargements (type « crédits »)</label><input id="${f('credits')}" name="credits" type="number" min="0" value="${esc(o.credits ?? 0)}"></div>
      <div class="field"><label for="${f('sort')}">Ordre d'affichage</label><input id="${f('sort')}" name="sort" type="number" value="${esc(o.sort ?? 0)}"></div>
      <div class="field field-wide"><label for="${f('description')}">Description (vue par les candidats)</label><input id="${f('description')}" name="description" value="${esc(o.description || '')}"></div>
      <div class="field field-check"><input type="checkbox" id="${f('word')}" name="word"${(o.features || []).includes('word') ? ' checked' : ''}><label for="${f('word')}">Inclut l'export Word des modèles premium</label></div>
      <div class="field field-check"><input type="checkbox" id="${f('active')}" name="active"${o.active ? ' checked' : ''}><label for="${f('active')}">Proposée à la vente</label></div>
    </div>
    <div class="order-actions">
      <button type="submit" class="btn btn-primary btn-small">${o.id ? 'Enregistrer' : 'Créer l\'offre'}</button>
      ${o.id ? `<button type="button" class="btn btn-danger btn-small" data-offer-delete="${esc(o.id)}">Supprimer</button>` : ''}
    </div>
  </form>`;
}

async function renderOffers(panel) {
  const d = await api('GET', 'offers');
  state.offers = d.offers;
  state.kinds = d.kinds;
  state.features = d.features;
  panel.innerHTML = `
    <p class="hint">Quatre types de pass : <strong>à durée</strong> (tous les modèles premium pendant N jours), <strong>à l'unité</strong> (un modèle choisi, pour toujours),
      <strong>crédits</strong> (N téléchargements) et <strong>abonnement</strong> (même code prolongé à chaque paiement, dans « Codes »). Seules les offres « proposées à la vente » apparaissent aux candidats.</p>
    <ul class="offer-admin-list">${d.offers.map((o) => `<li><details${o.active ? '' : ''}><summary><strong>${esc(o.name)}</strong> — ${fcfa(o.price)} · ${esc((d.kinds[o.kind] || '').split(' (')[0])} · ${o.active ? '<span class="on">en vente</span>' : '<span class="off">hors vente</span>'}</summary>${offerForm(o)}</details></li>`).join('')}</ul>
    <details class="new-offer"><summary><strong>+ Nouvelle offre</strong></summary>${offerForm({ active: false, kind: 'pass', features: ['word'] })}</details>`;
}

async function onOfferSubmit(e) {
  const form = e.target.closest('form.offer-form');
  if (!form) return;
  e.preventDefault();
  const v = (n) => form.elements[n];
  const body = {
    name: v('name').value, kind: v('kind').value, price: Number(v('price').value), days: Number(v('days').value), credits: Number(v('credits').value),
    sort: Number(v('sort').value), description: v('description').value, active: v('active').checked, features: v('word').checked ? ['word'] : [], templates: ['*'],
  };
  try {
    const id = form.dataset.offer;
    await api(id ? 'PUT' : 'POST', id ? `offers/${id}` : 'offers', body);
    toast(id ? 'Offre enregistrée.' : 'Offre créée.');
    await openTab('offers');
  } catch (err) {
    toast(err.message);
  }
}

// ——— Modèles ———

async function renderTemplates(panel) {
  const { settings } = await api('GET', 'settings');
  const premium = new Set(settings.premium_templates);
  const hidden = new Set(settings.hidden_templates);
  const families = [...new Set(TEMPLATES.map((t) => t.category))];
  panel.innerHTML = `
    <p class="hint">« Premium » : le modèle s'essaie librement mais son téléchargement demande un pass (si la monétisation est activée).
      « Masqué » : le modèle n'apparaît plus dans la galerie (les CV qui l'utilisent déjà le gardent).</p>
    <form id="tpl-form">
      ${families.map((fam) => `<fieldset class="tpl-fam"><legend>${esc(fam)}</legend><table class="data-table"><thead><tr><th scope="col">Modèle</th><th scope="col">Premium</th><th scope="col">Masqué</th></tr></thead><tbody>
        ${TEMPLATES.filter((t) => t.category === fam).map((t) => `<tr><th scope="row">${esc(t.name)} <span class="hint">${t.ats ? '· ATS' : ''}</span></th>
          <td><input type="checkbox" name="premium" value="${t.id}" aria-label="${esc(t.name)} premium"${premium.has(t.id) ? ' checked' : ''}></td>
          <td><input type="checkbox" name="hidden" value="${t.id}" aria-label="${esc(t.name)} masqué"${hidden.has(t.id) ? ' checked' : ''}></td></tr>`).join('')}
      </tbody></table></fieldset>`).join('')}
      <button type="submit" class="btn btn-primary">Enregistrer les modèles</button>
    </form>`;
}

async function onTemplatesSubmit(e) {
  if (e.target.id !== 'tpl-form') return;
  e.preventDefault();
  const values = (name) => [...e.target.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  try {
    await api('PUT', 'settings', { premium_templates: values('premium'), hidden_templates: values('hidden') });
    toast('Modèles enregistrés.');
  } catch (err) {
    toast(err.message);
  }
}

// ——— Codes ———

async function renderCodes(panel) {
  if (!state.offers.length) {
    const d = await api('GET', 'offers');
    state.offers = d.offers;
    state.kinds = d.kinds;
  }
  const q = state.codeQuery || '';
  const { codes } = await api('GET', `codes?q=${encodeURIComponent(q)}`);
  const premiumTpls = TEMPLATES;
  panel.innerHTML = `
    <details class="new-offer"><summary><strong>+ Offrir un code</strong> (partenariat, geste commercial, vente hors ligne)</summary>
      <form id="gift-form" class="grid" novalidate>
        <div class="field"><label for="gift-offer">Offre</label><select id="gift-offer">${state.offers.map((o) => `<option value="${esc(o.id)}" data-kind="${esc(o.kind)}">${esc(o.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="gift-tpl">Modèle (offre « à l'unité »)</label><select id="gift-tpl">${premiumTpls.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field field-wide"><label for="gift-note">Note interne</label><input id="gift-note" placeholder="Ex. : Partenariat lycée Blaise Diagne"></div>
        <div><button type="submit" class="btn btn-primary btn-small">Créer le code</button></div>
        <p class="field-wide" id="gift-result" aria-live="polite"></p>
      </form>
    </details>
    <div class="toolbar"><div class="field"><label for="code-q">Rechercher un code ou une note</label><input type="search" id="code-q" value="${esc(q)}"></div></div>
    ${codes.length ? `<table class="data-table codes-table"><thead><tr><th scope="col">Code</th><th scope="col">Offre</th><th scope="col">Portée</th><th scope="col">Échéance</th><th scope="col">Crédits</th><th scope="col">État</th><th scope="col">Actions</th></tr></thead><tbody>
      ${codes.map((c) => `<tr><td class="mono">${esc(c.code)}<br><span class="hint">${esc(c.note)}</span></td><td>${esc(c.offer_name)}</td>
        <td>${c.templates.includes('*') ? 'Tous les premium' : esc(c.templates.map(tplName).join(', '))}${c.features.includes('word') ? ' + Word' : ''}</td>
        <td>${esc(day(c.expires_at))}</td><td>${c.credits === null ? '∞' : c.credits}</td>
        <td>${c.state.valid ? '<span class="on">valide</span>' : `<span class="off">${esc(c.state.reason)}</span>`}<br><span class="hint">${c.uses} utilisation(s)</span></td>
        <td class="order-actions">
          <button type="button" class="btn btn-small" data-code-act="extend" data-code="${esc(c.code)}" aria-label="Prolonger ${esc(c.code)}">Prolonger</button>
          ${c.revoked ? `<button type="button" class="btn btn-small" data-code-act="restore" data-code="${esc(c.code)}" aria-label="Réactiver ${esc(c.code)}">Réactiver</button>`
            : `<button type="button" class="btn btn-small btn-danger" data-code-act="revoke" data-code="${esc(c.code)}" aria-label="Désactiver ${esc(c.code)}">Désactiver</button>`}
        </td></tr>`).join('')}</tbody></table>` : '<p class="hint">Aucun code.</p>'}`;
}

async function onCodesAction(e) {
  const b = e.target.closest('button[data-code-act]');
  if (!b) return;
  const { codeAct, code } = b.dataset;
  try {
    if (codeAct === 'extend') {
      // eslint-disable-next-line no-alert
      const answer = window.prompt(`Prolonger ${code} : nombre de jours à ajouter (renouvellement d'abonnement : 30), ou « +N » pour ajouter N téléchargements.`, '30');
      if (answer === null) return;
      const body = answer.trim().startsWith('+') ? { credits: Number(answer.trim().slice(1)) } : { days: Number(answer) };
      await api('POST', `codes/${code}/extend`, body);
      toast(`Code ${code} prolongé.`);
    } else {
      await api('POST', `codes/${code}/${codeAct}`, {});
      toast(codeAct === 'revoke' ? `Code ${code} désactivé.` : `Code ${code} réactivé.`);
    }
    await openTab('codes');
  } catch (err) {
    toast(err.message);
  }
}

async function onGiftSubmit(e) {
  if (e.target.id !== 'gift-form') return;
  e.preventDefault();
  try {
    const r = await api('POST', 'codes', { offer_id: $('#gift-offer').value, template_id: $('#gift-tpl').value, note: $('#gift-note').value });
    $('#gift-result').innerHTML = `Code créé : <strong class="mono">${esc(r.code)}</strong> <button type="button" class="btn btn-small" data-copy="${esc(r.code)}">Copier</button>`;
  } catch (err) {
    toast(err.message);
  }
}

// ——— Réglages ———

async function renderSettings(panel) {
  const { settings: s } = await api('GET', 'settings');
  panel.innerHTML = `<form id="settings-form" class="settings-form" novalidate>
    <fieldset><legend>Monétisation</legend>
      <div class="field-check"><input type="checkbox" id="set-money"${s.monetization ? ' checked' : ''}><label for="set-money"><strong>Activer les modèles premium et la vente de pass</strong></label></div>
      <p class="hint">Désactivée : tous les modèles sont gratuits. Activez-la après avoir vérifié les offres, les modèles premium et les numéros de paiement.</p>
    </fieldset>
    <fieldset><legend>Paiement (validation manuelle)</legend>
      <div class="grid">
        <div class="field"><label for="set-wave">Numéro Wave (vide = pas de Wave)</label><input id="set-wave" value="${esc(s.payment.wave)}" placeholder="+221 77 000 00 00"></div>
        <div class="field"><label for="set-om">Numéro Orange Money (vide = pas d'Orange Money)</label><input id="set-om" value="${esc(s.payment.orange_money)}" placeholder="+221 78 000 00 00"></div>
        <div class="field field-wide"><label for="set-instr">Instructions affichées après la commande</label><textarea id="set-instr" rows="3">${esc(s.payment.instructions)}</textarea></div>
      </div>
    </fieldset>
    <fieldset><legend>Communication</legend>
      <div class="field"><label for="set-announce">Annonce en haut de l'éditeur (vide = aucune)</label><input id="set-announce" value="${esc(s.announcement)}" placeholder="Ex. : Promotion Tabaski : pass 30 jours à 1 500 FCFA"></div>
    </fieldset>
    <fieldset><legend>Données personnelles</legend>
      <div class="field"><label for="set-days">Effacer le téléphone et le nom des acheteurs après (jours)</label><input id="set-days" type="number" min="30" max="3650" value="${esc(s.order_days_kept)}"></div>
    </fieldset>
    <button type="submit" class="btn btn-primary">Enregistrer les réglages</button>
  </form>`;
}

async function onSettingsSubmit(e) {
  if (e.target.id !== 'settings-form') return;
  e.preventDefault();
  try {
    await api('PUT', 'settings', {
      monetization: $('#set-money').checked,
      payment: { wave: $('#set-wave').value, orange_money: $('#set-om').value, instructions: $('#set-instr').value },
      announcement: $('#set-announce').value,
      order_days_kept: Number($('#set-days').value),
    });
    toast('Réglages enregistrés.');
  } catch (err) {
    toast(err.message);
  }
}

async function renderAudit(panel) {
  const { audit } = await api('GET', 'audit');
  panel.innerHTML = `<p class="hint">Toutes les actions de l'administration (connexions, validations, offres, codes, réglages).</p>${auditList(audit)}`;
}

// ————————————————————————— Démarrage —————————————————————————

function bind() {
  $('#login-form').addEventListener('submit', onLogin);
  $('#code-form').addEventListener('submit', onCode);
  $('#btn-logout').addEventListener('click', async () => {
    await api('POST', 'logout', {}).catch(() => {});
    showLogin('Vous êtes déconnecté.');
  });
  document.querySelector('.admin-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) openTab(b.dataset.tab);
  });
  const panel = $('#panel');
  panel.addEventListener('click', (e) => {
    onOrdersAction(e);
    onCodesAction(e);
    const copy = e.target.closest('button[data-copy]');
    if (copy) navigator.clipboard.writeText(copy.dataset.copy).then(() => toast('Copié.'), () => toast('Copie impossible : sélectionnez le texte.'));
    const del = e.target.closest('button[data-offer-delete]');
    if (del) {
      // eslint-disable-next-line no-alert
      if (!window.confirm('Supprimer cette offre ? (Si elle a déjà été vendue, elle sera seulement retirée de la vente.)')) return;
      api('DELETE', `offers/${del.dataset.offerDelete}`).then(() => openTab('offers'), (err) => toast(err.message));
    }
  });
  panel.addEventListener('submit', (e) => {
    onOfferSubmit(e);
    onTemplatesSubmit(e);
    onGiftSubmit(e);
    onSettingsSubmit(e);
  });
  panel.addEventListener('change', (e) => {
    if (e.target.id === 'order-filter') {
      state.orderFilter = e.target.value;
      openTab('orders', false).then(() => $('#order-filter').focus());
    }
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'order-q') {
      e.preventDefault();
      state.orderQuery = e.target.value;
      openTab('orders', false).then(() => $('#order-q').focus());
    } else if (e.target.id === 'code-q') {
      e.preventDefault();
      state.codeQuery = e.target.value;
      openTab('codes', false).then(() => $('#code-q').focus());
    }
  });
}

async function init() {
  bind();
  try {
    const me = await api('GET', 'me');
    await showDashboard(me.email);
  } catch (err) {
    showLogin(err.status === 401 ? '' : err.message);
  }
}

init();
