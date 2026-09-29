// Aide à la rédaction par métier (hors ligne) : exemples de lignes de réalisations, verbes d'action,
// compétences et accroche type. Métiers courants au Sénégal et en Afrique francophone.
// Les passages entre crochets [ … ] sont à remplacer par vos chiffres réels (le contrôleur les signale).

export const JOBS = [
  {
    id: 'comptable', name: 'Comptable / aide-comptable', sector: 'Finance',
    lines: [
      'Tenir la comptabilité générale de [n] sociétés selon le référentiel SYSCOHADA révisé',
      'Préparer les déclarations fiscales et sociales (TVA, IPRES, CSS) dans les délais légaux',
      'Réaliser les rapprochements bancaires mensuels de [n] comptes',
      'Élaborer les états financiers annuels et la liasse fiscale DSF',
      'Réduire de [n] jours le délai de clôture mensuelle',
    ],
    skills: { name: 'Comptabilité', keywords: ['SYSCOHADA', 'Fiscalité sénégalaise', 'Sage Saari', 'Excel (tableaux croisés)', 'États financiers'] },
    summary: 'Comptable, [n] ans d\'expérience en cabinet et en entreprise, maîtrise du SYSCOHADA révisé et des déclarations fiscales et sociales.',
  },
  {
    id: 'assistant', name: 'Assistant(e) administratif(ve) / secrétaire', sector: 'Administration',
    lines: [
      'Gérer l\'agenda et les déplacements de [n] responsables',
      'Rédiger et mettre en forme courriers, comptes rendus et notes de service',
      'Accueillir les visiteurs et traiter [n] appels par jour',
      'Classer et archiver les dossiers administratifs (papier et numérique)',
      'Organiser [n] réunions et séminaires par an (logistique, invitations, salles)',
    ],
    skills: { name: 'Administration', keywords: ['Word', 'Excel', 'Gestion d\'agenda', 'Rédaction administrative', 'Archivage'] },
    summary: 'Assistante administrative, [n] ans d\'expérience, organisation, rédaction administrative et accueil.',
  },
  {
    id: 'commercial', name: 'Commercial(e) / chargé(e) de clientèle', sector: 'Commerce',
    lines: [
      'Prospecter et fidéliser un portefeuille de [n] clients sur [zone]',
      'Atteindre [n] % de l\'objectif de chiffre d\'affaires annuel',
      'Négocier les conditions commerciales avec les distributeurs et grossistes',
      'Ouvrir [n] nouveaux points de vente en [n] mois',
      'Assurer le suivi des encaissements et réduire les impayés de [n] %',
    ],
    skills: { name: 'Vente', keywords: ['Prospection', 'Négociation', 'Gestion de portefeuille', 'CRM', 'Merchandising'] },
    summary: 'Commercial terrain, [n] ans d\'expérience en distribution, portefeuille de [n] clients, objectifs dépassés.',
  },
  {
    id: 'teleconseiller', name: 'Téléconseiller(ère) / centre d\'appels', sector: 'Services',
    lines: [
      'Traiter [n] appels entrants par jour pour un opérateur de télécommunications',
      'Résoudre [n] % des demandes dès le premier contact',
      'Conseiller les clients sur les offres mobile money et les forfaits',
      'Obtenir un taux de satisfaction client de [n] %',
      'Former [n] nouveaux conseillers aux outils et procédures',
    ],
    skills: { name: 'Relation client', keywords: ['Accueil téléphonique', 'Gestion des réclamations', 'Vente additionnelle', 'CRM', 'Français et wolof à l\'oral'] },
    summary: 'Téléconseillère, [n] ans en centre d\'appels (télécoms), relation client multilingue et gestion des réclamations.',
  },
  {
    id: 'mobile-money', name: 'Agent(e) de transfert d\'argent / mobile money', sector: 'Finance',
    lines: [
      'Réaliser [n] opérations de dépôt, retrait et transfert par jour',
      'Tenir la caisse et le registre des opérations sans écart',
      'Conseiller les clients sur les services Orange Money, Wave et Free Money',
      'Contrôler les pièces d\'identité selon les règles anti-blanchiment',
      'Gérer le fonds de roulement électronique et physique du point',
    ],
    skills: { name: 'Services financiers', keywords: ['Gestion de caisse', 'Mobile money', 'Lutte anti-blanchiment', 'Accueil client'] },
    summary: 'Agent de transfert d\'argent, [n] ans d\'expérience, gestion de caisse rigoureuse et conseil client.',
  },
  {
    id: 'caissier', name: 'Caissier(ère) / vendeur(se)', sector: 'Commerce',
    lines: [
      'Encaisser [n] clients par jour en espèces, carte et mobile money',
      'Clôturer la caisse quotidiennement sans écart',
      'Mettre en rayon et contrôler les dates de péremption',
      'Accueillir et renseigner les clients en français et en wolof',
      'Participer aux inventaires mensuels du magasin',
    ],
    skills: { name: 'Vente', keywords: ['Encaissement', 'Mise en rayon', 'Inventaire', 'Accueil client'] },
    summary: 'Caissière, [n] ans en grande distribution, rapidité d\'encaissement et accueil de qualité.',
  },
  {
    id: 'chauffeur', name: 'Chauffeur / livreur', sector: 'Transport',
    lines: [
      'Assurer le transport de personnel et de marchandises sur l\'axe [Dakar – Thiès – Touba]',
      'Parcourir [n] km par mois sans accident ni infraction',
      'Réaliser l\'entretien de premier niveau du véhicule (niveaux, pneus, carnet de bord)',
      'Livrer [n] clients par jour en respectant les délais',
      'Tenir à jour les bons de livraison et le carnet de bord',
    ],
    skills: { name: 'Conduite', keywords: ['Permis B, C, D', 'Conduite défensive', 'Entretien courant', 'Connaissance du réseau routier'] },
    summary: 'Chauffeur, [n] ans d\'expérience, permis [B, C], aucun accident, excellente connaissance du réseau routier sénégalais.',
  },
  {
    id: 'enseignant', name: 'Enseignant(e) / professeur', sector: 'Éducation',
    lines: [
      'Enseigner [matière] à [n] élèves de [classes] conformément aux programmes officiels',
      'Préparer les élèves au BFEM / au baccalauréat : [n] % de réussite',
      'Concevoir des séquences pédagogiques et des évaluations',
      'Assurer le suivi des élèves en difficulté et la relation avec les parents',
      'Animer le club [scientifique / de lecture] de l\'établissement',
    ],
    skills: { name: 'Pédagogie', keywords: ['Préparation de cours', 'Évaluation', 'Gestion de classe', 'Suivi des élèves'] },
    summary: 'Professeur de [matière], [n] ans d\'enseignement au collège et au lycée, [n] % de réussite aux examens.',
  },
  {
    id: 'infirmier', name: 'Infirmier(ère) / sage-femme', sector: 'Santé',
    lines: [
      'Assurer les soins infirmiers de [n] patients par jour en service de [service]',
      'Administrer les traitements et surveiller les paramètres vitaux',
      'Réaliser les consultations prénatales et le suivi des accouchements',
      'Participer aux campagnes de vaccination et de sensibilisation communautaire',
      'Tenir les dossiers de soins et les registres sanitaires',
    ],
    skills: { name: 'Soins', keywords: ['Soins infirmiers', 'Santé maternelle et infantile', 'Vaccination', 'Hygiène hospitalière', 'DHIS2'] },
    summary: 'Infirmier d\'État, [n] ans en structure publique, soins, prévention et santé communautaire.',
  },
  {
    id: 'securite', name: 'Agent(e) de sécurité / gardiennage', sector: 'Sécurité',
    lines: [
      'Contrôler les accès de [site] ([n] visiteurs par jour)',
      'Effectuer des rondes de surveillance de jour et de nuit',
      'Rédiger les rapports d\'incidents et la main courante',
      'Appliquer les consignes de sécurité incendie et d\'évacuation',
      'Surveiller les écrans de vidéoprotection',
    ],
    skills: { name: 'Sécurité', keywords: ['Contrôle d\'accès', 'Rondes', 'Sécurité incendie', 'Premiers secours', 'Vidéoprotection'] },
    summary: 'Agent de sécurité, [n] ans d\'expérience en surveillance de sites industriels et commerciaux.',
  },
  {
    id: 'electricien', name: 'Électricien(ne) / technicien(ne) de maintenance', sector: 'Technique',
    lines: [
      'Installer et raccorder des tableaux électriques basse tension',
      'Diagnostiquer et réparer les pannes sur [n] équipements de production',
      'Réaliser la maintenance préventive selon le planning (taux de disponibilité [n] %)',
      'Poser des installations photovoltaïques de [n] kWc',
      'Respecter les consignes de sécurité électrique (habilitation [B1V / BR])',
    ],
    skills: { name: 'Électricité', keywords: ['Basse tension', 'Lecture de schémas', 'Maintenance préventive', 'Photovoltaïque', 'Habilitation électrique'] },
    summary: 'Électricien de maintenance, [n] ans d\'expérience en industrie, dépannage et installations solaires.',
  },
  {
    id: 'btp', name: 'BTP : maçon, chef de chantier, conducteur de travaux', sector: 'BTP',
    lines: [
      'Encadrer une équipe de [n] ouvriers sur un chantier de [type d\'ouvrage]',
      'Lire les plans et implanter les ouvrages',
      'Suivre l\'avancement, les approvisionnements et les attachements',
      'Livrer le chantier dans le budget de [n] millions FCFA et le délai de [n] mois',
      'Faire respecter le port des équipements de protection individuelle',
    ],
    skills: { name: 'Travaux', keywords: ['Lecture de plans', 'Gros œuvre', 'Suivi de chantier', 'Métré', 'AutoCAD'] },
    summary: 'Chef de chantier, [n] ans d\'expérience en bâtiment et génie civil, équipes de [n] ouvriers.',
  },
  {
    id: 'mecanicien', name: 'Mécanicien(ne) automobile / engins', sector: 'Technique',
    lines: [
      'Diagnostiquer les pannes moteur, freinage et électricité sur véhicules légers et poids lourds',
      'Réaliser l\'entretien périodique d\'un parc de [n] véhicules',
      'Réduire l\'immobilisation des véhicules de [n] %',
      'Commander les pièces détachées et tenir le stock',
    ],
    skills: { name: 'Mécanique', keywords: ['Diagnostic électronique', 'Moteurs diesel', 'Freinage', 'Entretien de flotte'] },
    summary: 'Mécanicien poids lourds, [n] ans d\'expérience en entretien de flotte et diagnostic.',
  },
  {
    id: 'developpeur', name: 'Développeur(se) / informaticien(ne)', sector: 'Numérique',
    lines: [
      'Développer une application web de [fonction] utilisée par [n] clients',
      'Intégrer les paiements Wave et Orange Money via leurs API',
      'Réduire le temps de chargement de [n] % en optimisant les requêtes',
      'Mettre en place les tests automatisés et l\'intégration continue',
      'Assurer le support utilisateur et la maintenance du parc informatique',
    ],
    skills: { name: 'Développement', keywords: ['JavaScript', 'PHP / Laravel', 'SQL', 'Git', 'API REST'] },
    summary: 'Développeur web, [n] ans d\'expérience, applications de paiement mobile et services en ligne.',
  },
  {
    id: 'community', name: 'Community manager / marketing digital', sector: 'Communication',
    lines: [
      'Animer les pages Facebook, Instagram et TikTok de [marque] ([n] abonnés)',
      'Faire passer la communauté de [n] à [n] abonnés en [n] mois',
      'Piloter des campagnes publicitaires Meta d\'un budget de [n] FCFA par mois',
      'Produire le calendrier éditorial et les visuels (Canva)',
      'Analyser les statistiques et produire un reporting mensuel',
    ],
    skills: { name: 'Marketing digital', keywords: ['Réseaux sociaux', 'Publicité Meta', 'Canva', 'Rédaction web', 'Statistiques'] },
    summary: 'Community manager, [n] ans d\'expérience, croissance d\'audience et campagnes publicitaires mesurées.',
  },
  {
    id: 'rh', name: 'Ressources humaines', sector: 'Administration',
    lines: [
      'Gérer la paie de [n] salariés et les déclarations IPRES et CSS',
      'Conduire [n] recrutements par an, de la fiche de poste à l\'intégration',
      'Rédiger les contrats de travail conformément au Code du travail sénégalais',
      'Organiser le plan de formation annuel',
      'Suivre les absences, congés et dossiers du personnel',
    ],
    skills: { name: 'RH', keywords: ['Paie', 'Code du travail sénégalais', 'Recrutement', 'Gestion administrative du personnel', 'Formation'] },
    summary: 'Chargée RH, [n] ans d\'expérience, paie, recrutement et droit du travail sénégalais.',
  },
  {
    id: 'logistique', name: 'Logistique / magasinier', sector: 'Logistique',
    lines: [
      'Réceptionner et contrôler [n] livraisons par semaine',
      'Gérer un stock de [n] références avec un écart d\'inventaire inférieur à [n] %',
      'Préparer les commandes et organiser les expéditions vers les régions',
      'Suivre les opérations de dédouanement au Port autonome de Dakar',
    ],
    skills: { name: 'Logistique', keywords: ['Gestion de stock', 'Inventaire', 'Transit et dédouanement', 'Excel', 'Chariot élévateur'] },
    summary: 'Magasinier, [n] ans d\'expérience en gestion de stock et expédition.',
  },
  {
    id: 'ong', name: 'ONG / projets de développement (suivi-évaluation)', sector: 'Développement',
    lines: [
      'Collecter et analyser les données de suivi de [n] bénéficiaires (KoboToolbox)',
      'Rédiger les rapports d\'activité trimestriels pour les bailleurs',
      'Animer [n] séances de sensibilisation communautaire dans la région de [région]',
      'Mettre à jour le cadre logique et les indicateurs du projet',
      'Coordonner les partenaires locaux (mairies, groupements de femmes)',
    ],
    skills: { name: 'Gestion de projet', keywords: ['Suivi-évaluation', 'Cadre logique', 'KoboToolbox', 'Rédaction de rapports', 'Mobilisation communautaire'] },
    summary: 'Chargé de suivi-évaluation, [n] ans en ONG, collecte de données et rapports aux bailleurs.',
  },
  {
    id: 'agriculture', name: 'Agriculture / élevage / agronomie', sector: 'Agriculture',
    lines: [
      'Encadrer [n] producteurs sur les techniques de culture [horticole / arachide / riz]',
      'Augmenter les rendements de [n] % grâce à l\'irrigation goutte-à-goutte',
      'Suivre la campagne agricole : semences, intrants, récolte et commercialisation',
      'Organiser les producteurs en groupement d\'intérêt économique (GIE)',
    ],
    skills: { name: 'Agronomie', keywords: ['Techniques culturales', 'Irrigation', 'Encadrement de producteurs', 'Gestion de GIE'] },
    summary: 'Technicien agricole, [n] ans d\'encadrement de producteurs dans la vallée du fleuve Sénégal.',
  },
  {
    id: 'hotellerie', name: 'Hôtellerie-restauration / tourisme', sector: 'Tourisme',
    lines: [
      'Accueillir et enregistrer [n] clients par jour à la réception',
      'Gérer les réservations et le planning des chambres',
      'Préparer et servir [n] couverts par service',
      'Obtenir une note de [n]/5 sur les plateformes d\'avis clients',
      'Accueillir une clientèle internationale en français, anglais et wolof',
    ],
    skills: { name: 'Hôtellerie', keywords: ['Accueil', 'Réservations', 'Service en salle', 'Hygiène alimentaire (HACCP)', 'Anglais'] },
    summary: 'Réceptionniste, [n] ans en hôtellerie à [Saly / Cap Skirring], accueil d\'une clientèle internationale.',
  },
  {
    id: 'banque', name: 'Banque / microfinance', sector: 'Finance',
    lines: [
      'Gérer un portefeuille de [n] clients particuliers et PME',
      'Instruire [n] dossiers de crédit par mois avec un taux d\'impayés inférieur à [n] %',
      'Ouvrir [n] comptes et placer les produits d\'épargne',
      'Appliquer les procédures KYC et de conformité BCEAO',
    ],
    skills: { name: 'Banque', keywords: ['Analyse de crédit', 'Relation client', 'Conformité BCEAO', 'Microfinance', 'Recouvrement'] },
    summary: 'Chargé de clientèle, [n] ans en banque et microfinance, crédit aux particuliers et PME.',
  },
  {
    id: 'couture', name: 'Couture / artisanat', sector: 'Artisanat',
    lines: [
      'Confectionner des tenues sur mesure (grand boubou, taille basse, costumes)',
      'Réaliser [n] commandes par mois pour une clientèle fidèle',
      'Prendre les mesures et conseiller les clients sur les tissus (bazin, wax)',
      'Former [n] apprentis aux techniques de coupe',
    ],
    skills: { name: 'Couture', keywords: ['Coupe', 'Confection sur mesure', 'Broderie', 'Gestion d\'atelier'] },
    summary: 'Tailleur, [n] ans d\'expérience en confection sur mesure et gestion d\'atelier.',
  },
  {
    id: 'stagiaire', name: 'Jeune diplômé(e) / premier emploi', sector: 'Débutant',
    lines: [
      'Réaliser un stage de [n] mois au service [service] de [entreprise]',
      'Mener un mémoire de fin d\'études sur [sujet] (mention [mention])',
      'Participer à [n] projets de groupe, dont [projet]',
      'Encadrer [n] élèves en cours de soutien',
      'Organiser un événement de [n] participants au sein de l\'association des étudiants',
    ],
    skills: { name: 'Compétences', keywords: ['Word', 'Excel', 'PowerPoint', 'Travail en équipe', 'Recherche documentaire'] },
    summary: 'Diplômé d\'un [Master / Licence] en [domaine], [n] mois de stage en [domaine], disponible immédiatement.',
  },
];

export function getJob(id) {
  return JOBS.find((j) => j.id === id) || null;
}

/** Verbes d'action proposés pour varier les débuts de ligne. */
export const ACTION_VERBS_FR = [
  'Piloter', 'Coordonner', 'Encadrer', 'Former', 'Organiser', 'Réaliser', 'Concevoir', 'Développer', 'Améliorer', 'Augmenter',
  'Réduire', 'Négocier', 'Analyser', 'Gérer', 'Assurer', 'Superviser', 'Mettre en place', 'Rédiger', 'Accompagner', 'Conseiller',
];
