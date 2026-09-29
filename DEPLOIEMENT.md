# Mise en ligne

Le site est entièrement statique : le dossier `public/` est publié tel quel, sans étape de build.

## Cloudflare Pages (en production)
- Adresse : **https://cv-en-ligne.pages.dev** — chaque mise à jour de `main` est publiée automatiquement ; les autres
  branches obtiennent une adresse d'aperçu `https://<branche>.cv-en-ligne.pages.dev`.
- Tous les en-têtes de `public/_headers` (CSP, HSTS, anti-iframe, cache) et la page `404.html` s'appliquent.
- Après chaque publication, les visiteurs reçoivent la nouvelle version dès qu'ils ont du réseau (service worker
  « réseau d'abord ») ; un bandeau « Nouvelle version disponible » propose de recharger l'éditeur.

## Intégration continue (GitHub Actions)
- `.github/workflows/pages.yml` lance les tests unitaires à chaque push et pull request.

## GitHub Pages (secours, à la demande)
- **Actions → Tests et mise en ligne de secours → Run workflow** publie `public/` sur GitHub Pages.
- **Prérequis, une seule fois** : dépôt → **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
- Adresse : https://elhadjidiagne002-netizen.github.io/cv/
- GitHub Pages ignore `public/_headers` : la politique de sécurité (CSP) est donc aussi déclarée en `<meta>` dans
  `index.html` et `app.html` (identique, vérifiée par `tests/deploy.test.js`). Seuls `frame-ancestors`,
  `X-Frame-Options`, HSTS et les en-têtes de cache ne s'appliquent pas sur GitHub Pages.

## Recréer le projet Cloudflare Pages (si besoin)
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, choisir `elhadjidiagne002-netizen/cv`.
2. Branche de production : `main` ; **Build command** : (vide) ; **Build output directory** : `public`.

## Vérifier après une mise en ligne
- La page d'accueil et l'éditeur s'ouvrent sans erreur dans la console.
- « Télécharger en PDF » produit un PDF au texte sélectionnable.
- Après une première visite, l'éditeur se recharge sans connexion (mode avion).
