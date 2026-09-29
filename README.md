# CV en ligne

Créez un CV professionnel en quelques minutes : des dizaines de modèles, un aperçu en direct et un
PDF conforme aux normes du recrutement (lisible par les logiciels de tri, normes françaises,
Europass, résumé anglo-saxon).

- 100 % dans le navigateur : vos données ne quittent pas votre appareil, sauf si vous utilisez l'assistant IA
  (facultatif, avec accord explicite, parcours professionnel seulement — jamais l'identité ni les coordonnées).
- Gratuit, sans compte.

## Utilisation locale
- Site statique : ouvrir `public/` avec n'importe quel serveur, ou `npm run serve` (port 5610, avec la CSP de `_headers`).
- Tests unitaires : `npm test` — tests d'interface : `npx playwright test` (après `npm install`).
- Déploiement : Cloudflare Pages, dossier de sortie `public/`, aucune commande de build.
  **À chaque déploiement, changer `VERSION` dans `public/sw.js`** (sinon les utilisateurs hors ligne gardent l'ancienne version) ;
  tout nouveau fichier de `public/` doit être ajouté à la liste `ASSETS` (vérifié par `tests/pwa.test.js`).
- Polices : Inter, Lato, Source Serif 4, Merriweather, Montserrat, EB Garamond (SIL Open Font License 1.1,
  sous-ensemble latin issu de Fontsource), dans `public/fonts/<police>/` avec leur licence `OFL.txt`.

Voir `CLAUDE.md` (cahier des charges et normes), `ROADMAP.md` (avancement) et `JOURNAL.md` (historique).
