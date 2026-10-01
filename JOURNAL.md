# Journal du projet (le plus récent en haut)

## 01/10/2026 — Service worker : pages hors ligne / réseau lent en « site inaccessible »
- **Cause** : Cloudflare Pages redirige `app.html` → `/app` (308). Le SW pré-cachait `app.html` (réponse redirigée) et la
  resservait aux navigations hors ligne ou quand le réseau dépassait 3,5 s → Chrome refuse (ERR_FAILED). Même défaut
  trouvé et corrigé sur My shop (où il bloquait chaque retour).
- **Correctif** (`public/sw.js`) : réponses redirigées recopiées (`clean`) avant cache et avant d'être servies ; page
  `/x` retrouvée dans le cache sous `x.html` ; VERSION changée. Serveur de test : redirige `*.html` comme Pages et sert
  `/x` → `x.html` (un test d'URL adapté).
- **Vérifié** : hors ligne, pages jamais visitées (`/app`, `/confidentialite`) : ancien SW ERR_FAILED, nouveau OK, en
  local et en production. Tests : mêmes 2 échecs préexistants (fins de ligne Windows), UI 19/19.

## 2026-09-30 — administration : connexion par mot de passe seul
**Fait.** À la demande du propriétaire (« enlever la vérification à deux étapes »), variable `ADMIN_PASSWORD_ONLY=1`
ajoutée au projet Pages (production et aperçu, `ADMIN_EMAILS` et liaisons D1 inchangés) puis redéploiement. Le
compte administrateur est le compte Devizo `elhadjidiagne002@gmail.com` (présent dans `tenants`, sans application
d'authentification) : la connexion à `/admin` se fait par e-mail + mot de passe Devizo.

**À savoir.** Si l'application d'authentification est un jour activée dans Devizo, le code sera de nouveau demandé
(la vérification TOTP passe avant ce réglage, cf. `login()` dans `functions/_lib/api.js`). Protection restante :
8 tentatives par e-mail et 20 par IP toutes les 15 minutes. Pour revenir à la double vérification : supprimer
`ADMIN_PASSWORD_ONLY` (ou ajouter `RESEND_API_KEY` pour un code par e-mail) puis redéployer.

## 2026-09-29 — domaine cv.nexusmarket.sn en service
**Fait.** Enregistrement DNS `CNAME cv → cv-en-ligne.pages.dev` (proxy Cloudflare) créé avec un jeton Cloudflare
« Modifier le DNS de la zone » limité à nexusmarket.sn, fourni par l'utilisateur dans un fichier local (supprimé
après usage) ; le jeton OAuth de wrangler n'a pas de droit DNS. Domaine « actif » dans Pages, certificat HTTPS
valide. Adresse officielle du site passée sur `https://cv.nexusmarket.sn/` (liens canoniques, Open Graph,
`robots.txt`, `sitemap.xml`, test `deploy.test.js`) ; `VERSION` du service worker changée.

## 2026-09-29 — cycle 8 mis en service (Cloudflare)
**Fait.** Réglages Cloudflare de `DEPLOIEMENT.md` : base D1 `cv-en-ligne` créée (id `b6ba6fe5…`, région WEUR) et liée
sous `DB` ; base D1 de Devizo liée sous `AUTH_DB` ; secret `ADMIN_EMAILS` = e-mail administrateur de Devizo (seul
e-mail présent dans son journal d'audit). Liaisons posées en production ET en aperçu (API Pages). Branche
`claude/sweet-cray-0tnf6f` fusionnée dans `main`, déployée en production (`wrangler pages deploy public` depuis la
racine : `functions/` est inclus).

**Vérifié en production.** `/api/config` → `configured: true` (9 tables créées au premier appel) ; connexion fausse →
401 « identifiants de votre compte Devizo » (lecture d'`AUTH_DB` OK) ; `/admin`, `/app`, `/` en 200, aucune erreur
console. Corrigé au passage : la page d'administration affichait « Session expirée » dès la première visite.

## 2026-09-29 — cycle 8 : tableau de bord admin (compte Devizo) et monétisation
**Fait.** Serveur minimal (Cloudflare Pages Functions + D1) et tableau de bord `/admin.html` : connexion avec le
compte Devizo, vue d'ensemble des ventes et de l'usage, validation des paiements Wave / Orange Money, gestion des
4 types de pass (durée, modèle à l'unité, crédits, abonnement), modèles premium ou masqués, codes offerts,
annonce, journal. Côté candidat : modèles premium signalés, fenêtre de déblocage, « Mes pass ».

**Pourquoi.** Demande : que l'administrateur puisse tout gérer et monétiser depuis son tableau de bord, avec le même
compte que Devizo. Décisions de l'utilisateur : les quatre types de pass, paiement Wave / Orange Money manuel,
même base D1 que Devizo.

**Choix notables.**
- Le contenu des CV ne quitte toujours pas le navigateur : le serveur ne connaît que offres, commandes (numéro de
  paiement effacé après 180 jours par défaut), codes et compteurs anonymes par jour (sans IP ni identifiant).
- Monétisation **désactivée par défaut** et offres d'exemple inactives ; sans base configurée, `/api/config` répond
  « non configuré » et tout reste gratuit (aucune régression pour le site en ligne).
- Connexion admin : vérification PBKDF2 et TOTP compatibles Devizo, anti-rejeu partagé (`last_step`), session
  HttpOnly limitée à `/api/admin`, SameSite=Strict, contrôle d'origine sur chaque écriture.
- Le blocage PDF des modèles premium est côté navigateur (contournable par un utilisateur averti) ; les crédits de
  téléchargement sont décomptés côté serveur. Assumé : paiement manuel, montants modestes.
- Le service worker ne met jamais en cache `/api/*` ni le tableau de bord.
- Bug trouvé par les tests d'interface : la recherche de codes mettait la note en majuscules (« LYCÉE » ≠ « lycée »
  pour `LIKE` de SQLite) ; corrigé.

**État.** 171 tests unitaires et 55 tests Playwright verts (axe-core : zéro violation sur l'administration et la
fenêtre de déblocage). À faire par le propriétaire : liaisons D1 `DB` / `AUTH_DB` et secret `ADMIN_EMAILS`.

## 2026-09-29 — cycle 7 : photo sur 41 modèles, 12 modèles raffinés
**Fait.** Photo facultative activée sur 9 modèles de plus (41 sur 45) ; emplacement « Ajouter une photo » cliquable
dans l'aperçu et la galerie (jamais imprimé) ; famille « Raffinés » de 12 modèles (6 compatibles ATS) et 3 palettes.

**Pourquoi.** Retour utilisateur : trop de modèles sans partie photo, besoin de designs plus soignés.

**Choix notables.**
- Photo jamais proposée sur les formats US, UK, Québec et Canada (usage anti-discrimination) : c'est une norme du
  cahier des charges, pas un oubli.
- L'emplacement photo est un élément d'aperçu : `aria-hidden`, masqué à l'impression, absent du texte brut et du
  Word ; le nombre de pages est mesuré sur le rendu d'impression pour rester égal au PDF.
- « Nordique » : première version en grille CSS (titre sur plusieurs rangées), abandonnée car la fragmentation des
  grilles à l'impression ne se reproduisait pas fidèlement dans l'aperçu ; remplacée par un titre flottant.
- Les décors (bande verticale, filets, dégradés, motifs) sont en CSS ; les bandes décoratives en marge sont
  retirées à l'impression pour respecter les marges de 12 mm.

**État.** 144 tests unitaires et 47 tests Playwright verts. Cycle 8 (admin + monétisation) en attente de décisions.

## 2026-09-29 — cycle 6 : site en production (mises à jour fiables, sauvegarde complète, confidentialité)
**Fait.** Service worker « réseau d'abord » avec délai de repli et bandeau « nouvelle version » ; sauvegarde complète
et restauration sans doublon ; numéros de page à l'impression ; pages Confidentialité (avec effacement des données)
et 404, `robots.txt`, `sitemap.xml`, Open Graph ; intégration continue sur chaque push.

**Pourquoi.** Le site est déployé sur https://cv-en-ligne.pages.dev. L'ancien service worker servait les scripts
« cache d'abord » et les mettait à jour un par un : après un déploiement, un visiteur pouvait obtenir une page neuve
avec des modules anciens ou mélangés, et l'éditeur pouvait planter. Sur téléphone, changer d'appareil faisait perdre
les CV faute de sauvegarde globale.

**Choix notables.**
- Réseau d'abord avec délai de 3,5 s : cohérence des versions en ligne, application utilisable sur réseau lent ou
  hors ligne. Les requêtes passent par le cache HTTP (`max-age=300`, `must-revalidate`) : revalidations légères.
- Restauration : un CV n'est remplacé que si la sauvegarde est plus récente (`updatedAt` conservé à la
  restauration) ; les candidatures sont fusionnées de même.
- Numéros de page par pages nommées CSS (`@page numbered { @bottom-right … }`), ajoutées seulement au moment de
  l'impression si le CV fait au moins 2 pages ; vérifiés dans le texte du PDF (pypdf).
- Le site en ligne n'est pas joignable depuis l'environnement de développement (politique réseau) : vérifications
  faites sur le serveur local qui applique `_headers`.

**État.** 140 tests unitaires et 45 tests Playwright verts. Propositions du cycle 7 dans `ROADMAP.md`.
## 2026-09-29 — assistant IA (lettre de motivation, conseils pour étoffer le CV) + mise en ligne Cloudflare
**Fait.** « ✨ Rédiger avec l'IA » dans la lettre (candidature, stage, relance, remerciement ; styles standard,
administratif, anglais ; tient compte de l'annonce collée) et « ✨ Conseils de l'IA » pour le CV (conseils classés
par priorité, accroche proposée, missions reformulées, compétences à valoriser). Chaque proposition s'applique d'un
clic, jamais automatiquement, et « Annuler » reste possible. Module pur `public/js/ai.js` (testé sous Node).
Site publié sur Cloudflare Pages : projet `cv-en-ligne` (https://cv-en-ligne.pages.dev, domaine `cv.nexusmarket.sn`
en attente de l'enregistrement DNS).

**Pourquoi.** Demande « ajouter l'IA utilisée dans NEXUS pour aider à rédiger les lettres de motivation et donner des
conseils pour étoffer le CV ».

**Choix notables.**
- Réutilise l'API d'IA de NEXUS Market (`https://nexusmarket.sn/api/ai`, Groq, clé côté serveur, anti-abus par IP) :
  aucune clé dans ce dépôt. Seule origine externe de la CSP (`connect-src`).
- **Seule exception à « rien ne quitte l'appareil »** : accord explicite demandé une fois (fenêtre dédiée) ;
  `profileForAI` n'envoie que le parcours professionnel, JAMAIS nom, téléphone, e-mail, adresse, photo, date de
  naissance, nationalité, situation familiale ni références (test dédié) ; éléments masqués non envoyés.
- Consignes au modèle : ne rien inventer (outils, chiffres, missions) ; missions seulement REFORMULÉES ; ce que
  l'annonce demande et que le profil ne montre pas va dans « compétences à valoriser si vous les avez » ; repères
  [ … ] quand une information manque ; tournures neutres (genre inconnu). Vérifié sur de vraies réponses.
- Réponse JSON lue de façon tolérante (texte ou ``` autour) ; erreurs en français (hors ligne, 429, panne).

**Incident découvert au passage (côté NEXUS).** L'assistant IA de NEXUS était EN PANNE : Groq a retiré le modèle
`groq/compound-mini`, et le proxy renvoyait 502 (Cloudflare masquait la cause). Corrigé dans nexus-market : statut
500 lisible, bascule automatique sur un modèle disponible (liste `/models` du compte Groq), réflexion courte pour
gpt-oss et plafond 2 500 tokens (les réponses étaient tronquées).

**État.** 144 tests unitaires sur 145 verts (dont `tests/ai.test.js`) et 44 tests Playwright verts (`tests/ui/ai.spec.mjs` :
accord, refus sans envoi, identité jamais envoyée, application des propositions, erreur 429). Sous Windows, le test
d'en-têtes de `pwa.test.js` échoue à cause des fins de ligne CRLF (pas un défaut du site) ; les tests
d'accessibilité demandent `--timeout=120000` sur une machine lente.

## 2026-09-29 — mise en ligne (GitHub Pages)
**Fait.** Workflow GitHub Actions qui teste puis publie `public/` sur GitHub Pages à chaque mise à jour de `main` ;
CSP dupliquée en `<meta>` (GitHub Pages ignore `_headers`), avec un test qui garantit qu'elle reste identique ;
guide `DEPLOIEMENT.md` (GitHub Pages en place, Cloudflare Pages en option).

**Pourquoi.** Demande « mettre le site en ligne d'abord » (avant le tableau de bord admin). Aucun accès Cloudflare
depuis l'environnement de développement (pas de jeton, API bloquée) : GitHub Pages est publiable directement depuis
le dépôt public.

**Vérifié.** Site servi sous `/cv/` par un serveur sans en-têtes personnalisés : aucune erreur, CSP active (style en
ligne bloqué), service worker limité à `/cv/`, rechargement hors ligne. 138 tests unitaires et 40 tests Playwright verts.

## 2026-09-29 — cycle 5 : aperçu page par page, suivi des candidatures, import LinkedIn
**Fait.** **Aperçu page par page** fidèle à l'impression (feuilles séparées, blocs jamais coupés, titres jamais
orphelins), avec un nombre de pages vérifié identique au PDF pour les 33 modèles ; **suivi des candidatures** avec
relances à J+10, lettres de relance et de remerciement pré-remplies et export pour Excel ; **import LinkedIn** depuis
l'archive officielle (.zip compressé) ou les fichiers .csv.

**Pourquoi.** Demande « continue les améliorations ». L'ancien aperçu (une longue page avec des repères) pouvait
annoncer 1 page quand l'impression en produisait 2 ; le suivi et l'import LinkedIn font gagner du temps à chaque
candidature.

**Choix notables.**
- Pagination par intercalaires invisibles insérés avant le bloc qui déborde (avec correction après mesure pour les
  marges fusionnées et les grilles) ; l'impression repart d'un rendu neuf, donc n'est jamais affectée.
- « Ajuster à 1 page » et les règles de longueur utilisent la même pagination que l'aperçu : plus de désaccord
  possible entre l'alerte, l'aperçu et le PDF.
- ZIP compressé lu avec `DecompressionStream('deflate-raw')` (natif navigateur et Node 22) : pas de bibliothèque.
- Niveaux de langue LinkedIn → CECRL : correspondance approximative, annoncée à l'utilisateur plutôt que présentée
  comme exacte.
- Export CSV : cellules commençant par `= + - @` préfixées d'une apostrophe (injection de formules dans Excel).

**État.** 136 tests unitaires et 40 tests Playwright verts. Propositions du cycle 6 dans `ROADMAP.md`.

## 2026-09-29 — cycle 4 : Word, rubriques personnalisées, lettres de stage / relance / remerciement, accessibilité
**Fait.** **Export Word (.docx)** du CV et de la lettre, sans dépendance (WordprocessingML + ZIP écrits à la main) ;
**rubriques personnalisées** (Stages, Vie associative…) avec contrôles de titre standard, rendues partout (33
modèles, texte brut, Word, JSON Resume) ; **demande de stage, relance et remerciement** en plus de la candidature ;
**import / export JSON Resume** ; **audit d'accessibilité axe-core** (0 violation WCAG A/AA) et deux défauts corrigés.

**Pourquoi.** Demande « autres améliorations ». Le .docx est souvent exigé par les cabinets et plateformes d'emploi ;
les rubriques libres et la demande de stage répondent aux CV de jeunes diplômés, très nombreux au Sénégal ; l'audit
automatique garantit l'exigence WCAG 2.2 AA du cahier des charges au fil des cycles.

**Choix notables.**
- ZIP « stocké » (sans compression) : format valide et simple à vérifier (CRC-32 testé contre la valeur de référence
  0xCBF43926) ; un algorithme deflate maison aurait été un risque pour un gain de quelques dizaines de Ko.
- Le .docx reste un document ATS (une colonne, styles de titres Word) quel que soit le modèle : un tableau ou des
  zones de texte pour imiter les modèles créatifs seraient mal lus par les logiciels de tri.
- Texte brut et Word partagent la même liste de blocs (`cvBlocks`), qui reproduit l'ordre imposé par Europass et le
  résumé US : le contenu est identique dans les trois formats.
- Rubriques personnalisées stockées à part (`cv.custom`) et référencées dans `meta.sectionOrder` par
  `custom:<id>` : les rubriques standard et leurs règles restent inchangées.
- axe-core injecté avec `bypassCSP` uniquement dans `a11y.spec.mjs` ; tous les autres tests gardent la vraie CSP.

**État.** 128 tests unitaires et 34 tests Playwright verts. Propositions du cycle 5 dans `ROADMAP.md`.

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
