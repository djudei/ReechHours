// Les mots du Google Sheet Timesheets+ : noms d'onglets, en-têtes, valeurs écrites dans les cases.
// ReechHours lit et écrit EXACTEMENT le même Sheet que l'appli Apps Script Timesheets+ :
// les deux applis peuvent servir en même temps sans rien casser. Tout est ici, nulle part ailleurs.

export const ONGLETS = {
  REGLAGES: 'Réglages',
  PROJETS: 'Projets',
  SAISIES: 'Saisies',
  CHARGE: 'Charge'
};

export const EN_TETES = {
  Projets: ['Code', 'Nom', 'Type', 'Statut', 'Lien doc'],
  Saisies: ['Id', 'Date', 'Début', 'Fin', 'Minutes', 'Code projet', 'Source', 'Id événement', 'Titre', 'Attribué auto', 'Modifié le'],
  Reglages: ['Réglage', 'Valeur']
};

export const OUI = 'oui';
export const NON = 'non';

// Choix spéciaux écrits dans la colonne « Code projet » des Saisies.
export const CODES = { NON_TRAVAILLE: 'Non travaillé', PAUSE: 'Pause', IGNORE: 'Ignoré' };
export const SOURCES = { AGENDA: 'agenda', MANUEL: 'manuel' };

// Type et statut d'un projet, tels qu'écrits dans l'onglet Projets.
export const MOTS_PROJETS = {
  type: { projet: 'projet', interne: 'interne' },
  statut: { actif: 'actif', archivé: 'archivé' }
};

// Étiquettes de l'onglet Réglages (colonne A). Lues par étiquette, jamais par position.
export const REGLAGES = {
  nomDocs: 'Nom dans les docs',
  debutSuivi: 'Début du suivi',
  initiales: 'Initiales',
  posteDocs: 'Poste dans les docs',
  emailDestinataire: 'Email destinataire',
  prenomDestinataire: 'Prénom destinataire',
  signature: 'Signature email',
  postes: 'Postes TIMESHEET',
  ecritureDocsReels: 'Écriture docs réels'
};
// Anciennes étiquettes encore présentes dans certains Sheets (renommées par Timesheets+ à la lecture).
export const ANCIENNES_ETIQUETTES = { 'Email N+1': REGLAGES.emailDestinataire, 'Prénom N+1': REGLAGES.prenomDestinataire };

// Onglet Charge : colonne A = intitulés (lignes 2 à 6), dernière ligne « Modifié le », un mois par colonne (« Octobre 2026 »).
export const CHARGE = {
  ENTETE: 'Intitulé',
  LIGNE_MODIFIE: 'Modifié le',
  ZONE_SANS_MISSION: '—',
  INTITULES: ['AO & Reco', 'Projets en cours', 'Projets à venir', 'Projets en clôture', 'Projets clôturés', 'Développement commercial']
};

// Règles de l'agence, fixes (les mêmes que Timesheets+) : 7h par jour, du lundi au vendredi, base 35h.
export const TEMPS_AGENCE = Object.freeze({
  minutesParJour: 420,
  jours: Object.freeze([1, 2, 3, 4, 5]),
  avecBase: true,
  titresConges: Object.freeze(['Non travaillé', 'Off', 'Congés', 'Congé', 'RTT'])
});

// Nom d'un Sheet créé par ReechHours (même nom que Timesheets+ avant son renommage).
export const NOM_NOUVEAU_SHEET = 'Timesheets+ App';
