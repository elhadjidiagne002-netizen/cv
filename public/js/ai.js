// Assistant IA (facultatif) : rédaction de la lettre de motivation et conseils pour étoffer le CV.
// Utilise l'API d'IA de NEXUS Market (Groq, clé côté serveur) : https://nexusmarket.sn/api/ai
//
// Données : c'est la SEULE fonction du site qui envoie quelque chose à un serveur, et seulement après
// l'accord explicite de la personne. On n'envoie que le parcours professionnel : jamais le nom, le
// téléphone, l'e-mail, l'adresse, la photo, la date de naissance, la nationalité, la situation
// familiale ni les références (voir profileForAI, vérifié par tests/ai.test.js).
// Module pur (sans DOM) : testable sous Node.

export const AI_ENDPOINT = 'https://nexusmarket.sn/api/ai';
export const AI_CONSENT_KEY = 'cv-ai-consent-v1';
const MAX_DESC = 900;       // caractères par description envoyée
const MAX_OFFER = 6000;     // caractères de l'annonce envoyés

const cut = (s, n) => String(s || '').trim().slice(0, n);
const period = (it) => [it.start, it.current ? 'aujourd\'hui' : it.end].filter(Boolean).join(' → ');

/** Parcours professionnel sans aucune donnée d'identification (ce qui part vers l'IA). */
export function profileForAI(cv) {
  const visible = (list) => (list || []).filter((x) => !x.hidden);
  return {
    pays: cv.meta && cv.meta.country ? cv.meta.country : '',
    langue: cv.meta && cv.meta.lang === 'en' ? 'anglais' : 'français',
    poste_vise: cut(cv.targetTitle, 200),
    accroche: cut(cv.summary, 1200),
    experiences: visible(cv.experiences).slice(0, 12).map((e) => ({
      poste: cut(e.position, 150), employeur: cut(e.employer, 150), ville: cut(e.city, 80), periode: period(e), missions: cut(e.description, MAX_DESC),
    })),
    formations: visible(cv.education).slice(0, 8).map((e) => ({ diplome: cut(e.degree, 200), etablissement: cut(e.school, 150), periode: period(e), details: cut(e.description, 400) })),
    competences: visible(cv.skills).slice(0, 10).map((g) => ({ categorie: cut(g.name, 80), mots_cles: (g.keywords || []).slice(0, 25).map((k) => cut(k, 60)) })),
    langues: visible(cv.languages).slice(0, 8).map((l) => ({ langue: cut(l.name, 60), niveau: l.level || '', certificat: cut(l.certificate, 80) })),
    certifications: visible(cv.certifications).slice(0, 10).map((c) => cut([c.name, c.issuer, c.date].filter(Boolean).join(' — '), 200)),
    projets: visible(cv.projects).slice(0, 6).map((p) => ({ projet: cut(p.name, 150), role: cut(p.role, 100), description: cut(p.description, 500) })),
    benevolat: visible(cv.volunteering).slice(0, 5).map((v) => ({ role: cut(v.role, 120), organisation: cut(v.organization, 120), description: cut(v.description, 400) })),
    centres_interet: visible(cv.interests).slice(0, 8).map((i) => cut(i.name, 80)),
  };
}

const NORMES = `Normes à respecter : aucun fait inventé — n'utilise QUE le profil fourni ; n'attribue jamais à la personne un outil, une compétence, un chiffre ou une mission absents de son profil, même si l'annonce les demande ; quand une information manque (chiffre, nom de projet, motivation précise), écris un repère entre crochets [ ... ] que la personne complétera ; phrases courtes, verbes d'action, résultats chiffrés quand le profil les donne ; aucun cliché (« dynamique », « motivé », « passionné » sans preuve) ; aucune information personnelle (âge, origine, religion, situation familiale) ; le genre de la personne est inconnu : pas d'accords du type « fort(e) », préfère des tournures neutres (« Avec six ans d'expérience… »).`;

