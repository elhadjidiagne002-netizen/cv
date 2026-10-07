// Simulateur d'entretien : questions tirées de l'offre (IA) ou d'une banque classique, réponse critiquée par l'IA.
// Langues : français, wolof, anglais. Module pur (testé). N'envoie à l'IA que l'offre, le parcours SANS identité
// (profileForAI) et la réponse tapée (e-mails et téléphones masqués par l'appelant).

export const LANGS = { fr: 'Français', wo: 'Wolof', en: 'English' };
const MAX_OFFER = 5000;
const MAX_ANSWER = 2500;

/** Questions classiques (repli sans IA ou hors ligne). Formulations courantes des recruteurs, sans rien d'inventé sur la personne. */
export const BANK = {
  fr: [
    'Présentez-vous en deux minutes.',
    'Pourquoi souhaitez-vous rejoindre notre structure ?',
    'Qu’est-ce qui vous intéresse dans ce poste ?',
    'Parlez-moi d’une réussite dont vous êtes fier ou fière, et de votre rôle exact.',
    'Racontez une difficulté rencontrée au travail ou en stage et comment vous l’avez surmontée.',
    'Quelles sont vos principales qualités pour ce poste ? Donnez un exemple pour chacune.',
    'Quel point cherchez-vous à améliorer, et que faites-vous pour cela ?',
    'Comment organisez-vous votre travail quand plusieurs tâches urgentes arrivent en même temps ?',
    'Décrivez une situation où vous avez travaillé en équipe avec une personne difficile.',
    'Où vous voyez-vous dans trois ans ?',
    'Quelles sont vos prétentions salariales ?',
    'Avez-vous des questions à nous poser ?',
  ],
  wo: [
    'Wax nu ci sa bopp ci ñaari simili.',
    'Lu tax nga bëgg liggéey ci sunu kër-liggéey bi ?',
    'Lan moo la soxal ci liggéey bii ?',
    'Wax nu benn mbir mu baax nga def ci sa liggéey, ak li nga def ci sa bopp.',
    'Wax nu benn jafe-jafe nga gis ci liggéey, ak naka nga ko jéggee.',
    'Ban jikko yu baax nga am yu jariñ ci liggéey bii ? Indil misaal.',
    'Lan nga war a gën a jàng walla gën a defar ci sa bopp ?',
    'Naka ngay doxale sa liggéey bu ay liggéey yu gaaw ñëwee ci benn yoon ?',
    'Ban fan nga bëgg a nekk fii ak ñetti at ?',
    'Ndax am na lu nga bëgg a laaj ?',
  ],
  en: [
    'Tell me about yourself.',
    'Why do you want to work for us?',
    'What interests you about this role?',
    'Describe an achievement you are proud of and your exact role in it.',
    'Tell me about a challenge at work or during an internship and how you handled it.',
    'What are your key strengths for this position? Give an example for each.',
    'What is one area you are working to improve?',
    'How do you prioritise when several urgent tasks arrive at once?',
    'Describe a time you worked with a difficult colleague.',
    'Where do you see yourself in three years?',
    'What are your salary expectations?',
    'Do you have any questions for us?',
  ],
};

const langRule = (lang) => (lang === 'wo'
  ? 'Écris en WOLOF (orthographe officielle du Sénégal, alphabet latin : à, é, ë, ñ, ŋ), registre poli ; garde en français uniquement les termes techniques du métier.'
  : lang === 'en' ? 'Write in ENGLISH.' : 'Écris en FRANÇAIS.');

/** Messages pour générer les questions à partir de l'offre. */
export function questionMessages({ offer = '', profile = null, lang = 'fr', count = 6 }) {
  const n = Math.min(10, Math.max(3, Number(count) || 6));
  return [
    { role: 'system', content: `Tu es un recruteur expérimenté au Sénégal / en Afrique francophone qui prépare un entretien d'embauche. ${langRule(lang)} Réponds UNIQUEMENT en JSON : {"questions":[{"q":"…","why":"…"}]} où "why" explique en une phrase ce que le recruteur cherche à vérifier. Questions réalistes, variées (motivation, expérience, situations concrètes, compétences techniques demandées par l'offre, savoir-être), une seule idée par question, aucune question discriminatoire (âge, religion, ethnie, situation familiale, grossesse, santé).` },
    { role: 'user', content: JSON.stringify({ nombre_de_questions: n, offre: String(offer).slice(0, MAX_OFFER), parcours_du_candidat: profile || {} }) },
  ];
}

