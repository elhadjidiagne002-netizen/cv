// Attestations délivrées par l'employeur (06/10/2026) : de travail, de stage, de formation.
// Module pur (testé sous Node) : données nettoyées → paragraphes du document. Rien n'est envoyé à un serveur.

export const TYPES = {
  travail: { label: 'Attestation de travail', title: 'ATTESTATION DE TRAVAIL' },
  stage: { label: 'Attestation de stage', title: 'ATTESTATION DE STAGE' },
  formation: { label: 'Attestation de formation', title: 'ATTESTATION DE FORMATION' },
};
export const CONTRATS = ['CDI', 'CDD', 'Contrat de prestation', 'Contrat saisonnier', 'Journalier'];

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const txt = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

export function dateFr(iso) {
  if (!isDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}`;
}

export function clean(i = {}) {
  return {
    type: TYPES[i.type] ? i.type : 'travail',
    employer: { name: txt(i.employer?.name, 120), address: txt(i.employer?.address, 200), ninea: txt(i.employer?.ninea, 40), phone: txt(i.employer?.phone, 30) },
    signer: { name: txt(i.signer?.name, 100), role: txt(i.signer?.role, 80) },
    person: { civ: i.person?.civ === 'Mme' ? 'Mme' : i.person?.civ === 'M.' ? 'M.' : '', name: txt(i.person?.name, 120), birth: isDate(i.person?.birth) ? i.person.birth : '', birthPlace: txt(i.person?.birthPlace, 80), id: txt(i.person?.id, 40) },
    job: txt(i.job, 120), contract: CONTRATS.includes(i.contract) ? i.contract : '',
    start: isDate(i.start) ? i.start : '', end: isDate(i.end) ? i.end : '', ongoing: Boolean(i.ongoing),
    school: txt(i.school, 160), missions: txt(i.missions, 900),
    course: txt(i.course, 160), hours: Math.max(0, Math.round(Number(i.hours) || 0)), result: txt(i.result, 120),
    place: txt(i.place, 60), date: isDate(i.date) ? i.date : '',
  };
}

/** Champs manquants (bloquent l'impression) et conseils. */
export function checks(a) {
  const errors = [];
  if (!a.employer.name) errors.push('Nom de l’entreprise ou de l’organisme');
  if (!a.person.name) errors.push(a.type === 'formation' ? 'Nom du participant' : a.type === 'stage' ? 'Nom du stagiaire' : 'Nom du salarié');
  if (!a.signer.name) errors.push('Nom du signataire');
  if (!a.start) errors.push('Date de début');
  if (!a.ongoing && !a.end && a.type !== 'travail') errors.push('Date de fin');
  if (a.type === 'travail' && !a.job) errors.push('Poste occupé');
  if (a.type === 'formation' && !a.course) errors.push('Intitulé de la formation');
  if (a.start && a.end && a.end < a.start) errors.push('La date de fin est avant la date de début');
  return errors;
}

/** Paragraphes du corps de l'attestation (texte réel, imprimable et copiable). */
export function paragraphs(a) {
  const fem = a.person.civ === 'Mme';
  const e = fem ? 'e' : '';
  const who = [a.person.civ, a.person.name].filter(Boolean).join(' ');
  const born = a.person.birth ? `, né${e} le ${dateFr(a.person.birth)}${a.person.birthPlace ? ` à ${a.person.birthPlace}` : ''}` : '';
  const idTxt = a.person.id ? `, titulaire de la pièce d’identité n° ${a.person.id}` : '';
  const signer = `Je soussigné${a.signer.role && /^(Mme|Madame)\b/.test(a.signer.name) ? 'e' : ''} ${a.signer.name}${a.signer.role ? `, ${a.signer.role}` : ''} de ${a.employer.name}`;
  const out = [];
  if (a.type === 'travail') {
    const period = a.ongoing || !a.end
      ? `est employé${e} au sein de notre structure depuis le ${dateFr(a.start)}`
      : `a été employé${e} au sein de notre structure du ${dateFr(a.start)} au ${dateFr(a.end)}`;
    out.push(`${signer}, atteste que ${who}${born}${idTxt}${born || idTxt ? ',' : ''} ${period}, en qualité de ${a.job}${a.contract ? ` (${a.contract})` : ''}.`);
    if (!a.ongoing && a.end) out.push(`${fem ? 'Elle' : 'Il'} quitte notre structure libre de tout engagement à notre égard.`);
  } else if (a.type === 'stage') {
    out.push(`${signer}, atteste que ${who}${born}${idTxt}${a.school ? `, ${fem ? 'étudiante' : 'étudiant'} à ${a.school}` : ''}, a effectué un stage au sein de notre structure du ${dateFr(a.start)} au ${dateFr(a.end)}${a.job ? `, au poste de ${a.job}` : ''}.`);
    if (a.missions) out.push(`Au cours de ce stage, ${fem ? 'elle' : 'il'} a notamment : ${a.missions.replace(/\.$/, '')}.`);
  } else {
    out.push(`${signer}, atteste que ${who}${born}${idTxt} a suivi la formation « ${a.course} »${a.hours ? ` d’une durée de ${a.hours} heures` : ''}, ${a.end && a.end !== a.start ? `du ${dateFr(a.start)} au ${dateFr(a.end)}` : `le ${dateFr(a.start)}`}.`);
    if (a.result) out.push(`Résultat : ${a.result}.`);
  }
  out.push(`En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.`);
  return out;
}

export function fileName(a) {
  const n = a.person.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return `attestation-${a.type}-${n || 'document'}`;
}
