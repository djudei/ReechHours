// Réglages de la personne (écran Réglages) : vérification des valeurs tapées, puis ce qu'il faut écrire
// dans l'onglet Réglages du Sheet, sous les mêmes étiquettes que Timesheets+. Calculs purs.
// Les temps de travail (7h, lundi–vendredi, base 35h) sont ceux de l'agence : ils ne se règlent pas ici.
import { t } from './textes.js';
import { ONGLETS, REGLAGES, ANCIENNES_ETIQUETTES } from './schema.js';

export const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];
const LONGUEUR_MAX_NOM = 60;
const LONGUEUR_MAX_POSTE = 60;
const FORMAT_INITIALES = /^[A-Za-zÀ-ÿ]{1,5}$/;
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const texte = (valeur) => String(valeur ?? '').trim().replace(/\s+/g, ' ');

export function ecrireHeuresParJour(minutes) {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * « Benjamin LS » → BLS ; « Julien M » → JM : initiales proposées d'après le nom dans les docs.
 */
export function initialesProposees(nom) {
  const mots = texte(nom).split(' ').filter(Boolean);
  if (!mots.length) return '';
  const [premier, ...reste] = mots;
  return (premier.charAt(0) + reste.join('')).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5);
}

/**
 * Valeurs saisies → valeurs propres ; erreur claire sinon (rien n'est écrit).
 */
export function verifierReglages(saisie) {
  const nomDocs = texte(saisie.nomDocs);
  if (!nomDocs) throw new Error(t('reglages.erreur.nomDocs'));
  if (nomDocs.length > LONGUEUR_MAX_NOM) throw new Error(t('reglages.erreur.nomDocsLong', { max: LONGUEUR_MAX_NOM }));
  const initiales = texte(saisie.initiales).toUpperCase() || initialesProposees(nomDocs);
  if (!FORMAT_INITIALES.test(initiales)) throw new Error(t('reglages.erreur.initiales'));
  const posteDocs = texte(saisie.posteDocs);
  if (posteDocs.length > LONGUEUR_MAX_POSTE) throw new Error(t('reglages.erreur.posteLong', { max: LONGUEUR_MAX_POSTE }));
  const emailDestinataire = texte(saisie.emailDestinataire).toLowerCase();
  if (emailDestinataire && !FORMAT_EMAIL.test(emailDestinataire)) throw new Error(t('reglages.erreur.email', { email: emailDestinataire }));
  const prenomDestinataire = texte(saisie.prenomDestinataire);
  if (prenomDestinataire.length > LONGUEUR_MAX_NOM) throw new Error(t('reglages.erreur.prenomLong', { max: LONGUEUR_MAX_NOM }));
  return { nomDocs, initiales, posteDocs, emailDestinataire, prenomDestinataire };
}

/**
 * Lignes de l'onglet Réglages + valeurs propres → { modifications: [{ plage, valeurs }], ajouts: [[étiquette, valeur]] }.
 * Étiquette en double : la première ligne compte (comme dans Timesheets+). Les autres lignes ne bougent jamais.
 */
export function planReglages(lignes, propres) {
  const valeurs = [
    [REGLAGES.nomDocs, propres.nomDocs],
    [REGLAGES.initiales, propres.initiales],
    [REGLAGES.posteDocs, propres.posteDocs],
    [REGLAGES.prenomDestinataire, propres.prenomDestinataire],
    [REGLAGES.emailDestinataire, propres.emailDestinataire]
  ];
  const ligneDe = new Map();
  lignes.forEach((ligne, i) => {
    const lue = texte(ligne[0]);
    const etiquette = ANCIENNES_ETIQUETTES[lue] || lue;   // « Email N+1 » = « Email destinataire »
    if (etiquette && !ligneDe.has(etiquette)) ligneDe.set(etiquette, i + 1);
  });
  return {
    modifications: valeurs.filter(([e]) => ligneDe.has(e))
      .map(([e, v]) => ({ plage: `'${ONGLETS.REGLAGES}'!B${ligneDe.get(e)}`, valeurs: [[v]] })),
    ajouts: valeurs.filter(([e]) => !ligneDe.has(e))
  };
}
