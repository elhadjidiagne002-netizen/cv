// Génère docs/relecture-wolof.md : tous les textes en wolof du site, à faire relire par un locuteur.
// Usage : node scripts/relecture-wolof.mjs   (à relancer après chaque modification des textes wolof)
import fs from 'node:fs';
import { BANK, quickTips } from '../public/js/interview-core.js';

const tips = [...new Set([...quickTips('', 'wo'), ...quickTips('x '.repeat(400), 'wo'), ...quickTips('Lorsque j’ai 3 clients et un exemple '.repeat(10), 'wo')])];
const aiSrc = fs.readFileSync(new URL('../public/js/ai.js', import.meta.url), 'utf8');
const ivSrc = fs.readFileSync(new URL('../public/js/interview-core.js', import.meta.url), 'utf8');
const rule = (src, re) => (src.match(re) || [])[0] || '';

const table = (rows) => ['| N° | Texte actuel | Correction proposée | Remarque |', '|---|---|---|---|', ...rows.map((r, i) => `| ${i + 1} | ${r.replace(/\|/g, '\\|')} |  |  |`)].join('\n');

const md = `# Relecture du wolof — CV en ligne

Document à remettre à un ou une locutrice du wolof (orthographe officielle du Sénégal, alphabet latin : à, é, ë, ñ, ŋ).
Merci de remplir la colonne « Correction proposée » (laisser vide si c'est correct) et d'ajouter toute remarque utile
(tournure plus naturelle, registre trop familier ou trop soutenu, mot français à remplacer…).

Généré le ${new Date().toLocaleDateString('fr-FR')} par \`node scripts/relecture-wolof.mjs\`.

## 1. Questions d'entretien de secours (simulateur, sans IA)

Affichées quand l'assistant IA n'est pas utilisé. Contexte : un recruteur pose la question à un candidat.

${table(BANK.wo)}

## 2. Conseils automatiques sur la réponse (simulateur, sans IA)

${table(tips)}

## 3. Consignes données à l'IA pour écrire en wolof

Ces phrases (en français) disent à l'IA comment écrire en wolof. Si le wolof produit vous semble mauvais, indiquez ce
qu'il faudrait lui demander en plus (exemples de bonnes formules, mots à éviter, registre).

- Simulateur d'entretien : « ${rule(ivSrc, /Écris en WOLOF[^']*/)} »
- Lettre de motivation : « ${rule(aiSrc, /une lettre en WOLOF[^']*/)} »

## 4. Exemple de wolof produit par l'IA (test du 07/10/2026, offre fictive d'assistant comptable)

À noter de 0 à 10 et à corriger si possible :

1. Lu taxul nga jëmm ci wàllu comptabilité, ndax am nga experience ci Excel ak rapprochements bancaires?
2. Naka la nga jëmm ci jàngal ak jàppale déclarations TVA ci wàllu fiscalité?
3. Lu taxul nga jàmm ci wàllu motivation, lu taxul nga bëgg jëmm ci assistant(e) comptable ci PME bi?
4. Naka la nga defar ay situation yu am solo, te dundal ci wàllu teamwork ak communication ci team bi?

Note globale : ___ / 10 — Remarques :
`;
fs.mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../docs/relecture-wolof.md', import.meta.url), md);
console.log('docs/relecture-wolof.md écrit :', BANK.wo.length, 'questions,', tips.length, 'conseils');
