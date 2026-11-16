// Lien avec la base agence (projet Apps Script « Agence ») : liste des projets et envoi des temps. Calculs purs.
// Mêmes règles que Agence.gs de Timesheets+. La base reconnaît la personne par son compte Google
// (jeton vérifié par le collecteur), jamais par un nom envoyé par l'appli.
import { idDepuisLien } from './docs-projets.js';

export const STATUT_TERMINE = 'Terminé';
export const FORMAT_NUMERO = /^\d{1,6}$/;
export const DELAI_SYNCHRO_AUTO_MS = 6 * 60 * 60 * 1000;   // synchronisation automatique au plus toutes les 6 heures
const LONGUEUR_MAX_NOM = 80;

const lienDoc = (lien) => (idDepuisLien(lien) ? String(lien).trim() : '');

/** « Acme – Printemps » : commence par le client, comme les titres de l'Agenda (« ACME | sujet »). */
export function nomProjetAgence(d) {
  const morceaux = [String(d.client || '').trim(), String(d.nom || '').trim()].filter(Boolean);
  return (morceaux.join(' – ') || String(d.numero)).slice(0, LONGUEUR_MAX_NOM);
}

/**
 * Ce qu'il faut changer dans l'onglet Projets pour suivre la base :
 * - projet de la base absent ici → ajouté, actif, nommé « Client – Projet » ;
 * - projet Terminé dans la base et actif ici → archivé (on le réactive à la main au besoin) ;
 * - lien de doc vide ici et lien d'ancien Sheet dans la base → complété.
 * Rien n'est jamais renommé ni supprimé ; les lignes internes et les codes inconnus de la base restent tels quels.
 */
export function changementsProjetsAgence(locaux, distants) {
  const parCode = new Map(locaux.map((p) => [p.code, p]));
  const ajouts = [];
  const archivages = [];
  const liens = [];
  const dejaAjoutes = new Set();
  (distants || []).forEach((d) => {
    const numero = String(d.numero ?? '').trim();
    if (!FORMAT_NUMERO.test(numero)) return;
    const local = parCode.get(numero);
    const termine = d.statut === STATUT_TERMINE;
    if (!local) {
      if (!termine && !dejaAjoutes.has(numero)) {
        dejaAjoutes.add(numero);
        ajouts.push({ code: numero, nom: nomProjetAgence(d), lien: lienDoc(d.lienAncienSheet) });
      }
      return;
    }
    if (local.type === 'interne') return;
    if (termine && local.statut === 'actif') archivages.push({ code: local.code, nom: local.nom, numeroLigne: local.numeroLigne });
    if (!local.lienDoc && lienDoc(d.lienAncienSheet)) {
      liens.push({ code: local.code, nom: local.nom, numeroLigne: local.numeroLigne, lien: lienDoc(d.lienAncienSheet) });
    }
  });
  return { ajouts, archivages, liens };
}

/**
 * Lignes de temps à envoyer à partir du récap du mois : projets clients au N° numérique
 * (les lignes internes et les codes libres restent dans le Sheet personnel), en jours à 2 décimales.
 */
export function lignesTempsAgence(recap) {
  return recap.projets
    .filter((p) => p.type !== 'interne' && FORMAT_NUMERO.test(p.code) && p.minutes > 0)
    .map((p) => ({ numero: p.code, jours: Math.round((p.minutes / recap.minutesParJour) * 100) / 100 }));
}

/**
 * Réponse du collecteur → { succes, donnees, erreur }. Une page HTML (connexion Google, accès refusé)
 * ou un code d'erreur est signalé tel quel, jamais pris pour une réponse.
 */
export function lireReponseAgence(code, texte) {
  if (code !== 200) return { succes: false, erreur: `elle ne répond pas (code ${code}). Réessaie plus tard.` };
  try {
    const json = JSON.parse(texte);
    return json && typeof json.succes === 'boolean' ? json : { succes: false, erreur: 'réponse inattendue.' };
  } catch {
    return { succes: false, erreur: 'accès refusé ou adresse incorrecte (la réponse n\'est pas celle de la base).' };
  }
}
