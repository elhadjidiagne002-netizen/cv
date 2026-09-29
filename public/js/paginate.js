// Aperçu page par page : simule la pagination de l'impression dans l'aperçu (pages A4 / Letter séparées),
// sans jamais couper un bloc (élément d'expérience, ligne de compétences, paragraphe de lettre) et sans
// laisser un titre de rubrique seul en bas de page — comme le fait l'impression (break-inside / break-after).
// Des intercalaires invisibles (aria-hidden) décalent les blocs ; l'impression, elle, repart d'un rendu neuf.

const MM = 96 / 25.4;

/** Blocs insécables, du plus englobant au plus fin (seuls les plus englobants sont retenus). */
const ATOMS = [
  '.cv-head', '.cv-h', '.cv-item', '.cv-skill', '.cv-skill-group', '.cv-summary', '.cv-tags', '.cv-interests', '.cv-refs-demand',
  '.cv-place-date', '.cv-ep-mother', '.cv-ep-other-label', '.cv-contact-list > li', '.cv-list > li', '.cv-langs > li', '.cv-photo',
  '.lt-top', '.lt-subject', '.lt-ref', '.lt-salutation', '.lt-body > p', '.lt-closing', '.lt-signature', '.lt-enclosures',
].join(', ');

/** Espace visuel entre deux pages dans l'aperçu (px). */
export const PAGE_GAP = 28;

/** Dimensions d'une page (px CSS) : hauteur totale et marge haute/basse identique à @page. */
export function pageGeometry(paper) {
  return paper === 'Letter'
    ? { full: 11 * 96, margin: 0.5 * 96, content: 10 * 96 }
    : { full: 297 * MM, margin: 12 * MM, content: 273 * MM };
}

/**
 * Pagine un <article class="cv"> déjà inséré dans la page. Renvoie { pages, geometry, gap }.
 * Fonctionne aussi hors écran (mesure « Ajuster à 1 page ») et sous transformation d'échelle.
 */
export function paginate(article, paper, { gap = PAGE_GAP } = {}) {
  const g = pageGeometry(paper);
  const stride = g.full + gap;
  const artRect = () => article.getBoundingClientRect();
  const scale = article.offsetHeight ? artRect().height / article.offsetHeight || 1 : 1;
  const top = (el) => (el.getBoundingClientRect().top - artRect().top) / scale;
  const height = (el) => el.getBoundingClientRect().height / scale;
  article.querySelectorAll('.page-spacer').forEach((n) => n.remove());
  article.style.minHeight = '';
  const all = [...article.querySelectorAll(ATOMS)];
  const atoms = all.filter((el) => !all.some((other) => other !== el && other.contains(el)) && height(el) > 0);
  let lastBottom = 0;
  for (let i = 0; i < atoms.length; i += 1) {
    const el = atoms[i];
    const t = top(el);
    const h = height(el);
    const page = Math.max(0, Math.floor(t / stride));
    const contentEnd = page * stride + g.margin + g.content;
    if (t + h > contentEnd + 0.5 && h <= g.content) {
      // Un titre de rubrique ne reste jamais seul en bas de page : il part avec son premier bloc.
      const prev = atoms[i - 1];
      const target = prev && prev.matches('.cv-h') && Math.floor(top(prev) / stride) === page && prev.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING ? prev : el;
      const wanted = (page + 1) * stride + g.margin;
      const parent = target.parentElement;
      const spacer = document.createElement(parent && /^(UL|OL)$/.test(parent.tagName) ? 'li' : 'div');
      spacer.className = 'page-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.height = `${Math.max(0, wanted - top(target))}px`;
      parent.insertBefore(spacer, target);
      // Correction : marges fusionnées ou grilles peuvent décaler légèrement le bloc.
      const delta = wanted - top(target);
      if (Math.abs(delta) > 0.5) spacer.style.height = `${Math.max(0, parseFloat(spacer.style.height) + delta)}px`;
    }
    lastBottom = Math.max(lastBottom, top(el) + height(el));
  }
  const pages = Math.max(1, Math.floor(Math.max(0, lastBottom - 1) / stride) + 1);
  article.style.minHeight = `${pages * g.full + (pages - 1) * gap}px`;
  return { pages, geometry: g, gap };
}

/** Bandes grises entre les pages (dans le conteneur transformé de l'aperçu), avec « Page n / N ». */
export function drawPageGaps(container, article, { pages, geometry, gap }) {
  container.querySelectorAll('.page-gap').forEach((n) => n.remove());
  for (let p = 1; p < pages; p += 1) {
    const band = document.createElement('div');
    band.className = 'page-gap';
    band.setAttribute('aria-hidden', 'true');
    band.textContent = `Page ${p + 1} / ${pages}`;
    band.style.top = `${article.offsetTop + p * (geometry.full + gap) - gap}px`;
    band.style.height = `${gap}px`;
    // Déborde légèrement pour masquer l'ombre de la feuille : deux feuilles distinctes à l'écran.
    band.style.left = `${article.offsetLeft - 12}px`;
    band.style.width = `${article.offsetWidth + 24}px`;
    container.appendChild(band);
  }
}
