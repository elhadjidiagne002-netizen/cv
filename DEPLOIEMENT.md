# Mise en ligne

Le site est entièrement statique : le dossier `public/` est publié tel quel, sans étape de build.

## GitHub Pages (en place)
- Workflow `.github/workflows/pages.yml` : à chaque mise à jour de `main`, les tests unitaires sont lancés puis
  `public/` est publié. Relance manuelle possible : onglet **Actions → Mise en ligne (GitHub Pages) → Run workflow**.
- **Prérequis, une seule fois** : dépôt → **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
- Adresse : https://elhadjidiagne002-netizen.github.io/cv/
- GitHub Pages ignore `public/_headers` : la politique de sécurité (CSP) est donc aussi déclarée en `<meta>` dans
  `index.html` et `app.html` (identique, vérifiée par `tests/deploy.test.js`). Seuls `frame-ancestors`,
  `X-Frame-Options`, HSTS et les en-têtes de cache ne s'appliquent pas sur GitHub Pages.

## Cloudflare Pages (recommandé à terme, prévu par le cahier des charges)
Applique aussi tous les en-têtes de `public/_headers` et permet un nom de domaine personnalisé.
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, choisir `elhadjidiagne002-netizen/cv`.
2. Branche de production : `main` ; **Build command** : (vide) ; **Build output directory** : `public`.
3. Déployer : l'adresse est de la forme `https://cv-xxx.pages.dev`. Chaque mise à jour de `main` redéploie.

## Vérifier après une mise en ligne
- La page d'accueil et l'éditeur s'ouvrent sans erreur dans la console.
- « Télécharger en PDF » produit un PDF au texte sélectionnable.
- Après une première visite, l'éditeur se recharge sans connexion (mode avion).