/** Messages pour critiquer une réponse. */
export function feedbackMessages({ question, answer, offer = '', lang = 'fr' }) {
  return [
    { role: 'system', content: `Tu es un coach d'entretien bienveillant mais exigeant. ${langRule(lang)} Évalue la réponse du candidat à la question posée, pour le poste décrit. Réponds UNIQUEMENT en JSON : {"note":0-10,"points_forts":["…"],"a_ameliorer":["…"],"exemple":"…"}. "exemple" = une meilleure réponse courte (méthode STAR : situation, tâche, action, résultat) qui reprend UNIQUEMENT les faits donnés par le candidat ; s'il manque un fait, mets un repère entre crochets [ … ] au lieu d'inventer. Pas de cliché, pas de jugement sur la personne.` },
    { role: 'user', content: JSON.stringify({ question: String(question).slice(0, 400), reponse: String(answer).slice(0, MAX_ANSWER), offre: String(offer).slice(0, 2000) }) },
  ];
}

/** Questions renvoyées par l'IA → liste propre (3 à 10). */
export function normalizeQuestions(a) {
  const list = Array.isArray(a?.questions) ? a.questions : Array.isArray(a) ? a : [];
  return list.map((x) => (typeof x === 'string' ? { q: x, why: '' } : { q: String(x?.q || x?.question || '').trim(), why: String(x?.why || x?.pourquoi || '').trim() }))
    .filter((x) => x.q.length >= 8).slice(0, 10).map((x) => ({ q: x.q.slice(0, 300), why: x.why.slice(0, 300) }));
}

export function normalizeFeedback(a) {
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5).map((s) => s.slice(0, 300));
  const note = Math.round(Number(a?.note ?? a?.score));
  return { note: Number.isFinite(note) ? Math.min(10, Math.max(0, note)) : null, strengths: arr(a?.points_forts ?? a?.strengths), improve: arr(a?.a_ameliorer ?? a?.improvements), example: String(a?.exemple ?? a?.example ?? '').trim().slice(0, 1500) };
}

/** Questions de la banque (sans IA) : les plus utiles d'abord, mélange stable du reste. */
export function bankQuestions(lang = 'fr', count = 6, seed = 1) {
  const list = BANK[lang] || BANK.fr;
  const first = list.slice(0, 2);
  const rest = list.slice(2).map((q, i) => ({ q, k: ((i + 1) * 9301 + seed * 49297) % 233280 })).sort((a, b) => a.k - b.k).map((x) => x.q);
  return [...first, ...rest].slice(0, Math.min(list.length, Math.max(3, count))).map((q) => ({ q, why: '' }));
}

/** Conseils sans IA : vérifications simples sur la réponse (longueur, exemple concret, chiffres). */
export function quickTips(answer, lang = 'fr') {
  const a = String(answer || '').trim();
  const words = a ? a.split(/\s+/).length : 0;
  const T = {
    fr: { short: 'Réponse très courte : développez avec un exemple concret.', long: 'Réponse longue : visez 1 à 2 minutes à l’oral (environ 120 à 250 mots).', example: 'Ajoutez un exemple vécu (situation, ce que vous avez fait, résultat).', number: 'Un chiffre rend la réponse plus forte (délai, nombre de clients, pourcentage…).', ok: 'Bonne longueur, avec un exemple et un résultat : entraînez-vous à la dire à voix haute.' },
    en: { short: 'Very short answer: add a concrete example.', long: 'Long answer: aim for 1–2 minutes spoken (about 120–250 words).', example: 'Add a real example (situation, what you did, result).', number: 'A number makes it stronger (time saved, customers, percentage…).', ok: 'Good length with an example and a result: practise saying it out loud.' },
    wo: { short: 'Tontu bi gàtt na lool : yokkal ci benn misaal.', long: 'Tontu bi gudd na : ñaari simili lu ëpp.', example: 'Indil benn misaal bu nga dund (li xew, li nga def, li ci génn).', number: 'Benn limu (diir, ñaata kiliyaan…) dina gën a dëgër tontu bi.', ok: 'Tontu bi baax na : jéemal ko wax ci kow.' },
  }[lang] || {};
  const tips = [];
  if (words < 40) tips.push(T.short);
  if (words > 300) tips.push(T.long);
  if (!/(par exemple|exemple|lorsque|quand|j['’]ai|for example|when i|i |misaal|bi ma)/i.test(a)) tips.push(T.example);
  if (!/\d/.test(a)) tips.push(T.number);
  return tips.length ? tips : [T.ok];
}

/** Bilan à copier (texte). */
export function summaryText(rounds, lang = 'fr') {
  const head = lang === 'en' ? 'Interview practice' : lang === 'wo' ? 'Waajal entretien' : 'Entraînement à l’entretien';
  const notes = rounds.map((r) => r.feedback?.note).filter((n) => Number.isFinite(n));
  const avg = notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null;
  return [`${head}${avg !== null ? ` — ${avg}/10` : ''}`, '', ...rounds.flatMap((r, i) => [`${i + 1}. ${r.q}`, r.answer ? `→ ${r.answer}` : '', r.feedback?.improve?.length ? `À travailler : ${r.feedback.improve.join(' ; ')}` : '', ''])].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
}
