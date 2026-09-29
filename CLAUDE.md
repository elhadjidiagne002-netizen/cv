# CV en ligne — cahier des charges et règles pour Claude / contributeurs

Application web de création de CV : l'utilisateur remplit son parcours une fois, choisit parmi
**des dizaines de modèles** et exporte un PDF **conforme aux normes du recrutement**. Public
principal : Sénégal / Afrique francophone et France, avec l'anglais (résumé US/UK) et Europass.

Toujours répondre et écrire l'interface **en français** (l'anglais est une langue de CV proposée).

## Architecture (décidée — ne pas changer sans raison forte)
- **Site statique, sans serveur ni compte** : HTML + CSS + JavaScript (modules ES natifs), aucun framework,
  aucune étape de build obligatoire. Déployable tel quel sur Cloudflare Pages (`public/`).
- **Les données restent dans le navigateur** (`localStorage`), jamais envoyées à un serveur (RGPD) ;
  export / import d'un fichier `.json` pour les sauvegarder ou changer d'appareil.
- **Export PDF = impression du navigateur** (`window.print()` + CSS `@page`) : le texte reste du vrai
  texte sélectionnable, lisible par les logiciels de recrutement (ATS). Jamais de PDF « image »
  (pas de html2canvas pour l'export final).
- Aucune ressource externe chargée à l'exécution (pas de CDN, pas de Google Fonts distants) : polices
  système ou polices libres copiées dans `public/fonts/`. Politique CSP stricte dans `public/_headers`.
- Arborescence :
  - `public/index.html` : accueil ; `public/app.html` : éditeur + aperçu en direct.
  - `public/js/` : `model.js` (schéma des données + validation), `templates/` (un fichier par famille
    de modèles), `render.js` (données → HTML du CV), `norms.js` (règles de conformité + contrôleur),
    `i18n.js` (libellés de rubriques FR/EN), `storage.js`, `app.js` (éditeur), `letter.js` (lettre de motivation
    assortie), `senegal.js` (référentiel local : diplômes, établissements, +221, FCFA, concours), `phrases.js`
    (aide à la rédaction par métier), `plaintext.js` (blocs du CV → texte brut), `docx.js` + `zip.js` (export Word
    sans dépendance), `jsonresume.js` (import / export JSON Resume), `match.js` (offre d'emploi).
  - `public/css/` : `app.css` (éditeur + accueil), `cv-base.css` (commun à tous les CV, impression A4/Letter),
    `templates.css` (couleurs, polices et variantes de chaque modèle, classe `.tpl-<id>`).
  - Modèles : une famille par fichier dans `public/js/templates/` (`single.js`, `europass.js`,
    `international.js`, `sidebar.js`, `banner.js`), briques communes dans `parts.js`, registre `index.js`.
    Tout contenu utilisateur passe par `esc()` ; **jamais d'attribut `style=""`** dans le HTML rendu (bloqué
    par la CSP) — les réglages dynamiques passent par `element.style.setProperty()` (CSSOM, autorisé).
  - Serveur de test local : `npm run serve` (sert `public/` avec les en-têtes de `_headers`, donc la vraie CSP).
  - `tests/` : `node --test` (unitaires) et `tests/ui/*.spec.mjs` (Playwright).

## Normes à respecter rigoureusement (le cœur du produit)
### Lisibilité par les ATS (logiciels de tri des candidatures)
- Texte réel, ordre de lecture logique (le HTML suit l'ordre visuel), aucun texte dans une image.
- Titres de rubriques standard et reconnaissables (« Expérience professionnelle », « Formation »,
  « Compétences », « Langues »…), jamais de libellé fantaisiste.
- Coordonnées dans le corps du document, pas dans un en-tête/pied de page d'impression.
- Dates au format homogène (`MM/AAAA` ou `mois AAAA`), « Aujourd'hui / Present » pour un poste en cours.
- Les modèles marqués **ATS** : une seule colonne, pas d'icône porteuse d'information, pas de tableau
  de mise en page, polices standard. Les modèles « créatifs » à 2 colonnes sont signalés comme
  « moins adaptés aux ATS » dans la galerie.
### Normes françaises / francophones
- 1 page (débutant, < 10 ans d'expérience) à 2 pages maximum : alerte si ça dépasse.
- Ordre antéchronologique (le plus récent d'abord) pour expériences et formations.
- Photo **facultative** ; âge, date de naissance, situation familiale, nationalité **jamais exigés**
  (non-discrimination) : champs optionnels, masqués par défaut, avec une explication.
- Mode **CV anonyme** (masque nom, photo, adresse, âge) en un clic.
- Langues selon le **CECRL** (A1 à C2, langue maternelle) — pas de barres ni d'étoiles seules.
- Titre de poste visé + accroche courte en tête.
### Autres formats
- **Europass** (structure officielle de l'UE) et **résumé US/UK** : format Letter, pas de photo ni de
  date de naissance, sections en anglais, verbes d'action.
### Qualité
- Contrôleur de conformité visible en permanence : score + liste d'alertes précises et corrigeables
  (fautes de dates, rubrique vide, trop long, e-mail peu professionnel, photo sur un CV US, etc.).
- Accessibilité de l'éditeur : WCAG 2.2 AA (contrastes, clavier, libellés), responsive téléphone.
- Impression : `@page` A4 (défaut) ou Letter, marges ≥ 12 mm, pas de coupure au milieu d'un bloc
  (`break-inside: avoid`), polices ≥ 9 pt.

## Méthode de travail (sessions cloud)
- Le développement se fait par **cycles**. À la fin de chaque cycle : tests verts, `ROADMAP.md` mis à
  jour (fait / à faire), entrée ajoutée en haut de `JOURNAL.md`, commit + push sur `main`.
- Chaque cycle commence par se demander **quelles améliorations apportent le plus** (utilisateur,
  normes, qualité) et les note dans `ROADMAP.md` avant de coder.
- Vérifier : `npm test` (unitaires) ; `npx playwright test` si Playwright est disponible (inclut l'audit
  d'accessibilité axe-core `tests/ui/a11y.spec.mjs`, qui doit rester à zéro violation WCAG A/AA).
- Ne jamais committer de secret. Pas de dépendance d'exécution : seules des dépendances de
  développement (Playwright, axe-core) sont autorisées.
