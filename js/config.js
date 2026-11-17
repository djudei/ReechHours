// Réglages techniques du site.
// CLIENT_ID : l'identifiant « client OAuth » créé dans Google Cloud (projet ReechHours, type « Application Web »,
// audience « Interne » : seuls les comptes de l'agence peuvent se connecter).
// Ce n'est PAS un secret : Google le prévoit visible dans la page ; seules les adresses autorisées
// dans Google Cloud (localhost pendant les essais, puis l'adresse du site) peuvent l'utiliser.
export const CLIENT_ID = '176680700160-g687paf64f7klgtv49t29ncsvt27t1si.apps.googleusercontent.com';

// Accès demandés à la personne, au minimum : lire son Agenda, lire et écrire dans ses Google Sheets,
// préparer un brouillon Gmail du récap.
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.compose',  // créer des brouillons (jamais d'envoi par l'appli)
  'https://www.googleapis.com/auth/userinfo.email'  // ton adresse : la base agence vérifie qui envoie les temps
].join(' ');

// Adresse du collecteur de la base agence (projet Apps Script « Agence », déploiement pour ReechHours).
// Pas un secret : le collecteur n'accepte que les comptes Google de l'agence, vérifiés auprès de Google.
// Vide tant que le collecteur n'est pas prêt : les boutons de la base agence le disent.
export const AGENCE_URL = '';

// Lien vers l'ancienne appli : volontairement vide dans ce dépôt public (adresse interne à l'agence).
export const LIEN_APPLI_ACTUELLE = '';
