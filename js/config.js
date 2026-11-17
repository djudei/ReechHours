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
  'https://www.googleapis.com/auth/userinfo.email'  // ton adresse : seules les adresses de l'agence sont acceptées
].join(' ');

// Seuls les comptes Google de ce domaine peuvent utiliser l'appli (vérifié à chaque connexion,
// en plus de l'audience « Interne » réglée dans Google Cloud).
export const DOMAINE_AUTORISE = 'reech.com';

/** Adresse email → true si elle appartient au domaine autorisé (« prenom@reech.com »). */
export function adresseAutorisee(email) {
  const morceaux = String(email || '').trim().toLowerCase().split('@');
  return morceaux.length === 2 && morceaux[0] !== '' && morceaux[1] === DOMAINE_AUTORISE;
}

// Lien vers l'ancienne appli : volontairement vide dans ce dépôt public (adresse interne à l'agence).
export const LIEN_APPLI_ACTUELLE = '';
