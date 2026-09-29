# Journal du projet (le plus récent en haut)

## 2026-09-29 — cycle 1 : fondations livrées
**Fait.** Application statique complète de création de CV, sans serveur ni dépendance d'exécution :
modèle de données + validation + exemples (profil sénégalais FR et EN), sauvegarde locale de plusieurs
CV avec export/import JSON, éditeur par rubriques (ajout, suppression, réordonnancement des éléments et
des rubriques) avec aperçu en direct, 16 modèles en 5 familles (dont 5 ATS une colonne, Europass,
résumé US Letter, CV britannique, 4 créatifs à colonne, 3 à bandeau) avec galerie et miniatures en
direct, contrôleur de conformité (score /100, ~30 règles, alertes cliquables, corrections automatiques),
mode CV anonyme, rubriques FR/EN, export PDF par impression (A4 / Letter), accueil, CSP stricte.

**Pourquoi.** Cycle 1 sur 5 : poser des fondations solides et conformes aux normes du recrutement
(ATS, normes françaises, Europass, résumé américain) avant d'augmenter le nombre de modèles.

**Choix notables.**
- Le rendu produit une chaîne HTML (testable sous Node), jamais d'attribut `style=""` : la CSP
  `style-src 'self'` l'interdirait. Couleur d'accent et mise à l'échelle passent par le CSSOM.
- La longueur du CV est **mesurée dans l'aperçu** (hauteur utile A4 273 mm / Letter 10 in) ; une
  estimation calibrée sert de repli hors navigateur.
- Modèles US/UK : photo et données personnelles jamais rendues, même si elles sont saisies.
- L'exemple tient sur une page dans le modèle par défaut (score 100/100).

**État.** 62 tests unitaires et 12 tests Playwright verts (sous la vraie CSP via `tests/ui/server.mjs`).
Non déployé (prêt pour Cloudflare Pages, dossier `public/`). Propositions du cycle 2 dans `ROADMAP.md`.

## 2026-09-29 — création du dépôt
Cahier des charges (`CLAUDE.md`), feuille de route et journal posés. Le développement se fait en
5 cycles dans des sessions Claude cloud.