/** Messages pour rédiger une lettre (candidature, stage, relance, remerciement). */
export function letterMessages(cv, { offer = '', organization = '', kind = 'candidature', style = 'standard' } = {}) {
  const en = style === 'en';
  const kinds = { candidature: 'lettre de motivation (candidature)', stage: 'demande de stage', relance: 'lettre de relance après une candidature', remerciement: 'lettre de remerciement après un entretien' };
  const styleTxt = en ? 'une cover letter en anglais (ton professionnel anglo-saxon)'
    : style === 'administratif' ? 'une lettre administrative sénégalaise / française (formules de haute considération, « J\'ai l\'honneur de solliciter… »)'
    : 'une lettre en français standard, structure « vous / moi / nous »';
  return [
    { role: 'system', content: `Tu es un conseiller en recrutement francophone (France, Sénégal, Afrique de l'Ouest). Tu rédiges ${styleTxt}. Type : ${kinds[kind] || kinds.candidature}. Longueur du corps : 250 à 350 mots, 3 paragraphes, sans formule d'appel ni formule de politesse finale (elles sont gérées à part). ${NORMES}
Réponds UNIQUEMENT par un objet JSON : {"objet": "...", "corps": "paragraphe 1\\n\\nparagraphe 2\\n\\nparagraphe 3", "conseils": ["2 ou 3 conseils courts pour personnaliser la lettre"]}` },
    { role: 'user', content: `Entreprise : ${cut(organization, 150) || '[non précisée]'}\n\nAnnonce (si fournie) :\n${cut(offer, MAX_OFFER) || '[aucune annonce : candidature spontanée]'}\n\nProfil (anonymisé) :\n${JSON.stringify(profileForAI(cv))}` },
  ];
}

/** Messages pour les conseils d'amélioration du CV. */
export function adviceMessages(cv, { offer = '' } = {}) {
  return [
    { role: 'system', content: `Tu es un expert du CV et des logiciels de tri des candidatures (ATS), pour la France, le Sénégal et l'Afrique francophone. Tu aides à ÉTOFFER un CV sans rien inventer. ${NORMES}
Réponds UNIQUEMENT par un objet JSON :
{"accroche": "accroche proposée (3 lignes maximum, sans « je »), ou chaîne vide si l'actuelle est bonne",
 "conseils": [{"rubrique": "Expérience professionnelle | Formation | Compétences | Langues | Accroche | Général", "priorite": "haute | moyenne | basse", "conseil": "conseil concret et actionnable"}],
 "missions": [{"index": 0, "missions": "missions réécrites, une par ligne, chacune commençant par un verbe d'action, avec [chiffre] quand un résultat manque"}],
 "competences_manquantes": ["compétences souvent attendues pour ce poste, à ajouter SEULEMENT si la personne les a"]}
Donne 5 à 7 conseils courts (une phrase chacun), du plus utile au moins utile. « index » = position de l'expérience dans la liste fournie (0 = la plus récente) ; réécris au plus 2 expériences, celles qui en ont le plus besoin : REFORMULE uniquement les missions déjà écrites (même nombre de lignes, mêmes faits, mêmes chiffres), sans ajouter d'outil ni de mission ; tu peux ajouter au plus une ligne du type « [Une réalisation chiffrée à préciser] ». Ce que l'annonce demande et que le profil ne montre pas va UNIQUEMENT dans competences_manquantes.` },
    { role: 'user', content: `${offer ? `Annonce visée :\n${cut(offer, MAX_OFFER)}\n\n` : ''}Profil (anonymisé) :\n${JSON.stringify(profileForAI(cv))}` },
  ];
}

/** Extrait le premier objet JSON d'une réponse (le modèle ajoute parfois du texte ou des ```). */
export function parseAIJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0; let inStr = false; let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      const raw = s.slice(start, i + 1);
      try { return JSON.parse(raw); } catch { /* retours à la ligne bruts dans une chaîne : voir ci-dessous */ }
      try { return JSON.parse(escapeControlsInStrings(raw)); } catch { return null; }
    }
  }
  return null;
}

