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

## Cycle 3 — réalités sénégalaises, lettre de motivation, confort d'édition ✅ (terminé le 2026-09-29)

### Priorités retenues (avant de coder)
Ce qui apporte le plus à un candidat au Sénégal : (1) la **lettre de motivation / demande d'emploi**, exigée
presque partout, y compris au format administratif ; (2) des **contrôles adaptés aux réalités locales**
(numéros +221 et WhatsApp, langues nationales souvent parlées sans être écrites, sigles de diplômes inconnus
à l'étranger, montants en FCFA, concours de la fonction publique) ; (3) l'**aide à la rédaction par métier**
pour les profils peu habitués à rédiger un CV ; (4) le confort (annuler, masquer, texte brut pour les
formulaires et WhatsApp) ; (5) des polices qui affichent ŋ, ɓ, ɗ, ƴ.

### Fait
- **Lettre de motivation assortie au modèle** (`letter.js`) : même en-tête, polices et couleurs que le CV (33 modèles),
  3 styles — *standard* (France), *administratif (Sénégal)* (« À Monsieur le Directeur… », objet, « haute
  considération », P. J.) et *anglais* (cover letter). **Brouillon guidé** vous / moi / nous construit à partir du
  poste visé, de la dernière expérience (élision « d'augmenter »), des compétences et des mots-clés de l'offre ;
  passages [ … ] à personnaliser. Formule d'appel déduite du destinataire (« Monsieur le Directeur des RH » →
  « Monsieur le Directeur, ») et reprise dans la formule de politesse. **Contrôle** : vide, 250–400 mots, 1 page
  mesurée, paragraphes, objet, destinataire, cohérence appel / politesse, clichés, trop de « Je », mots-clés de
  l'offre, signature. PDF de la lettre par impression (texte réel).
- **Référentiel sénégalais** (`senegal.js`, hors ligne) : 21 diplômes avec équivalences FR / EN (CFEE, BFEM, BT, DTS,
  DUEL, maîtrise, CAEM, CAES, CEAP…), 28 établissements (UCAD, UGB, UASZ, ESP, EPT, ENSAE, ISM, CESAG, UN-CHK…),
  28 villes, 22 langues → **suggestions de saisie** (`<datalist>`) ; pièces du **dossier de concours**.
- **Nouvelles règles** : numéro sénégalais (9 chiffres, préfixes 70/75/76/77/78/33) et **correction en un clic**
  vers `+221 77 123 45 67` (aussi pour le 2e numéro) ; **montants en FCFA** convertis pour une candidature hors
  zone CFA (parité fixe 655,957) ; **sigles de diplômes** expliqués pour l'étranger (+ bouton « Ajouter
  l'équivalence ») ; **religion / confrérie / ethnie / caste** (sans faux positif sur « Université catholique… ») ;
  **numéro de CNI / passeport / IPRES** ; taille et poids ; exemples [ … ] non personnalisés ; suivi du dossier.
- **Profils pays** : Sénégal fonction publique / concours (liste de pièces à cocher dans l'éditeur), Côte d'Ivoire,
  Maroc, Belgique, Suisse (11 profils) ; messages accordés (« au Maroc », « aux États-Unis »).
- **Identité** : second téléphone, mention « (WhatsApp) » écrite en toutes lettres, lieu de naissance (masqué par
  défaut, jamais sur un modèle anglo-saxon, retiré en mode anonyme). **Langues « à l'oral »** (« Wolof — Langue
  maternelle, à l'oral ») avec suggestion automatique pour les langues nationales ; Europass et jauges compris.
- **Aide à la rédaction par métier** (`phrases.js`) : 23 métiers courants au Sénégal (comptable SYSCOHADA,
  téléconseiller, agent mobile money, chauffeur, enseignant, infirmier, sécurité, électricien, BTP, ONG, agriculture,
  hôtellerie, banque, couture, jeune diplômé…) : lignes à insérer dans l'expérience choisie, compétences types,
  accroche type.
- **Confort** : **annuler / rétablir** (boutons, Ctrl+Z / Ctrl+Y hors des champs texte, 60 étapes, frappe
  regroupée) ; **masquer un élément sans le supprimer** (versions ciblées : absent du CV, du texte brut et des
  contrôles, chemins d'alertes recalculés) ; **texte brut** du CV ou de la lettre (copier, télécharger `.txt`,
  partager via WhatsApp / e-mail sur téléphone).
- **Polices latin étendu** (ŋ, ɓ, ɗ, ƴ) pour Inter, Montserrat, Merriweather, EB Garamond, Source Serif 4 ;
  **non pré-téléchargées** par le service worker (≈ 560 Ko) pour ménager les forfaits : chargées si besoin.
- **Exemple « jeune diplômé »** (BTS, stages, langues nationales à l'oral, WhatsApp) ; accueil mis à jour.
- **Correction** : l'attribut `hidden` était écrasé par `.btn { display: inline-flex }` (« Taille normale » et
  « Installer l'application » restaient visibles).
- **Tests** : 118 tests unitaires (+21) et 26 tests Playwright (+7 : lettre + PDF 1 page, annuler / rétablir,
  masquer, aide par métier, texte brut, Sénégal, téléphone mobile).

### Reste / limites connues
- Brouillon de lettre : français « générique » (pas d'accord selon le genre, pas d'article devant le nom de
  l'employeur en style standard) ; les puces au participe passé sont citées telles quelles.
- La conversion en dollars utilise un taux indicatif (1 € ≈ 1,10 $) ; l'euro est exact (parité fixe).
- Aperçu toujours en une longue page avec repères (pas de pagination visuelle page par page).
- Pas de glisser-déposer ; pas de rubriques personnalisées libres ; pas d'import JSON Resume / LinkedIn.
- La liste des pièces du dossier de concours est indicative (l'avis de concours fait foi).

## Cycle 4 — formats d'échange, rubriques personnalisées, lettres, accessibilité ✅ (terminé le 2026-09-29)

### Priorités retenues (avant de coder)
Demande : « autres améliorations ». Retenu ce qui manque le plus à l'usage réel : (1) **le fichier Word**, exigé par
beaucoup de cabinets de recrutement et de plateformes au Sénégal ; (2) les **rubriques personnalisées** (stages
séparés, vie associative, mémoire…), très courantes dans les CV de jeunes diplômés ; (3) les **autres lettres** du
parcours de candidature (demande de stage, relance, remerciement) ; (4) l'**interopérabilité** (JSON Resume) ;
(5) un **audit d'accessibilité automatisé** pour tenir l'exigence WCAG 2.2 AA dans la durée.

### Fait
- **Export Word (.docx)** du CV et de la lettre (`docx.js`, `zip.js`), sans dépendance : WordprocessingML écrit à la
  main + archive ZIP (CRC-32). Document ATS : une colonne, styles Word « Titre 1 » pour les rubriques, dates alignées
  par tabulation, puces en texte, ni tableau ni image, A4 ou Letter selon le modèle, couleur d'accent de la palette,
  Calibri ou Cambria (modèles à empattements), langue du document, propriétés (titre, auteur — vides en mode anonyme).
  Vérifié avec python-docx.
- **Rubriques personnalisées** (jusqu'à 6) : titre avec suggestions standard (Stages, Vie associative, Formations
  complémentaires, Mémoire et travaux de recherche…), éléments intitulé / organisme / dates / détails, masquables,
  déplaçables comme les rubriques standard ; rendues dans les 33 modèles (après l'ordre imposé pour Europass et le
  résumé US), dans le texte brut, Word et JSON Resume. **Contrôles** : titre manquant, doublon d'une rubrique
  standard, titre fantaisiste (symboles, > 40 caractères), élément sans intitulé, dates ; les stages déclarés
  comblent les trous du parcours.
- **Types de lettre** : candidature, **demande de stage** (durée, date, convention ; pièces jointes adaptées en style
  administratif), **relance**, **remerciement après entretien** — en français standard, administratif et anglais ;
  longueur attendue adaptée (80 à 180 mots pour relance et remerciement).
- **JSON Resume** (`jsonresume.js`) : export conforme au schéma v1.0.0 ; l'import habituel reconnaît
  automatiquement ce format (niveaux de langue déduits de « fluency », langue du CV déduite du contenu, années seules
  conservées et signalées plutôt qu'un mois inventé).
- **Blocs documentaires** (`plaintext.js`) : une seule structure alimente le texte brut et Word (même ordre que le PDF).
- **Accessibilité** : audit **axe-core** (WCAG 2.0 / 2.1 / 2.2 A et AA) sur l'accueil, l'éditeur (toutes rubriques
  ouvertes), la lettre, la galerie, le dialogue texte brut et l'affichage téléphone. Deux défauts corrigés : liens
  focalisables dans l'aperçu décoratif de l'accueil et dans les miniatures de la galerie (contrôles imbriqués) →
  `inert`. Cases à cocher des formulaires alignées sur une ligne.
- **Tests** : 128 tests unitaires (+10) et 34 tests Playwright (+8, dont 4 d'accessibilité).

### Reste / limites connues
- Le .docx n'est pas compressé (8 à 15 Ko pour un CV : sans incidence pratique) ; pas de photo dans le .docx
  (volontaire : ATS), pas de mise en page à colonnes des modèles créatifs.
- LibreOffice n'a pas pu être utilisé dans l'environnement de test pour un rendu visuel du .docx.
- Aperçu toujours en une longue page avec repères (pas de pagination visuelle page par page).
- Pas de glisser-déposer ; pas d'import de l'export LinkedIn (archive CSV).

## Proposé pour le cycle 5 (priorisé)
1. **Pagination visuelle réelle** (pages séparées dans l'aperçu, nom rappelé en page 2) et vérification automatique
   de l'ordre d'extraction du texte du PDF.
2. **Import LinkedIn** (archive « Obtenir une copie de vos données » : Positions.csv, Education.csv, Skills.csv).
3. **Interface en anglais** (et aides principales en wolof) ; libellés de rubriques anglais pour les organisations
   internationales basées à Dakar.
4. **Glisser-déposer accessible** des éléments et rubriques (en plus des boutons Monter / Descendre).
5. **Suivi des candidatures** local (entreprise, date d'envoi, relance prévue, statut) relié aux lettres de relance.
6. **Captures de non-régression visuelle** des 33 modèles et de la lettre.
