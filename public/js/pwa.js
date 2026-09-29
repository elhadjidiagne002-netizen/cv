// Mode hors ligne (PWA) : enregistre le service worker et propose l'installation de l'application.
// Aucune donnée n'est envoyée : le service worker ne met en cache que les fichiers du site.

/**
 * Enregistre le service worker. onUpdate() est appelé quand une nouvelle version du site vient d'être
 * installée alors que la page était déjà ouverte : l'application propose alors de recharger.
 */
export function registerServiceWorker(onUpdate = () => {}) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) onUpdate();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Vérifie les mises à jour quand l'utilisateur revient sur l'onglet (sessions longues, application installée).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {
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
