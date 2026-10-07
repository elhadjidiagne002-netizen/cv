// Page « Simulateur d'entretien » : offre collée → questions → réponses → note et conseils (IA facultative).
// Sans accord pour l'IA (ou hors ligne) : questions classiques et conseils simples calculés sur l'appareil.
import { createStore } from './storage.js';
import { AI_CONSENT_KEY, AIError, callAI, profileForAI, parseAIJson } from './ai.js';
import { maskPersonal } from './aitext.js';
import { track } from './premium.js';
import { LANGS, questionMessages, feedbackMessages, normalizeQuestions, normalizeFeedback, bankQuestions, quickTips, summaryText } from './interview-core.js';

const root = document.getElementById('iv-app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const consented = () => { try { return localStorage.getItem(AI_CONSENT_KEY) === '1'; } catch { return false; } };
const store = createStore();
const cvList = store.list();
const cv = cvList.length ? store.load(cvList[0].id) : null;

// Dictée du navigateur (Chrome, Edge, Safari) : répondre à voix haute, comme en vrai entretien. Le wolof n'est pas reconnu.
const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
const MIC_OK_KEY = 'cv-dictee-ok-v1';
const DICTEE_LANG = { fr: 'fr-FR', en: 'en-US' };
let rec = null;
const st = { step: 'setup', offer: (cv && cv.meta.jobOffer) || '', lang: cv && cv.meta.lang === 'en' ? 'en' : 'fr', count: 6, useCv: Boolean(cv), questions: [], i: 0, rounds: [], busy: false, error: '', ai: consented() };

function draw() {
  if (st.step === 'setup') {
    root.innerHTML = `<div class="tool-card">
      <div class="field"><label for="iv-offer">Offre d'emploi (copiez-collez l'annonce)</label><textarea id="iv-offer" rows="7" maxlength="6000" placeholder="Intitulé du poste, missions, profil recherché…">${esc(st.offer)}</textarea></div>
      <div class="tool-grid">
        <div class="field"><label for="iv-lang">Langue de l'entretien</label><select id="iv-lang">${Object.entries(LANGS).map(([k, l]) => `<option value="${k}"${k === st.lang ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="iv-count">Nombre de questions</label><select id="iv-count">${[4, 6, 8, 10].map((n) => `<option${n === st.count ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      ${cv ? `<label class="tool-row"><input type="checkbox" id="iv-usecv"${st.useCv ? ' checked' : ''}> Adapter les questions à mon parcours (CV « ${esc(cv.meta.title)} », sans nom ni coordonnées)</label>` : ''}
      <label class="tool-row"><input type="checkbox" id="iv-ai"${st.ai ? ' checked' : ''}> Utiliser l'assistant IA : l'offre, mon parcours sans identité et mes réponses (e-mails et numéros masqués) sont envoyés au service d'IA de NEXUS Market pour générer les questions et noter mes réponses. Rien n'est conservé par CV en ligne.</label>
      <p class="tool-muted">Sans l'IA : questions classiques des recruteurs et conseils simples, calculés sur votre téléphone.</p>
      <div class="tool-row"><button type="button" class="btn btn-primary" id="iv-start"${st.busy ? ' disabled' : ''}>${st.busy ? 'Préparation des questions…' : 'Commencer l’entretien'}</button></div>
      ${st.error ? `<p class="tool-err" role="alert">${esc(st.error)}</p>` : ''}
    </div>`;
    return;
  }
  if (st.step === 'question') {
    const q = st.questions[st.i];
    const r = st.rounds[st.i] || {};
    root.innerHTML = `<div class="tool-card">
      <p class="iv-step">Question ${st.i + 1} / ${st.questions.length}</p>
      <p class="iv-q">${esc(q.q)}</p>
      ${q.why ? `<p class="tool-muted">Ce que le recruteur vérifie : ${esc(q.why)}</p>` : ''}
      <div class="field"><label for="iv-answer">Votre réponse (comme à l'oral)</label><textarea id="iv-answer" rows="7" maxlength="2500"${r.feedback ? ' readonly' : ''}>${esc(r.answer || '')}</textarea></div>
      ${!r.feedback && Recognition && DICTEE_LANG[st.lang] ? `<div class="tool-row"><button type="button" class="btn" id="iv-mic" aria-pressed="${rec ? 'true' : 'false'}">${rec ? '⏹ Arrêter la dictée' : '🎤 Répondre à voix haute'}</button><span class="tool-muted" id="iv-mic-state">${rec ? 'Parlez : le texte s’écrit tout seul.' : ''}</span></div>` : ''}
      ${!r.feedback && Recognition && st.lang === 'wo' ? '<p class="tool-muted">La dictée du téléphone ne reconnaît pas encore le wolof : écrivez votre réponse.</p>' : ''}
      ${r.feedback ? feedbackHtml(r.feedback) : ''}
      ${st.error ? `<p class="tool-err" role="alert">${esc(st.error)}</p>` : ''}
      <div class="tool-row">
        ${r.feedback ? '' : `<button type="button" class="btn btn-primary" id="iv-eval"${st.busy ? ' disabled' : ''}>${st.busy ? 'Analyse…' : 'Évaluer ma réponse'}</button>`}
        ${r.feedback ? `<button type="button" class="btn btn-primary" id="iv-next">${st.i + 1 < st.questions.length ? 'Question suivante' : 'Voir le bilan'}</button>
          <button type="button" class="btn" id="iv-retry">Réessayer cette question</button>` : `<button type="button" class="btn" id="iv-skip">Passer</button>`}
      </div>
    </div>`;
    return;
  }
  const notes = st.rounds.map((r) => r.feedback?.note).filter((n) => Number.isFinite(n));
  const avg = notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null;
  root.innerHTML = `<div class="tool-card">
    <h2>Bilan</h2>
    ${avg !== null ? `<p class="iv-score">${avg} / 10</p>` : ''}
    <ul class="tool-list">${st.rounds.map((r, i) => `<li><strong>${i + 1}. ${esc(r.q)}</strong>${Number.isFinite(r.feedback?.note) ? ` — ${r.feedback.note}/10` : r.answer ? '' : ' — passée'}
      ${r.feedback?.improve?.length ? `<div class="tool-muted">À travailler : ${esc(r.feedback.improve.join(' ; '))}</div>` : ''}</li>`).join('')}</ul>
    <div class="tool-row"><button type="button" class="btn btn-primary" id="iv-copy">Copier le bilan</button><button type="button" class="btn" id="iv-again">Nouvel entretien</button>
      <a class="btn" href="app.html">Retour à mon CV</a></div>
    <p class="tool-muted">Conseil : relisez les « meilleures réponses » à voix haute, puis refaites l'entretien demain sans regarder vos notes.</p>
  </div>`;
}

function feedbackHtml(f) {
  return `<div class="iv-fb tool-card">
    ${Number.isFinite(f.note) ? `<p class="iv-score">${f.note} / 10</p>` : ''}
    ${f.strengths.length ? `<h3>Points forts</h3><ul>${f.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    ${f.improve.length ? `<h3>À améliorer</h3><ul>${f.improve.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    ${f.example ? `<h3>Une réponse plus forte</h3><p>${esc(f.example).replace(/\n/g, '<br>')}</p><p class="tool-muted">Les passages entre crochets [ … ] sont à compléter avec vos vrais faits.</p>` : ''}
  </div>`;
}

async function start() {
  st.offer = document.getElementById('iv-offer').value.trim();
  st.lang = document.getElementById('iv-lang').value;
  st.count = Number(document.getElementById('iv-count').value);
  st.useCv = Boolean(document.getElementById('iv-usecv')?.checked);
  st.ai = document.getElementById('iv-ai').checked;
  st.error = '';
  if (st.ai) { try { localStorage.setItem(AI_CONSENT_KEY, '1'); } catch { /* stockage bloqué */ } }
  if (st.ai && st.offer.length >= 40) {
    st.busy = true; draw();
    try {
      const raw = await callAI(questionMessages({ offer: maskPersonal(st.offer).masked, profile: st.useCv && cv ? profileForAI(cv) : null, lang: st.lang, count: st.count }), { maxTokens: 1200 });
      st.questions = normalizeQuestions(parseAIJson(raw));
      if (st.questions.length < 3) throw new AIError('Questions incomplètes : réessayez.');
    } catch (e) {
      st.error = `${e instanceof AIError ? e.message : 'L’assistant IA n’a pas répondu.'} Questions classiques utilisées à la place.`;
      st.questions = bankQuestions(st.lang, st.count, Date.now() % 97);
    }
    st.busy = false;
  } else {
    if (st.ai && st.offer.length < 40) st.error = 'Offre trop courte pour des questions sur mesure : questions classiques utilisées.';
    st.questions = bankQuestions(st.lang, st.count, Date.now() % 97);
  }
  st.rounds = st.questions.map((q) => ({ q: q.q, answer: '', feedback: null }));
  track('interview', st.lang);
  st.i = 0; st.step = 'question';
  draw();
}

async function evaluate() {
  const answer = document.getElementById('iv-answer').value.trim();
  const r = st.rounds[st.i];
  r.answer = answer;
  st.error = '';
  if (answer.length < 10) { st.error = 'Écrivez votre réponse (quelques phrases), comme vous la diriez.'; draw(); return; }
  if (st.ai) {
    st.busy = true; draw();
    try {
      const raw = await callAI(feedbackMessages({ question: r.q, answer: maskPersonal(answer).masked, offer: maskPersonal(st.offer).masked, lang: st.lang }), { maxTokens: 900 });
      r.feedback = normalizeFeedback(parseAIJson(raw));
    } catch (e) {
      st.error = e instanceof AIError ? e.message : 'L’assistant IA n’a pas répondu : conseils simples à la place.';
      r.feedback = { note: null, strengths: [], improve: quickTips(answer, st.lang), example: '' };
    }
    st.busy = false;
  } else {
    r.feedback = { note: null, strengths: [], improve: quickTips(answer, st.lang), example: '' };
  }
  draw();
}

function stopMic() { if (rec) { const r = rec; rec = null; try { r.stop(); } catch { /* déjà arrêtée */ } } }

/** Dictée : la première fois, on explique que le navigateur envoie la voix à son service de reconnaissance. */
function toggleMic() {
  if (rec) { stopMic(); draw(); return; }
  let ok = false;
  try { ok = localStorage.getItem(MIC_OK_KEY) === '1'; } catch { ok = false; }
  if (!ok) {
    // eslint-disable-next-line no-alert
    ok = confirm('Dictée vocale : votre navigateur (Google pour Chrome, Apple pour Safari) transcrit votre voix sur ses serveurs. CV en ligne ne reçoit et ne garde aucun son. Continuer ?');
    if (!ok) return;
    try { localStorage.setItem(MIC_OK_KEY, '1'); } catch { /* stockage bloqué */ }
  }
  const area = document.getElementById('iv-answer');
  const startText = area.value ? `${area.value.trimEnd()} ` : '';
  let finalText = '';
  rec = new Recognition();
  rec.lang = DICTEE_LANG[st.lang] || 'fr-FR';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript;
      else interim += ev.results[i][0].transcript;
    }
    const a = document.getElementById('iv-answer');
    if (a) a.value = (startText + finalText + interim).slice(0, 2500);
  };
  rec.onerror = (ev) => { st.error = ev.error === 'not-allowed' ? 'Micro refusé : autorisez-le dans les réglages du navigateur, ou écrivez votre réponse.' : 'La dictée s’est arrêtée. Réessayez ou écrivez votre réponse.'; rec = null; draw(); };
  rec.onend = () => { if (rec) { const a = document.getElementById('iv-answer'); st.rounds[st.i].answer = a ? a.value : st.rounds[st.i].answer; rec = null; draw(); } };
  try { rec.start(); track('dictation', st.lang); } catch { rec = null; }
  st.rounds[st.i].answer = area.value;
  draw();
}

root.addEventListener('input', (e) => { if (e.target.id === 'iv-answer' && st.rounds[st.i]) st.rounds[st.i].answer = e.target.value; });
root.addEventListener('click', (e) => {
  const id = e.target.closest('button')?.id;
  if (id === 'iv-mic') { toggleMic(); return; }
  if (id && id !== 'iv-mic') stopMic();
  if (id === 'iv-start') start();
  else if (id === 'iv-eval') evaluate();
  else if (id === 'iv-next' || id === 'iv-skip') { st.error = ''; if (st.i + 1 < st.questions.length) st.i += 1; else st.step = 'summary'; draw(); }
  else if (id === 'iv-retry') { st.rounds[st.i].feedback = null; st.error = ''; draw(); }
  else if (id === 'iv-again') { st.step = 'setup'; st.error = ''; draw(); }
  else if (id === 'iv-copy') navigator.clipboard?.writeText(summaryText(st.rounds, st.lang)).then(() => { e.target.textContent = 'Bilan copié ✓'; });
});

draw();
