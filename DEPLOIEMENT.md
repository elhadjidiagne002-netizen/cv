# Mise en ligne

Le site est entièrement statique : le dossier `public/` est publié tel quel, sans étape de build.

## Cloudflare Pages (en production)
- Adresse : **https://cv-en-ligne.pages.dev** — chaque mise à jour de `main` est publiée automatiquement ; les autres
  branches obtiennent une adresse d'aperçu `https://<branche>.cv-en-ligne.pages.dev`.
- Tous les en-têtes de `public/_headers` (CSP, HSTS, anti-iframe, cache) et la page `404.html` s'appliquent.
- Après chaque publication, les visiteurs reçoivent la nouvelle version dès qu'ils ont du réseau (service worker
  « réseau d'abord ») ; un bandeau « Nouvelle version disponible » propose de recharger l'éditeur.

## Administration et monétisation (Pages Functions + D1)
Le dossier `functions/` (à la racine du dépôt) est déployé automatiquement par Cloudflare Pages avec `public/` :
il fournit `/api/*` (offres, commandes, codes, statistiques anonymes) et le tableau de bord **/admin.html**.
**Sans configuration, le site reste 100 % gratuit** (`/api/config` répond « non configuré ») : rien ne casse.

### À faire une seule fois dans Cloudflare
1. **Workers & Pages → D1 → Create database** : nom `cv-en-ligne` (base propre au site CV ; les tables sont créées
   automatiquement au premier appel, et 4 offres d'exemple *désactivées*).
2. Projet Pages **cv-en-ligne → Settings → Bindings → Add → D1 database** :
   - `DB` → `cv-en-ligne` ;
   - `AUTH_DB` → la base D1 de **Devizo** (celle qui contient les comptes, tables `tenants` et `totp_secrets`).
     Le site CV la **lit seulement** (vérification du mot de passe) et y met à jour le dernier code d'authentification
     utilisé (anti-rejeu partagé avec Devizo).
3. **Settings → Variables and secrets** (production) :
   - `ADMIN_EMAILS` : les mêmes e-mails super-admin que Devizo, séparés par des virgules (obligatoire) ;
   - facultatif : `RESEND_API_KEY` et `MAIL_FROM` pour recevoir un code par e-mail si le compte n'a pas
     d'application d'authentification ; `ADMIN_PASSWORD_ONLY=1` pour autoriser la connexion par mot de passe seul
     (déconseillé). Sans application d'authentification ni e-mail, la connexion est refusée.
4. **Redéployer** (Deployments → Retry deployment) pour que les liaisons soient prises en compte.

### Premiers pas dans le tableau de bord
1. Ouvrir https://cv-en-ligne.pages.dev/admin.html et se connecter avec le compte Devizo (e-mail, mot de passe,
   code de l'application d'authentification).
2. **Offres et pass** : ajuster prix, durée, crédits et description ; cocher « Proposée à la vente ».
3. **Modèles** : choisir les modèles premium (par défaut : les 12 « Raffinés ») et ceux à masquer.
4. **Réglages** : numéros Wave et/ou Orange Money, instructions, annonce ; puis **Activer la monétisation**.
5. **Commandes** : vérifier chaque paiement dans l'application Wave / Orange Money, puis « Paiement reçu : valider »
   (le code est créé ; bouton WhatsApp pour l'envoyer). L'acheteur peut aussi le récupérer seul avec
   « J'ai payé : vérifier ».

### Limites connues
- Le blocage de l'impression PDF des modèles premium se fait dans le navigateur : une personne très motivée peut le
  contourner ; les crédits de téléchargement, eux, sont décomptés par le serveur.
- Test local complet (API comprise, base en mémoire) : `npm run serve` puis http://localhost:5610/admin.html
  (compte de test `admin@nexusmarket.sn` / `Mot-de-passe-1`, secret TOTP dans `tests/ui/server.mjs`).

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
- `/api/config` répond (JSON) ; `/admin.html` affiche la connexion administrateur.
