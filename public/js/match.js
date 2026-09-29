// Correspondance CV ↔ offre d'emploi, entièrement locale (rien n'est envoyé à un serveur).
// Imite ce que font les logiciels de tri (ATS) : extraction des mots-clés de l'annonce, puis
// recherche de ces mots-clés dans le CV. Pur (sans DOM) : testable sous Node.

import { LIST_SECTIONS } from './model.js';

/** Mots vides FR + EN (articles, prépositions, pronoms, auxiliaires). */
const STOP_LIST = `
a à au aux avec ce ces cet cette dans de des du d elle en et être est sont sera été eux il ils je la le les leur leurs l lui ma mais me même mes moi mon ne nos notre nous on ou où par pas pour qu que qui sa se ses si son sur ta te tes toi ton tu un une vos votre vous y ainsi afin alors aussi autre autres avoir bien car chez comme dont entre elles fait faire ici jusqu lors moins non peu plus sans selon sous tout tous toute toutes très via vers etc cas chaque déjà encore dès doit doivent devra devez pouvez peut peuvent souhaitez souhaité souhaitée idéalement également notamment tel telle tels
the and or of to in for with on at by from as an be is are was were will would can could should may must our your their this that these those it its we you they he she them us not no but if than then so such into over under about within across per plus
`;

/** Mots génériques des annonces, sans valeur de compétence. */
const GENERIC_LIST = `
poste postes profil profils candidat candidate candidats candidature mission missions entreprise société groupe client clients expérience expériences an ans année années recherche recherchons recrute recrutons rejoindre rejoignez h/f f/h hf cdi cdd stage alternance temps plein partiel salaire rémunération avantages avantage équipe équipes sein travail travailler poste basé lieu date début durée contrat offre emploi description responsabilités vous nous activité activités service services domaine secteur niveau minimum maximum bonne bonnes bon bons excellent excellente capacité capacités qualités qualité sens esprit connaissance connaissances maîtrise maîtriser savoir compétence compétences requis requise requises souhaité atout apprécié appréciée serait plus mois jour jours semaine semaines
apprécié appréciée appréciés personne personnes courant courante idéal idéale maitrise maîtrisez disposez justifiez êtes avez h f
job jobs role roles position company candidate candidates experience experiences year years work working team teams join apply salary benefits location full time part required preferred requirements responsibilities skills skill knowledge ability strong good excellent plus including within new opportunity looking seeking we're you'll fluent
`;

