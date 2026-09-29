// Page « Confidentialité » : effacement, en un clic, de toutes les données de l'application dans ce navigateur.
import { registerServiceWorker } from './pwa.js';

const button = document.getElementById('btn-wipe');
const status = document.getElementById('wipe-status');

async function wipe() {
  // eslint-disable-next-line no-alert
  if (!window.confirm('Effacer définitivement tous vos CV, lettres et candidatures enregistrés dans ce navigateur ?')) return;
  let removed = 0;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('cvapp.')) {
        localStorage.removeItem(key);
        removed += 1;
      }
    }
  } catch {
    /* stockage inaccessible : rien à effacer */
  }
  if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  status.textContent = removed
    ? `Données effacées (${removed} élément${removed > 1 ? 's' : ''}). Le site repart de zéro à la prochaine ouverture de l'éditeur.`
    : 'Aucune donnée de CV n\'était enregistrée dans ce navigateur.';
}

if (button) button.addEventListener('click', wipe);
registerServiceWorker();
