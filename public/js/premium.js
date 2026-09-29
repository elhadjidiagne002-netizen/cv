// Offres payantes côté candidat : configuration du site (modèles premium, offres, paiement Wave / Orange Money),
// codes de déblocage enregistrés dans ce navigateur, droits par modèle, statistiques anonymes.
// Sans serveur configuré (ou hors connexion sans configuration connue), TOUT est gratuit.
// Le contenu des CV n'est jamais envoyé : seuls le code, la référence de commande et le numéro de paiement le sont.

const CONFIG_KEY = 'cvapp.v1.siteConfig';
const ENT_KEY = 'cvapp.v1.entitlements';
const ORDERS_KEY = 'cvapp.v1.orders';

export const FREE_CONFIG = { configured: false, monetization: false, premium_templates: [], hidden_templates: [], offers: [], announcement: '', payment: {} };

function read(storage, key, fallback) {
  try {
    const v = JSON.parse(storage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou indisponible : sans conséquence grave (le code reste valable côté serveur) */
  }
}

/** Configuration du site ; en cas d'échec réseau, la dernière connue (sinon : tout gratuit). */
export async function loadConfig({ fetchImpl = globalThis.fetch, storage = globalThis.localStorage } = {}) {
  try {
    const res = await fetchImpl('/api/config', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const cfg = { ...FREE_CONFIG, ...(await res.json()) };
    write(storage, CONFIG_KEY, cfg);
    return cfg;
  } catch {
    return { ...FREE_CONFIG, ...read(storage, CONFIG_KEY, {}) };
  }
}

export const isPremium = (cfg, templateId) => Boolean(cfg && cfg.monetization && cfg.premium_templates.includes(templateId));
export const isHidden = (cfg, templateId) => Boolean(cfg && cfg.hidden_templates && cfg.hidden_templates.includes(templateId));

/** Plus petit prix des offres actives (« dès 500 FCFA »). */
export function cheapest(cfg) {
  const prices = (cfg.offers || []).map((o) => o.price).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`;

// ——— Codes enregistrés (« mes pass ») ———

export function listEntitlements(storage = globalThis.localStorage) {
  const list = read(storage, ENT_KEY, []);
  return Array.isArray(list) ? list.filter((e) => e && typeof e.code === 'string') : [];
}

export function saveEntitlement(ent, storage = globalThis.localStorage) {
  const list = listEntitlements(storage).filter((e) => e.code !== ent.code);
  list.push(ent);
  write(storage, ENT_KEY, list);
  return list;
}

export function removeEntitlement(code, storage = globalThis.localStorage) {
  write(storage, ENT_KEY, listEntitlements(storage).filter((e) => e.code !== code));
}

/** Un code est-il encore utilisable (d'après ce que le serveur a renvoyé la dernière fois) ? */
export function usable(ent, now = new Date().toISOString()) {
  if (!ent || ent.valid === false) return false;
  if (ent.expires_at && ent.expires_at < now) return false;
  if (ent.credits !== null && ent.credits !== undefined && ent.credits <= 0) return false;
  return true;
}

const covers = (ent, templateId, format) => (ent.templates.includes('*') || ent.templates.includes(templateId))
  && (format !== 'docx' || ent.kind === 'template' || (ent.features || []).includes('word'));

/**
 * Droit de télécharger `templateId` au format `format` ('pdf' | 'docx').
 * Renvoie { free: true } (modèle gratuit), { ent, consume } (code qui couvre ; consume = décompter un crédit)
 * ou null (déblocage nécessaire). Les codes illimités passent avant les codes à crédits.
 */
export function access(cfg, templateId, format = 'pdf', entitlements = [], now = new Date().toISOString()) {
  if (!isPremium(cfg, templateId)) return { free: true };
  const ok = entitlements.filter((e) => usable(e, now) && covers(e, templateId, format));
  const unlimited = ok.find((e) => e.credits === null || e.credits === undefined);
  if (unlimited) return { ent: unlimited, consume: false };
  const credit = ok.sort((a, b) => a.credits - b.credits)[0];
  return credit ? { ent: credit, consume: true } : null;
}

// ——— Commandes en cours (référence + numéro, pour vérifier le paiement plus tard) ———

export function listOrders(storage = globalThis.localStorage) {
  const list = read(storage, ORDERS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveOrder(order, storage = globalThis.localStorage) {
  write(storage, ORDERS_KEY, [...listOrders(storage).filter((o) => o.reference !== order.reference), order].slice(-10));
}

export function forgetOrder(reference, storage = globalThis.localStorage) {
  write(storage, ORDERS_KEY, listOrders(storage).filter((o) => o.reference !== reference));
}

// ——— Appels au serveur ———

async function post(path, body, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || 'Service indisponible : vérifiez votre connexion.');
  return data;
}

export const createOrder = (body, f) => post('/api/orders', body, f);
export const orderStatus = (reference, phone, f) => post('/api/orders/status', { reference, phone }, f);
export const redeemCode = (code, f) => post('/api/codes/redeem', { code: String(code || '').trim() }, f);
export const consumeCode = (code, templateId, format, f) => post('/api/codes/consume', { code, template_id: templateId, format }, f);

/** Statistique anonyme (compteur du jour, sans identifiant) ; silencieuse en cas d'échec. */
export function track(name, key = '') {
  try {
    const body = new Blob([JSON.stringify({ name, key })], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon('/api/events', body)) return;
    fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, key }), keepalive: true }).catch(() => {});
  } catch {
    /* hors ligne ou navigateur ancien : rien à faire */
  }
}
