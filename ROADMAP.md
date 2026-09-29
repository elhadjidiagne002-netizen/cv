# Feuille de route

## Cycle 1 — fondations ✅ (terminé le 2026-09-29)

### Fait
- **Modèle de données** (`public/js/model.js`) : identité, titre visé, accroche, expériences, formations,
  compétences (groupes de mots-clés), langues CECRL A1–C2 + maternelle (+ certificat), certifications,
  projets, bénévolat, centres d'intérêt, références (+ « disponibles sur demande »). Champs sensibles
  (photo, date de naissance, situation familiale, nationalité, permis) **masqués par défaut** avec
  explication. Normalisation (imports partiels, anciens formats de date), validation structurelle,
  tri antéchronologique, données d'exemple réalistes (profil sénégalais, FR + EN).
- **Stockage** (`storage.js`) : sauvegarde automatique différée dans `localStorage`, plusieurs CV
  (liste, dupliquer, supprimer), export / import `.json` (l'import crée toujours un nouveau CV),
  stockage corrompu ou plein géré avec message en français.
- **Éditeur** (`app.html`, `app.js`, `app.css`) : rubriques repliables, ajout / suppression /
  réordonnancement des éléments **et des rubriques**, aperçu en direct mis à l'échelle avec repères de
  fin de page, disposition côte à côte (bureau) ou empilée (téléphone), photo recadrée et compressée
  localement, couleur d'accent, langue FR/EN des rubriques, format A4/Letter, format des dates.
  Accessibilité : libellés sur tous les champs, liens d'évitement, focus visible, gestion du focus après
  ajout/suppression, `aria-pressed`, `aria-live`, contrastes AA.
- **Moteur de rendu + 16 modèles** (`render.js`, `templates/`, `cv-base.css`, `templates.css`) en 5 familles :
  - ATS une colonne : Sobre, Classique, Moderne ATS, Compact, Exécutif (+ Élégant, une colonne centrée) ;
  - Europass (intitulés et ordre officiels, langues maternelles / autres) ;
  - International : Résumé US (Letter, anglais, sans photo ni données personnelles), CV britannique ;
  - Créatifs à colonne latérale : Dakar, Océan (colonne à droite), Ardoise, Savane ;
  - Bandeau : Frise (frise chronologique), Horizon (2 colonnes), Minimal.
  Chaque modèle déclare `name`, `category`, `ats`, `columns`, `photo`, `format` (+ `lang`, `labels`,
  `excludeSections`…). Galerie avec filtres et **miniatures en direct** des données de l'utilisateur.
- **Contrôleur de conformité** (`norms.js`) : score /100 + alertes classées (erreur / à corriger /
  conseil), cliquables (amènent au champ) et corrections automatiques (tri antéchronologique, masquer les
  informations sensibles, retirer la photo). Règles : identité et contact, e-mail peu professionnel,
  titre visé, accroche (longueur, « je »), rubriques vides, champs obligatoires, dates (format, fin avant
  début, futur, « en cours » + fin, fin manquante, formats hétérogènes), ordre antéchronologique, verbes
  d'action, résultats chiffrés, formulations faibles, langues sans niveau CECRL, champs discriminants
  affichés, photo sur modèle US/UK/ATS, contenu français sur modèle anglais, longueur (mesurée dans
  l'aperçu : > 2 pages, 2 pages sous 10 ans d'expérience), modèle non ATS, centres d'intérêt vagues.
  **Mode CV anonyme en un clic** (nom, photo, coordonnées, adresse, âge, nationalité, situation
  familiale, références).
- **i18n** (`i18n.js`) : rubriques et niveaux FR / EN, dates `MM/AAAA` ou `mois AAAA`, « Aujourd'hui / Present ».
- **Export PDF** par impression navigateur : `@page` A4 (défaut) ou Letter (page nommée), marges 12 mm,
  `break-inside: avoid`, texte réel, seul le CV est imprimé.
- **Accueil** `index.html` (aperçu réel d'un CV), `_headers` avec CSP stricte (aucune ressource
  externe, pas de style/script inline), favicon.
- **Tests** : 62 tests unitaires `node --test` (modèle, validation, stockage, i18n, contrôleur, rendu
  de chaque modèle, échappement, absence de `style=""`, ordre de lecture ATS, titres standard) et
  12 tests Playwright (sous la vraie CSP : saisie, sauvegarde, rubriques, alertes cliquables, galerie,
  anonyme, anglais, export/import, impression PDF 1 page, libellés, téléphone, accueil).

### Reste / limites connues
- Pas encore de polices libres embarquées : rendu légèrement différent selon le système (polices système).
- Aperçu d'une seule longue page avec repères (pas de vraie pagination visuelle page par page).
- Pas d'annuler / rétablir ; pas de glisser-déposer (boutons Monter / Descendre, utilisables au clavier).
- Pas de rubriques personnalisées (Publications, Distinctions…) ni de masquage d'un élément sans le supprimer.
- Pas de mode hors ligne (service worker) ni de lettre de motivation.

## Proposé pour le cycle 2 (priorisé)
1. **Plus de modèles et de variété (objectif ≥ 30)** : palettes de couleurs par modèle (3 à 5 chacune),
   nouvelles familles — colonne de dates à gauche (chronologique classique), académique / CV long
   (chercheur, publications), fonctionnel par compétences (reconversion), étudiant / premier emploi,
   métiers techniques et manuels, Canada / Québec (sans photo), Allemagne (Lebenslauf avec photo),
   infographique modéré. Polices libres (OFL) copiées dans `public/fonts/` pour un rendu identique partout.
2. **Mode hors ligne (PWA)** : manifeste + service worker, application installable et utilisable sans
   connexion (enjeu fort au Sénégal) ; sauvegarde locale inchangée.
3. **Correspondance avec une offre d'emploi** : coller l'annonce, extraire les mots-clés (en local, sans
   serveur), afficher le taux de correspondance et les compétences manquantes — c'est ce que font les ATS.
4. **Règles de conformité supplémentaires** : trous de plus de 6 mois et chevauchements, verbes répétés,
   mots creux (« dynamique », « motivé »), temps verbaux homogènes, ponctuation / majuscules homogènes,
   doubles espaces, téléphone au format international, âge déductible (année du bac), profils de règles
   par pays (France, Sénégal fonction publique, Canada, Royaume-Uni, États-Unis, Allemagne).
5. **Tenir sur une page** : pagination visuelle réelle et bouton « ajuster à 1 page » (réduction
   progressive des espacements puis de la police, sans descendre sous 9 pt).
6. **Confort d'édition** : annuler / rétablir, glisser-déposer accessible, masquer un élément ou une
   rubrique sans la supprimer, rubriques personnalisées (Publications, Distinctions, Associations),
   suggestions de verbes d'action et d'exemples par métier (comptable, infirmier, enseignant, chauffeur…).
7. **Interopérabilité** : import / export au format JSON Resume (jsonresume.org), copie en « texte brut »
   pour les formulaires de candidature en ligne.
8. **Lettre de motivation** assortie au modèle du CV (même en-tête, même typographie).
9. **Qualité** : audit d'accessibilité automatisé (axe-core en devDependency Playwright), captures de
   non-régression visuelle par modèle, vérification que le texte du PDF s'extrait dans l'ordre de lecture.
