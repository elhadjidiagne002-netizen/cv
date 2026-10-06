// Atelier de texte IA (facultatif) : retravailler n'importe quel texte du CV ou de la lettre —
// corriger, reformuler, raccourcir, développer, mettre en puces, simplifier, traduire.
// Même service que l'assistant (ai.js : https://nexusmarket.sn/api/ai, accord préalable).
//
// Données : on n'envoie QUE le texte à retravailler (jamais le reste du CV). Les e-mails et
// numéros de téléphone qu'il pourrait contenir sont remplacés par des repères ⟦1⟧, ⟦2⟧… avant
// l'envoi, puis remis à leur place dans la réponse (maskPersonal / unmaskPersonal).
// Module pur (sans DOM) : testable sous Node (tests/aitext.test.js).

export const MAX_TEXT = 4000;

/** Actions proposées (ordre d'affichage). */
export const TEXT_ACTIONS = [
  { id: 'corriger', label: 'Corriger les fautes', hint: 'Orthographe, grammaire, ponctuation. Le sens et le style ne changent pas.' },
  { id: 'pro', label: 'Rendre plus professionnel', hint: 'Vocabulaire du recrutement, formulations nettes, sans cliché.' },
  { id: 'raccourcir', label: 'Raccourcir', hint: 'Environ 40 % plus court, en gardant les faits et les chiffres.' },
  { id: 'developper', label: 'Développer', hint: 'Plus détaillé, sans rien inventer : [à compléter] là où une information manque.' },
  { id: 'puces', label: 'Mettre en puces (verbes d\'action)', hint: 'Une idée par ligne, chacune commençant par un verbe d\'action.' },
  { id: 'simplifier', label: 'Simplifier', hint: 'Phrases plus courtes et plus claires.' },
  { id: 'en', label: 'Traduire en anglais', hint: 'Anglais professionnel (CV international, résumé US/UK).' },
  { id: 'fr', label: 'Traduire en français', hint: 'Français professionnel.' },
];
const ACTION_IDS = new Set(TEXT_ACTIONS.map((a) => a.id));

const CONSIGNES = {
  corriger: 'Corrige UNIQUEMENT l\'orthographe, la grammaire, la conjugaison, les accords et la ponctuation. Ne change ni le sens, ni le style, ni l\'ordre, ni la longueur. Si le texte est déjà correct, rends-le tel quel.',
  pro: 'Reformule dans un registre professionnel de recrutement : vocabulaire précis, verbes d\'action, formulations nettes et concises. Garde exactement les mêmes faits et les mêmes chiffres.',
  raccourcir: 'Raccourcis le texte d\'environ 40 % en gardant les informations les plus importantes, les faits et tous les chiffres. Supprime les répétitions et les formules creuses.',
  developper: 'Développe le texte pour le rendre plus complet et plus convaincant (environ 50 % plus long), SANS inventer : là où un détail manque (chiffre, outil, résultat, contexte), écris un repère entre crochets que la personne complétera, par exemple [nombre de clients] ou [résultat obtenu].',
  puces: 'Réécris le texte sous forme de liste : une idée par ligne, chaque ligne commençant par un verbe d\'action à l\'infinitif ou au passé composé (selon l\'usage du texte), sans tiret ni puce en début de ligne. Garde les mêmes faits et chiffres.',
  simplifier: 'Simplifie le texte : phrases plus courtes, mots courants, une idée par phrase. Garde les mêmes faits et chiffres.',
  en: 'Traduis le texte en anglais professionnel (usage CV / candidature). Adapte les intitulés et les formulations à l\'usage anglophone plutôt que de traduire mot à mot. Garde les mêmes faits et chiffres.',
  fr: 'Traduis le texte en français professionnel (usage CV / candidature). Adapte les formulations à l\'usage francophone plutôt que de traduire mot à mot. Garde les mêmes faits et chiffres.',
};

/** Nature du texte, pour adapter les consignes (déduite du champ édité). */
export const TEXT_KINDS = {
  accroche: 'une accroche de CV (2 à 4 lignes, style nominal, sans « je »)',
  missions: 'une liste de missions et réalisations d\'une expérience professionnelle (une par ligne)',
  lettre: 'le corps d\'une lettre de motivation (paragraphes séparés par une ligne vide)',
  description: 'une courte description dans un CV',
  libre: 'un texte professionnel (message, e-mail, profil en ligne…)',
};

