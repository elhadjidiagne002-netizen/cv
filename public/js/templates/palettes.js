// Palettes de couleurs proposées pour les modèles (3 à 5 par modèle, la première = couleurs d'origine).
// accent : titres et filets (contraste ≥ 4,5:1 sur blanc, et du blanc sur l'accent pour les bandeaux) ;
// soft : teinte claire (fonds de colonne ou de titre) ; deep : encre foncée lisible sur « soft ».

export const PALETTES = {
  'bleu-nuit': { name: 'Bleu nuit', accent: '#1f3a5f', soft: '#e8eef5', deep: '#13253d' },
  petrole: { name: 'Bleu pétrole', accent: '#0b5563', soft: '#e3f0f2', deep: '#083f4a' },
  bordeaux: { name: 'Bordeaux', accent: '#6d1a2a', soft: '#f6e9ec', deep: '#3f0f18' },
  foret: { name: 'Vert forêt', accent: '#2f5d34', soft: '#e8f1e5', deep: '#1c3a20' },
  ocre: { name: 'Ocre', accent: '#8a3b12', soft: '#fbeee4', deep: '#4a1f08' },
  ocean: { name: 'Océan', accent: '#0b4f8a', soft: '#e6f1fa', deep: '#0a2f52' },
  ardoise: { name: 'Ardoise', accent: '#2f3e4e', soft: '#eceff3', deep: '#1c2630' },
  indigo: { name: 'Indigo', accent: '#3730a3', soft: '#ecebfb', deep: '#211c6b' },
  corail: { name: 'Corail', accent: '#a3341f', soft: '#fdf0ec', deep: '#5c1c10' },
  prune: { name: 'Prune', accent: '#5b2a6e', soft: '#f3eaf6', deep: '#361842' },
  anthracite: { name: 'Anthracite', accent: '#333333', soft: '#efefef', deep: '#1a1a1a' },
  bronze: { name: 'Bronze', accent: '#7a5a12', soft: '#f7f0de', deep: '#45330a' },
  emeraude: { name: 'Émeraude', accent: '#0f6b5c', soft: '#e2f3ef', deep: '#093f36' },
  brique: { name: 'Rouge brique', accent: '#9b2c2c', soft: '#fbeaea', deep: '#561818' },
  europe: { name: 'Bleu Europe', accent: '#0e47cb', soft: '#e7eefc', deep: '#0a2f86' },
  marine: { name: 'Bleu marine', accent: '#00386b', soft: '#e5eef7', deep: '#00213f' },
  noir: { name: 'Noir', accent: '#111111', soft: '#f0f0f0', deep: '#000000' },
};

/** Liste de palettes (objets complets avec leur identifiant) à partir de leurs identifiants. */
export function palettes(...ids) {
  return ids.map((id) => {
    if (!PALETTES[id]) throw new Error(`Palette inconnue : ${id}`);
    return { id, ...PALETTES[id] };
  });
}
