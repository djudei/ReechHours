// Connexion Google et appels aux API, depuis le navigateur de la personne.
// Le jeton d'accès reste en mémoire (jamais enregistré) ; Google le donne pour une heure environ.
import { CLIENT_ID, SCOPES } from './config.js';
import { t } from './textes.js';

const MARGE_EXPIRATION_MS = 60000;
const ATTENTE_SCRIPT_MS = 10000;

let jeton = null;
let expireA = 0;
let client = null;
let enAttente = null;

function attendreScriptGoogle() {
  return new Promise((resoudre, rejeter) => {
    const debut = Date.now();
    const verifier = () => {
      if (window.google?.accounts?.oauth2) return resoudre();
      if (Date.now() - debut > ATTENTE_SCRIPT_MS) return rejeter(new Error(t('erreur.scriptGoogle')));
      setTimeout(verifier, 100);
    };
    verifier();
  });
}

/**
 * Demande un jeton à Google. « invite » : la fenêtre Google s'affiche (premier passage, ou changement de compte).
 * À appeler depuis un clic : sinon le navigateur bloque la fenêtre.
 */
export async function connecter({ invite = false } = {}) {
  await attendreScriptGoogle();
  if (!client) {
    client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (reponse) => {
        const attente = enAttente;
        enAttente = null;
        if (!attente) return;
        if (reponse.error) {
          attente.rejeter(new Error(t('erreur.connexion', { detail: reponse.error_description || reponse.error })));
          return;
        }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(reponse, ...SCOPES.split(' '))) {
          attente.rejeter(new Error(t('erreur.accesIncomplets')));
          return;
        }
        jeton = reponse.access_token;
        expireA = Date.now() + Number(reponse.expires_in || 0) * 1000;
        attente.resoudre(jeton);
      },
      error_callback: (erreur) => {
        const attente = enAttente;
        enAttente = null;
        attente?.rejeter(new Error(t('erreur.connexion', { detail: erreur?.type || '' })));
      }
    });
  }
  return new Promise((resoudre, rejeter) => {
    enAttente = { resoudre, rejeter };
    client.requestAccessToken({ prompt: invite ? 'consent' : '' });
  });
}

export function estConnecte() {
  return Boolean(jeton) && Date.now() < expireA - MARGE_EXPIRATION_MS;
}

export function deconnecter() {
  if (jeton) window.google?.accounts?.oauth2?.revoke(jeton, () => {});
  jeton = null;
  expireA = 0;
}

/**
 * GET sur une API Google ; renvoie le JSON.
 */
export function lireGoogle(url) {
  return appelGoogle(url);
}

/**
 * Envoi (POST, PUT) d'un contenu JSON à une API Google ; renvoie le JSON.
 */
export function ecrireGoogle(url, methode, contenu) {
  return appelGoogle(url, { method: methode, body: JSON.stringify(contenu) });
}

/**
 * Appel d'une API Google avec le jeton de la personne. Erreurs traduites en phrases compréhensibles.
 */
async function appelGoogle(url, options = {}) {
  if (!estConnecte()) await connecter();
  const entetes = { Authorization: `Bearer ${jeton}` };
  if (options.body) entetes['Content-Type'] = 'application/json';
  const reponse = await fetch(url, { ...options, headers: entetes });
  if (reponse.ok) return reponse.json();
  let detail = '';
  try {
    detail = (await reponse.json())?.error?.message || '';
  } catch {
    detail = reponse.statusText;
  }
  if (reponse.status === 401) {
    jeton = null;
    throw new Error(t('erreur.sessionExpiree'));
  }
  if (reponse.status === 403) throw new Error(t('erreur.acces', { detail }));
  if (reponse.status === 404) throw new Error(t('erreur.introuvable'));
  throw new Error(t('erreur.google', { code: reponse.status, detail }));
}