/**
 * Les modèles écrivent souvent un texte sur plusieurs lignes dans une chaîne JSON avec de VRAIS retours à la ligne
 * (JSON invalide pour JSON.parse). On échappe les caractères de contrôle situés à l'intérieur des chaînes.
 */
function escapeControlsInStrings(json) {
  let out = ''; let inStr = false; let esc = false;
  for (const c of json) {
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      else if (c === '\n') { out += '\\n'; continue; }
      else if (c === '\r') { out += '\\r'; continue; }
      else if (c === '\t') { out += '\\t'; continue; }
      else if (c < ' ') continue;
    } else if (c === '"') inStr = true;
    out += c;
  }
  return out;
}

/** Nettoie la réponse « lettre » (types, longueurs). */
export function normalizeLetterAnswer(a) {
  if (!a || typeof a !== 'object') return null;
  const body = cut(a.corps || a.body, 8000).replace(/\r/g, '');
  if (body.length < 80) return null;
  return { subject: cut(a.objet || a.subject, 300), body, tips: (Array.isArray(a.conseils) ? a.conseils : []).map((x) => cut(x, 300)).filter(Boolean).slice(0, 4) };
}

/** Nettoie la réponse « conseils » ; les réécritures ne visent que des expériences existantes. */
export function normalizeAdviceAnswer(a, cv) {
  if (!a || typeof a !== 'object') return null;
  const visible = (cv.experiences || []).filter((x) => !x.hidden);
  const prio = { haute: 0, moyenne: 1, basse: 2 };
  const tips = (Array.isArray(a.conseils) ? a.conseils : [])
    .map((c) => ({ section: cut(c && c.rubrique, 60) || 'Général', priority: prio[c && c.priorite] !== undefined ? c.priorite : 'moyenne', text: cut(c && c.conseil, 500) }))
    .filter((c) => c.text)
    .sort((x, y) => prio[x.priority] - prio[y.priority])
    .slice(0, 10);
  const rewrites = (Array.isArray(a.missions) ? a.missions : [])
    .map((m) => ({ index: Number(m && m.index), text: cut(m && m.missions, 1500) }))
    .filter((m) => Number.isInteger(m.index) && m.index >= 0 && m.index < visible.length && m.text)
    .map((m) => ({ ...m, id: visible[m.index].id, title: [visible[m.index].position, visible[m.index].employer].filter(Boolean).join(' — '), before: visible[m.index].description || '' }));
  return {
    summary: cut(a.accroche, 800),
    tips,
    rewrites,
    missingSkills: (Array.isArray(a.competences_manquantes) ? a.competences_manquantes : []).map((x) => cut(x, 60)).filter(Boolean).slice(0, 12),
  };
}

export class AIError extends Error {}

/** Appel de l'API (fetchImpl injectable pour les tests). */
export async function callAI(messages, { fetchImpl = globalThis.fetch, maxTokens = 1400, temperature = 0.4 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AIError('Pas de connexion internet : l\'assistant IA a besoin du réseau (le reste du site marche hors ligne).');
  let res;
  try {
    res = await fetchImpl(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
    });
  } catch {
    throw new AIError('Impossible de joindre l\'assistant IA. Vérifiez votre connexion et réessayez.');
  }
  if (res.status === 429) throw new AIError('Trop de demandes en peu de temps : réessayez dans une minute.');
  if (!res.ok) {
    // Le service renvoie souvent la raison (« detail ») : on la montre, utile pour diagnostiquer à distance.
    const err = await res.json().catch(() => null);
    const detail = err && typeof (err.detail || err.error) === 'string' ? String(err.detail || err.error).slice(0, 160) : '';
    throw new AIError(`L'assistant IA est momentanément indisponible. Réessayez plus tard.${detail ? ` (${detail})` : ''}`);
  }
  const data = await res.json().catch(() => null);
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new AIError('Réponse vide de l\'assistant IA. Réessayez.');
  return text;
}
