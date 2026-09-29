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

## Cycle 2 — variété, hors ligne, offre d'emploi, normes par pays ✅ (terminé le 2026-09-29)

### Fait
- **33 modèles** (contre 16), chacun avec **3 à 5 palettes** de couleurs (17 palettes, contrastes ≥ 4,5:1 testés),
  appliquées par le CSSOM (aucun `style=""`). Nouvelles familles :
  - colonne de dates à gauche : **Chronologique** (ATS), **Registre** (empattements) ;
  - **Académique** et **Chercheur** (CV long, formation en tête, publications numérotées, plusieurs pages admises) ;
  - **Fonctionnel** (compétences clés + parcours condensé) et **Reconversion** (hybride) ;
  - **Étudiant** et **Premier emploi** (formation et projets d'abord) ;
  - **Métiers** et **Technicien** (savoir-faire, habilitations et permis en tête, gros caractères) ;
  - **Québec** (FR) et **Canada (anglais)** : Letter, sans photo ni données personnelles ;
  - **Lebenslauf** et **Lebenslauf moderne** (dates à gauche, photo facultative à droite, informations
    personnelles regroupées, « Fait à …, le … » + nom) ;
  - **Teranga** (ATS), **Casamance** (colonne droite), **Infographie** (jauges de langue décoratives, niveau CECRL écrit).
- **Nouvelles rubriques** : Distinctions et Publications (éditeur, rendu, Europass, résumé US, correspondance).
- **Polices libres OFL** embarquées (`public/fonts/`, 6 familles, ~480 Ko, licences jointes) : rendu identique
  partout, aucune ressource externe. Aucune taille < 9 pt (test sur tout le CSS du CV ; 8,6 pt corrigé).
- **Mode hors ligne (PWA)** : manifeste, icônes 192/512, service worker (précache de tout le site, réseau
  d'abord pour les pages), bouton « Installer l'application », en-têtes `_headers`.
- **Correspondance avec une offre** (`match.js`, 100 % local) : extraction des mots-clés (expressions,
  sigles, outils, « gestion de projet »), taux de correspondance pondéré, mots-clés présents / absents,
  bouton « Ajouter aux compétences », offre conservée avec le CV.
- **Nouvelles règles** : trous > 6 mois (formations et bénévolat comblent), chevauchements, verbes répétés,
  temps verbaux mélangés, mots creux FR/EN, ponctuation et majuscules homogènes, doubles espaces
  (+ correction), téléphone international / incomplet / indicatif du pays, âge déductible (année du bac).
  **Profils par pays** (France, Sénégal, Canada, Royaume-Uni, États-Unis, Allemagne) : papier (+ correction),
  photo, informations personnelles, langue, longueur, rubriques US, modèles conseillés.
- **Ajuster à 1 page** (et « ajuster à 2 pages » depuis l'alerte de longueur) : 4 niveaux de resserrement
  mesurés hors écran, police jamais sous 9 pt, marges inchangées, bouton « Taille normale ».
- **Tests** : 97 tests unitaires (+35) et 19 tests Playwright (+7 : galerie de 33 modèles sans erreur CSP,
  palette, pays, ajustement, correspondance, publication, hors ligne). Playwright utilise le Chromium
  préinstallé si la version attendue est absente.

### Reste / limites connues
- La correspondance avec l'offre est lexicale (pas de synonymes : « comptabilité » ≠ « finance ») ; les noms
  d'entreprise de l'annonce peuvent ressortir comme mots-clés.
- Les palettes sont par modèle (changer de modèle revient à sa palette d'origine si la palette n'existe pas).
- Aperçu toujours en une longue page avec repères (pas de pagination visuelle page par page).
- Pas d'annuler / rétablir, ni de glisser-déposer, ni de masquage d'un élément sans le supprimer.
- Sous-ensemble de polices « latin » : certains caractères rares (ŋ du wolof officiel, ɓ du peul) passent par
  la police système de repli.
- Pas encore de lettre de motivation, ni d'import/export JSON Resume.

## Proposé pour le cycle 2 (archive : points 1 à 4 et « ajuster à 1 page » faits ; pagination visuelle et points 6 à 9 reportés au cycle 3)
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

## Proposé pour le cycle 3 (priorisé)
1. **Lettre de motivation** assortie au modèle (même en-tête et typographie), avec structure guidée
   (vous / moi / nous), contrôles (longueur 1 page, formule de politesse, destinataire) et réutilisation
   des mots-clés de l'offre : très demandée au Sénégal et en France, complète naturellement le CV.
2. **Confort d'édition** : annuler / rétablir (historique local), masquer un élément ou une rubrique sans la
   supprimer (versions ciblées d'un même CV), glisser-déposer accessible au clavier, rubriques personnalisées.
3. **Aide à la rédaction par métier** (hors ligne) : exemples de lignes et verbes d'action pour ~30 métiers
   courants (comptable, infirmier, enseignant, chauffeur, commercial, technicien, agent de sécurité…),
   suggestion de reformulation d'une ligne faible, synonymes pour la correspondance avec l'offre.
4. **Pagination visuelle réelle** dans l'aperçu (pages A4/Letter séparées, en-tête de page 2 avec le nom) et
   aperçu d'impression fidèle ; vérification automatique que le PDF extrait le texte dans l'ordre de lecture.
5. **Interopérabilité** : import / export JSON Resume, copie en texte brut pour les formulaires en ligne,
   import d'un profil LinkedIn exporté (fichier), export `.txt` compatible ATS.
6. **Qualité** : audit d'accessibilité automatisé (axe-core en devDependency), captures de non-régression
   visuelle des 33 modèles, contrôle des contrastes des modèles dans le navigateur (pas seulement des palettes).
7. **Polices étendues** : sous-ensemble latin-ext (wolof, peul, pulaar : ŋ, ɓ, ɗ, ƴ) pour les noms et adresses.
8. **Profils pays supplémentaires** : Côte d'Ivoire, Maroc, Belgique, Suisse, fonction publique sénégalaise
   (pièces du dossier de concours), et modèle « CV + dossier de concours ».
