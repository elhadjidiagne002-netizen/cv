# Journal du projet (le plus récent en haut)

## 2026-09-29 — cycle 3 : réalités sénégalaises, lettre de motivation, confort d'édition
**Fait.** **Lettre de motivation** assortie au modèle du CV, en 3 styles (standard, **administratif sénégalais**,
anglais), avec brouillon guidé construit à partir du CV et contrôle dédié (longueur, 1 page, formules, objet,
clichés, mots-clés de l'offre) ; **référentiel sénégalais** hors ligne (diplômes et équivalences, établissements,
villes, langues) pour les suggestions de saisie ; nouvelles règles (**+221** avec correction en un clic, **FCFA**
convertis pour l'étranger, **sigles de diplômes** expliqués, religion / ethnie / numéro de CNI) ; profils **Sénégal
fonction publique** (dossier de concours à cocher), Côte d'Ivoire, Maroc, Belgique, Suisse ; **WhatsApp**, second
numéro, lieu de naissance ; **langues « à l'oral »** ; **aide à la rédaction pour 23 métiers** ; **annuler /
rétablir** ; **masquer un élément** sans le supprimer ; **texte brut** (copier, `.txt`, partage) ; polices
**latin étendu** (ŋ, ɓ, ɗ, ƴ) ; exemple « jeune diplômé ».

**Pourquoi.** Demande explicite : « améliorations majeures et adaptations aux réalités sénégalaises ». La lettre
(et la demande d'emploi administrative) est exigée dans la plupart des candidatures au Sénégal ; les contrôles
locaux évitent des erreurs fréquentes (numéro illisible depuis l'étranger, FCFA incompris, BFEM inconnu en
France, mentions confessionnelles) ; les exemples par métier aident les candidats peu habitués au CV.

**Choix notables.**
- Lettre rendue avec les classes du modèle (`.cv .tpl-<id>`) et `head()` partagé : assortie aux 33 modèles sans
  CSS par modèle. Toujours nominative (le mode anonyme ne concerne que le CV).
- Brouillon honnête : années d'expérience arrondies à l'inférieur, passages [ … ] obligatoirement personnalisés
  (le contrôleur du CV et celui de la lettre les signalent).
- Éléments masqués : `checkCV` analyse le CV visible puis recalcule les chemins (`experiences.2.start`) vers les
  positions réelles, pour que les alertes cliquables amènent toujours au bon champ.
- Religion / ethnie : recherche limitée aux champs personnels (accroche, intérêts, compétences, bénévolat,
  identité) pour ne pas signaler « Université catholique de l'Afrique de l'Ouest ».
- Historique d'annulation : instantanés JSON (sans `updatedAt`), frappe regroupée (700 ms), listes et cases
  validées immédiatement ; Ctrl+Z laisse l'annulation native dans les champs texte.
- Polices latin-ext (≈ 560 Ko) exclues du pré-cache hors ligne : coût data important pour un usage rare.

**État.** 118 tests unitaires et 26 tests Playwright verts (sous la vraie CSP). Propositions du cycle 4 dans
`ROADMAP.md` (JSON Resume / LinkedIn / .docx, rubriques personnalisées, pagination visuelle).

## 2026-09-29 — cycle 2 : 33 modèles, hors ligne, offre d'emploi, normes par pays
**Fait.** Catalogue porté de 16 à **33 modèles** en 11 familles (dont colonne de dates, académique,
fonctionnel / reconversion, étudiant, métiers, Québec / Canada, Lebenslauf), chacun avec 3 à 5 palettes ;
rubriques Distinctions et Publications ; 6 polices libres OFL embarquées ; **mode hors ligne** installable
(manifeste + service worker) ; **correspondance avec une offre d'emploi** calculée localement (taux,
mots-clés présents / manquants, ajout aux compétences) ; ~15 **nouvelles règles** (trous, chevauchements,
verbes répétés, temps mélangés, mots creux, ponctuation, majuscules, doubles espaces, téléphone
international, âge déductible) et **profils de 6 pays** ; bouton **« Ajuster à 1 page »** (≥ 9 pt).

**Pourquoi.** Cycle 2 sur 5 : la variété des modèles et l'adaptation au pays / à l'offre sont ce qui
distingue un bon outil de CV ; le hors ligne compte beaucoup avec une connexion mobile instable.

**Choix notables.**
- Palettes appliquées par variables CSS via le CSSOM (`themeVars` pur et testé) ; la première palette de
  chaque modèle = couleurs d'origine, donc aucun changement visuel pour les CV existants.
- Colonne de dates « à gauche » obtenue en CSS (grille interne à l'élément) : l'ordre HTML titre → dates
  est conservé, ces modèles restent ATS.
- L'ajustement mesure le CV hors écran niveau par niveau et enregistre le niveau (`meta.fit`) : l'aperçu et
  le PDF sont identiques. Les marges d'impression ne bougent jamais.
- Extraction des mots-clés sans dictionnaire : expressions fréquentes, sigles / noms d'outils, « X de Y »,
  mots vides et termes génériques d'annonce écartés, racines grossières pour rapprocher les formes.
- Polices : sous-ensemble latin de Fontsource (licence OFL jointe), 400 / 700 / italique.
- `playwright.config.mjs` utilise le Chromium préinstallé (`/opt/pw-browsers/chromium`) si la version
  attendue par Playwright n'est pas téléchargée.

**État.** 97 tests unitaires et 19 tests Playwright verts (sous la vraie CSP). Propositions du cycle 3
dans `ROADMAP.md` (lettre de motivation en tête).

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
