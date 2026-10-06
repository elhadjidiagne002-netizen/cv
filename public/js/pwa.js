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

// Application Android « CV en ligne » : vraie application installable (APK signé, Trusted Web Activity), construite et
// publiée par le dépôt public elhadjidiagne002-netizen/nexus-apps (remplace l'ancien raccourci « Installer »).
export const ANDROID_PACKAGE = 'sn.nexusmarket.cv';
export const APK_URL = 'https://github.com/elhadjidiagne002-netizen/nexus-apps/releases/latest/download/cv-en-ligne.apk';
const IN_APP_KEY = 'cv:in-android-app';

/** Ouvert DANS l'application Android ? (referrer « android-app://<paquet> » au lancement, mémorisé pour la session) */
export function insideAndroidApp({ referrer = globalThis.document?.referrer || '', storage = globalThis.sessionStorage } = {}) {
  let inside = referrer.startsWith(`android-app://${ANDROID_PACKAGE}`);
  try {
    if (inside) storage?.setItem(IN_APP_KEY, '1');
    else inside = storage?.getItem(IN_APP_KEY) === '1';
  } catch { /* stockage indisponible */ }
  return inside;
}

/** « android », « ios » ou « autre ». */
export function mobilePlatform(ua = globalThis.navigator?.userAgent || '') {
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'autre';
}

/** Lien « Application Android » : visible sur Android, sauf dans l'application elle-même. */
export function setupAppLink(link) {
  if (!link) return;
  link.href = APK_URL;
  link.hidden = !(mobilePlatform() === 'android' && !insideAndroidApp());
}
