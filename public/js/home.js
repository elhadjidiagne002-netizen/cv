// Page d'accueil : aperçu réel d'un CV d'exemple (même moteur que l'éditeur).
import { createSampleCV } from './model.js';
import { renderCV, TEMPLATES } from './render.js';

const target = document.getElementById('hero-cv');
if (target) {
  target.innerHTML = renderCV(createSampleCV(), 'moderne-ats');
  const fit = () => {
    const box = target.parentElement;
    const article = target.firstElementChild;
    if (box && article) target.style.transform = `scale(${box.clientWidth / article.offsetWidth})`;
  };
  fit();
  window.addEventListener('resize', () => requestAnimationFrame(fit));
}
const count = document.getElementById('tpl-count');
if (count) count.textContent = String(TEMPLATES.length);