/** Nature du texte d'après le chemin du champ dans le modèle (data-path). */
export function kindForPath(path) {
  const p = String(path || '');
  if (p === 'summary') return 'accroche';
  if (p === 'letter.body') return 'lettre';
  if (/^experiences\.\d+\.description$/.test(p)) return 'missions';
  if (/\.description$/.test(p)) return 'description';
  return 'libre';
}

// E-mails et numéros de téléphone (formats sénégalais, français, internationaux).
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+|00)\d{1,3}[\s.-]?(?:\d[\s.-]?){6,12}\d|\b(?:7[05678]|3[03])[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b|\b0[1-9](?:[\s.-]?\d{2}){4}\b/g;

/** Remplace e-mails et téléphones par ⟦1⟧, ⟦2⟧… ; renvoie le texte masqué et la table de correspondance. */
export function maskPersonal(text) {
  const map = [];
  const swap = (m) => { map.push(m); return `⟦${map.length}⟧`; };
  const masked = String(text || '').replace(EMAIL, swap).replace(PHONE, swap);
  return { masked, map };
}

/** Remet les e-mails et téléphones à la place de leurs repères. */
export function unmaskPersonal(text, map) {
  return String(text || '').replace(/⟦(\d+)⟧/g, (m, n) => (map && map[Number(n) - 1] !== undefined ? map[Number(n) - 1] : m));
}

/** Messages pour l'API : uniquement le texte (masqué), l'action et la nature du texte. */
export function textMessages(action, text, { kind = 'libre' } = {}) {
  if (!ACTION_IDS.has(action)) throw new Error(`Action inconnue : ${action}`);
  const nature = TEXT_KINDS[kind] || TEXT_KINDS.libre;
  return [
    { role: 'system', content: `Tu es un rédacteur-correcteur francophone spécialisé dans le recrutement (France, Sénégal, Afrique de l'Ouest). On te donne ${nature}. Consigne : ${CONSIGNES[action]}
Règles absolues : n'invente aucun fait, aucun chiffre, aucun outil, aucune compétence absents du texte ; conserve tels quels les repères entre crochets [ … ] et les repères ⟦1⟧, ⟦2⟧… (ce sont des coordonnées masquées) ; aucun cliché (« dynamique », « motivé », « passionné » sans preuve) ; le genre de la personne est inconnu : préfère des tournures neutres ; garde les retours à la ligne utiles (une mission par ligne, paragraphes séparés par une ligne vide).
Réponds UNIQUEMENT par un objet JSON : {"texte": "le texte retravaillé", "remarques": ["0 à 3 remarques courtes sur ce qui a changé ou ce qu'il reste à compléter"]}` },
    { role: 'user', content: String(text || '').slice(0, MAX_TEXT) },
  ];
}

/**
 * Lit la réponse du modèle : JSON demandé (même entouré de texte ou mal échappé), sinon repli raisonnable —
 * champ « texte » extrait à la main, ou réponse en texte brut quand le modèle a ignoré le format.
 * `parseJson` = parseAIJson (injecté pour garder ce module sans dépendance).
 */
export function readTextAnswer(raw, parseJson) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const fromJson = normalizeTextAnswer(parseJson(s));
  if (fromJson) return fromJson;
  const m = s.match(/"texte"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"remarques"|\}\s*(?:```)?\s*$)/);
  if (m) {
    const text = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
    return text ? { text: text.slice(0, MAX_TEXT * 2), notes: [] } : null;
  }
  if (s.includes('"texte"')) return null; // JSON tronqué : mieux vaut réessayer que coller un morceau de JSON
  const plain = s.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  return plain ? { text: plain.slice(0, MAX_TEXT * 2), notes: [] } : null;
}

/** Nettoie la réponse : texte non vide, remarques bornées. */
export function normalizeTextAnswer(a) {
  if (!a || typeof a !== 'object') return null;
  const text = String(a.texte || a.text || '').replace(/\r/g, '').trim().slice(0, MAX_TEXT * 2);
  if (!text) return null;
  const notes = (Array.isArray(a.remarques) ? a.remarques : Array.isArray(a.notes) ? a.notes : [])
    .map((x) => String(x || '').trim().slice(0, 300)).filter(Boolean).slice(0, 3);
  return { text, notes };
}
