// Dossier de candidature (« Candidature Express », 06/10/2026) : CV + lettre + pièces jointes (diplômes,
// attestations, pièce d'identité…) réunis en UN SEUL PDF, plus le message d'envoi prêt à copier.
// Tout reste dans le navigateur : les images ne sont ni enregistrées ni envoyées.

export const PIECES = ['Copie du diplôme', 'Relevé de notes', 'Attestation de travail', 'Attestation de stage', 'Certificat de formation',
  'Pièce d\'identité', 'Lettre de recommandation', 'Autre pièce'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Pages des pièces jointes (une par image), à la suite du CV et de la lettre. */
export function attachmentsHTML(items) {
  return items.map((it, i) => `<section class="dossier-page"><p class="dossier-label">Pièce ${i + 1} — ${esc(it.label)}</p><img src="${esc(it.src)}" alt="${esc(it.label)}"></section>`).join('');
}

/** Liste des documents du dossier, dans l'ordre du PDF. */
export function contents({ hasLetter, items }) {
  return ['Curriculum vitae', ...(hasLetter ? ['Lettre de motivation'] : []), ...items.map((it) => it.label)];
}

/** Message d'envoi (e-mail ou WhatsApp) : objet + corps, d'après le CV et la lettre. */
export function sendMessage(cv, { hasLetter, items }) {
  const id = cv.identity || {};
  const who = [id.firstName, id.lastName].filter(Boolean).join(' ') || '[Prénom Nom]';
  const job = cv.targetTitle || cv.letter?.subject?.replace(/^(objet\s*:\s*)?candidature (au poste de |pour le poste de )?/i, '') || '[intitulé du poste]';
  const org = cv.letter?.organization || '';
  const list = contents({ hasLetter, items });
  const subject = `Candidature — ${job} — ${who}`;
  const body = `Madame, Monsieur,

Je vous adresse ma candidature au poste de ${job}${org ? ` au sein de ${org}` : ''}.
Vous trouverez en pièce jointe mon dossier complet, réuni en un seul fichier PDF :
${list.map((x) => `- ${x}`).join('\n')}

Je reste à votre disposition pour un entretien${id.phone ? ` au ${id.phone}` : ''}${id.email ? ` ou par e-mail (${id.email})` : ''}.

Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

${who}`;
  return { subject, body };
}

/** Réduit une image (photo de diplôme prise au téléphone) pour un PDF léger mais lisible. */
export async function compressImage(file, max = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Image illisible.')); i.src = url; });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}
