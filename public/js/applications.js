// Suivi des candidatures, conservé dans le navigateur (comme les CV) : entreprise, poste, date d'envoi,
// canal, statut, relance prévue, contact, notes. Signale les relances dues et s'exporte en CSV (Excel).
// Module pur : le stockage est injectable (tests sous Node).

import { uid } from './model.js';

export const STATUSES = [
  { id: 'a-envoyer', label: 'À envoyer' },
  { id: 'envoyee', label: 'Envoyée' },
  { id: 'relancee', label: 'Relancée' },
  { id: 'entretien', label: 'Entretien prévu' },
  { id: 'offre', label: 'Offre reçue' },
  { id: 'refus', label: 'Refus' },
  { id: 'abandon', label: 'Abandonnée' },
];

export const CHANNELS = ['E-mail', 'Plateforme en ligne', 'Dépôt en main propre', 'Courrier', 'WhatsApp', 'Recommandation', 'Salon / forum emploi'];

/** Délai usuel avant une relance (jours) après l'envoi, et après une première relance. */
export const FOLLOW_UP_DAYS = 10;

const KEY = 'cvapp.v1.applications';
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : '');

/** Date ISO (AAAA-MM-JJ) décalée de `days` jours. */
export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export const todayISO = (today = new Date()) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

export function normalizeApplication(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    id: /^[a-z0-9-]{1,60}$/i.test(str(src.id)) ? str(src.id) : uid('app'),
    company: str(src.company).slice(0, 120),
    position: str(src.position).slice(0, 120),
    sentOn: isoDate(src.sentOn),
    channel: CHANNELS.includes(str(src.channel)) ? str(src.channel) : '',
    status: STATUSES.some((s) => s.id === src.status) ? src.status : 'a-envoyer',
    followUpOn: isoDate(src.followUpOn),
    contact: str(src.contact).slice(0, 200),
    reference: str(src.reference).slice(0, 120),
    cvId: str(src.cvId).slice(0, 80),
    notes: str(src.notes).slice(0, 2000),
    updatedAt: str(src.updatedAt) || new Date().toISOString(),
  };
}

export function createApplication(values = {}) {
  return normalizeApplication({ ...values, id: uid('app') });
}

/**
 * Changement de statut : « Envoyée » renseigne la date d'envoi (aujourd'hui si vide) et programme la relance
 * à J+10 ; « Relancée » reprogramme une dernière relance à J+10 ; les statuts finaux effacent la relance.
 */
export function setStatus(app, status, today = new Date()) {
  const now = todayISO(today);
  const next = { ...app, status, updatedAt: new Date().toISOString() };
  if (status === 'envoyee') {
    next.sentOn = next.sentOn || now;
    next.followUpOn = next.followUpOn || addDays(next.sentOn, FOLLOW_UP_DAYS);
  } else if (status === 'relancee') next.followUpOn = addDays(now, FOLLOW_UP_DAYS);
  else if (['entretien', 'offre', 'refus', 'abandon'].includes(status)) next.followUpOn = '';
  return next;
}

/** Candidatures dont la relance est due (date atteinte, statut Envoyée ou Relancée). */
export function dueFollowUps(apps, today = new Date()) {
  const now = todayISO(today);
  return apps.filter((a) => ['envoyee', 'relancee'].includes(a.status) && a.followUpOn && a.followUpOn <= now);
}

/** Tri : relances dues d'abord, puis les plus récentes. */
export function sortApplications(apps, today = new Date()) {
  const due = new Set(dueFollowUps(apps, today).map((a) => a.id));
  return [...apps].sort((a, b) => (due.has(b.id) - due.has(a.id)) || (b.sentOn || b.updatedAt).localeCompare(a.sentOn || a.updatedAt));
}

/** Statistiques simples : total, en cours, entretiens, taux de réponse. */
export function stats(apps) {
  const sent = apps.filter((a) => a.status !== 'a-envoyer');
  const answered = sent.filter((a) => ['entretien', 'offre', 'refus'].includes(a.status));
  return {
    total: apps.length,
    sent: sent.length,
    active: apps.filter((a) => ['a-envoyer', 'envoyee', 'relancee', 'entretien'].includes(a.status)).length,
    interviews: apps.filter((a) => ['entretien', 'offre'].includes(a.status)).length,
    responseRate: sent.length ? Math.round((answered.length / sent.length) * 100) : 0,
  };
}

/** Export CSV (séparateur « ; » et BOM UTF-8 : s'ouvre directement dans Excel en français). */
export function toCSV(apps) {
  const label = (id) => (STATUSES.find((s) => s.id === id) || { label: id }).label;
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise les formules (injection CSV)
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Entreprise', 'Poste', 'Date d\'envoi', 'Canal', 'Statut', 'Relance prévue', 'Contact', 'Référence', 'Notes'];
  const rows = apps.map((a) => [a.company, a.position, a.sentOn, a.channel, label(a.status), a.followUpOn, a.contact, a.reference, a.notes]);
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')}`;
}

/** Stockage des candidatures (localStorage ou stockage injecté). */
export function createApplicationStore(storage) {
  const read = () => {
    try {
      const raw = JSON.parse(storage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.map(normalizeApplication) : [];
    } catch {
      return [];
    }
  };
  const write = (list) => storage.setItem(KEY, JSON.stringify(list));
  return {
    list: read,
    save(app) {
      const a = normalizeApplication({ ...app, updatedAt: new Date().toISOString() });
      write([...read().filter((x) => x.id !== a.id), a]);
      return a;
    },
    remove(id) {
      write(read().filter((x) => x.id !== id));
    },
    /** Fusionne une liste (restauration) : ajoute les absentes, remplace par la version la plus récente. Renvoie le nombre de changements. */
    merge(list) {
      const current = new Map(read().map((a) => [a.id, a]));
      let changed = 0;
      for (const raw of Array.isArray(list) ? list : []) {
        const a = normalizeApplication(raw);
        const here = current.get(a.id);
        if (!here || a.updatedAt > here.updatedAt) {
          current.set(a.id, a);
          changed += 1;
        }
      }
      write([...current.values()]);
      return changed;
    },
  };
}