/** Minuscules, sans accents, apostrophes typographiques unifiées. */
export function normalizeText(s) {
  return String(s || '')
    .replace(/[’`]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const SUFFIXES = ['ements', 'ement', 'ations', 'ation', 'ateurs', 'ateur', 'atrices', 'atrice', 'ances', 'ance', 'ences', 'ence', 'euses', 'euse', 'eurs', 'eur', 'ives', 'ive', 'ing', 'ers', 'ees', 'ee', 'es', 's', 'x', 'e'];

/** Racine grossière (suffixes courants retirés, 7 caractères au plus) pour rapprocher les formes d'un mot. */
export function stem(word) {
  let w = normalizeText(word);
  if (w.length <= 4 || /\d|[+#.]/.test(w)) return w;
  for (const suf of SUFFIXES) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  return w.slice(0, 7);
}

/** Mots d'un texte, avec leur forme d'origine (garde C++, C#, Node.js, Power BI…). */
function words(text) {
  return String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}+#.\-/]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu) || [];
}

const STOP = new Set(normalizeText(STOP_LIST).trim().split(/\s+/));
const GENERIC = new Set(normalizeText(GENERIC_LIST).trim().split(/\s+/));

const isStop = (w) => STOP.has(normalizeText(w).replace(/'.*$/, '')) || STOP.has(normalizeText(w));
const isGeneric = (w) => GENERIC.has(normalizeText(w));
// Nombres et niveaux CECRL seuls (« B2 ») : pas des compétences en soi.
const isNumber = (w) => /^[\d.,/\-]+$/.test(w) || /^[abc][12]$/i.test(w);
const isAcronym = (w) => /^[A-Z][A-Z0-9+#.]{1,}$/.test(w) || /[a-z][A-Z]/.test(w) || /[+#]/.test(w);

/** Découpe l'élision « d'Excel » → « Excel ». */
function stripElision(w) {
  return w.replace(/^(?:[dlnjmtsc]|qu)['’]/i, '');
}

/**
 * Extrait les mots-clés d'une offre : termes simples et expressions de 2 à 3 mots
 * (« gestion de projet », « service client », « Power BI »), classés par importance.
 * Renvoie [{ term, weight, count }] (au plus `max`).
 */
export function extractKeywords(offer, { max = 25 } = {}) {
  const text = String(offer || '');
  if (!text.trim()) return [];
  const scores = new Map();
  const bump = (term, w) => {
    const key = normalizeText(term);
    const cur = scores.get(key) || { term, weight: 0, count: 0 };
    cur.weight += w;
    cur.count += 1;
    // Garde la graphie la plus « riche » (majuscules d'un sigle, accents).
    if (/[A-Z]/.test(term) && !/[A-Z]/.test(cur.term)) cur.term = term;
    scores.set(key, cur);
  };
  // Segments : lignes et listes (virgules, puces, points-virgules, parenthèses).
  const segments = text.split(/[\n\r;,•·|()•:!?]+|\.\s/);
  for (const seg of segments) {
    const ws = words(seg).map(stripElision).filter(Boolean);
    for (let i = 0; i < ws.length; i += 1) {
      const w = ws[i];
      const ok = (x) => x && !isStop(x) && !isNumber(x) && x.length >= 2;
      if (ok(w) && !isGeneric(w) && (w.length >= 3 || isAcronym(w))) {
        // Un sigle ou un nom d'outil (majuscule en milieu de phrase) compte double.
        const midCap = i > 0 && /^[A-Z]/.test(w);
        bump(w, isAcronym(w) ? 2.2 : midCap ? 1.6 : 1);
      }
      // Expressions de deux mots : « service client », « Power BI ».
      const w2 = ws[i + 1];
      if (ok(w) && ok(w2) && !isGeneric(w) && !isGeneric(w2)) bump(`${w} ${w2}`, 1.5);
      // « X de Y » : « gestion de projet », « analyse de données ».
      const w3 = ws[i + 2];
      if (ok(w) && w2 && /^(de|du|des|d|en|of)$/i.test(normalizeText(w2)) && ok(w3) && !isGeneric(w) && !isGeneric(w3)) {
        bump(`${w} ${w2} ${w3}`, 1.8);
      }
    }
  }
  const all = [...scores.values()];
  const single = new Map(all.filter((k) => !k.term.includes(' ')).map((k) => [normalizeText(k.term), k]));
  // Une expression n'est retenue que si elle revient, ou si elle contient un sigle / nom d'outil.
  const phrases = all.filter((k) => k.term.includes(' ') && (k.count >= 2 || k.term.split(' ').every((w) => isAcronym(w) || /^[A-Z]/.test(w))));
  // Les mots d'une expression retenue lui sont attribués : « Power BI » plutôt que « Power » et « BI ».
  for (const ph of phrases.sort((a, b) => b.count - a.count)) {
    let w = 0;
    for (const part of ph.term.split(' ')) {
      const u = single.get(normalizeText(part));
      if (!u || u.count <= 0) continue;
      const unit = u.weight / u.count;
      w += unit;
      u.weight -= unit * Math.min(ph.count, u.count);
      u.count -= Math.min(ph.count, u.count);
    }
    ph.weight = Math.max(ph.weight, w * ph.count * 1.1);
  }
  const list = [...phrases, ...[...single.values()].filter((k) => k.count > 0 && k.weight > 0)];
  list.sort((a, b) => b.weight - a.weight || b.term.length - a.term.length);
  // Évite les doublons : un mot seul déjà couvert par une expression retenue de poids comparable.
  const kept = [];
  for (const k of list) {
    if (kept.length >= max) break;
    const st = k.term.split(' ').map(stem);
    const dup = kept.some((o) => {
      const os = o.term.split(' ').map(stem);
      if (st.length === 1) return os.includes(st[0]) && o.weight >= k.weight * 0.6;
      return os.join(' ') === st.join(' ');
    });
    if (!dup) kept.push({ term: k.term, weight: Math.round(k.weight * 10) / 10, count: k.count });
  }
  return kept;
}

/** Texte complet du CV (tout ce qu'un ATS indexe). */
export function cvText(cv) {
  const parts = [cv.targetTitle, cv.summary];
  for (const s of LIST_SECTIONS) {
    for (const it of cv[s] || []) {
      for (const [k, v] of Object.entries(it)) {
        if (k === 'id') continue;
        if (typeof v === 'string') parts.push(v);
        else if (Array.isArray(v)) parts.push(v.join(', '));
      }
    }
  }
  return parts.filter(Boolean).join('\n');
}

/**
 * Compare un CV à une offre. Renvoie { score (0-100), matched: [], missing: [], total }.
 * Un mot-clé est trouvé si chacun de ses mots significatifs figure dans le CV (formes rapprochées).
 */
export function matchOffer(cv, offer, opts = {}) {
  const keywords = extractKeywords(offer, opts);
  if (!keywords.length) return { score: 0, matched: [], missing: [], total: 0 };
  const stems = new Set(words(cvText(cv)).map(stripElision).map(stem));
  const matched = [];
  const missing = [];
  for (const k of keywords) {
    const significant = k.term.split(' ').map(stripElision).filter((w) => !isStop(w));
    (significant.every((w) => stems.has(stem(w))) ? matched : missing).push(k);
  }
  const total = keywords.reduce((s, k) => s + k.weight, 0);
  const got = matched.reduce((s, k) => s + k.weight, 0);
  return { score: Math.round((got / total) * 100), matched, missing, total: keywords.length };
}
