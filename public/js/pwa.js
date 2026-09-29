// Mode hors ligne (PWA) : enregistre le service worker et propose l'installation de l'application.
// Aucune donnée n'est envoyée : le service worker ne met en cache que les fichiers du site.

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* Hors ligne indisponible (navigation privée, navigateur ancien) : l'application fonctionne quand même. */
  });
}

/** Affiche le bouton « Installer » quand le navigateur le permet. */
export function setupInstallButton(button, onInstalled = () => {}) {
  if (!button) return;
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    deferred = null;
    button.hidden = true;
    if (choice && choice.outcome === 'accepted') onInstalled();
  });
  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    onInstalled();
  });
}
