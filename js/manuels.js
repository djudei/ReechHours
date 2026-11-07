// Créneaux ajoutés à la main : stockés seulement dans l'onglet Saisies (source « manuel »), l'Agenda n'est jamais touché.
// Mêmes règles que Manuels.gs : quarts d'heure, pas de chevauchement avec un créneau compté ou à attribuer
// (pour ne jamais compter deux fois), et seules ces lignes peuvent être supprimées. Calculs purs.
import { CODES_SPECIAUX, SOURCES } from './regles.js';
import { NON } from './schema.js';
import { t } from './textes.js';

const GRANULARITE_MINUTES = 15;
const MINUTES_DANS_JOURNEE = 24 * 60;
export const LONGUEUR_MAX_TITRE = 100;

const deuxChiffres = (n) => String(n).padStart(2, '0');
const enHeureTexte = (minutes) => `${deuxChiffres(Math.floor(minutes / 60))}:${deuxChiffres(minutes % 60)}`;
const heureEnMinutes = (texte) => {
  const [h, m] = String(texte).split(':').map(Number);
  return h * 60 + (m || 0);
};
const compteOuAAttribuer = (choix) => !CODES_SPECIAUX.includes(choix);

/**
 * "09:15" → 555 ; "24:00" accepté ; pas un quart d'heure ou illisible → erreur.
 */
export function lireHeure(texte) {
  const morceaux = /^(\d{2}):(\d{2})$/.exec(String(texte ?? ''));
  if (!morceaux) throw new Error(t('manuel.erreur.heure', { heure: texte || '—' }));
  const minutes = Number(morceaux[1]) * 60 + Number(morceaux[2]);
  if (Number(morceaux[2]) >= 60 || minutes > MINUTES_DANS_JOURNEE || minutes % GRANULARITE_MINUTES !== 0) {
    throw new Error(t('manuel.erreur.quart', { heure: texte }));
  }
  return minutes;
}

/**
 * Premier créneau du jour, compté ou à attribuer, qui chevauche [debut, fin[ (en minutes) ; sinon null.
 */
export function chercherChevauchement(creneauxDuJour, debut, fin, idExclu) {
  return creneauxDuJour.find((c) => {
    if (c.id === idExclu || c.journeeEntiere || !c.debut || !compteOuAAttribuer(c.choix)) return false;
    const debutCreneau = heureEnMinutes(c.debut);
    return debutCreneau < fin && debutCreneau + c.minutes > debut;
  }) || null;
}

export function verifierSansChevauchement(creneauxDuJour, debut, fin, idExclu, choix) {
  if (!compteOuAAttribuer(choix)) return;
  const conflit = chercherChevauchement(creneauxDuJour, debut, fin, idExclu);
  if (conflit) throw new Error(t('manuel.erreur.chevauche', { titre: conflit.titre, debut: conflit.debut, fin: conflit.fin }));
}

function titrePropre(titre) {
  return String(titre ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Nouvelle ligne de Saisies pour un créneau ajouté à la main.
 */
export function planAjoutManuel({ date, debut, fin, titre, choix, creneauxDuJour, maintenant, nouvelId }) {
  const debutMinutes = lireHeure(debut);
  const finMinutes = lireHeure(fin);
  if (finMinutes <= debutMinutes) throw new Error(t('manuel.erreur.ordre'));
  verifierSansChevauchement(creneauxDuJour, debutMinutes, finMinutes, null, choix);
  const intitule = titrePropre(titre).slice(0, LONGUEUR_MAX_TITRE) || t('manuel.titreParDefaut');
  return [nouvelId(), date, enHeureTexte(debutMinutes), enHeureTexte(finMinutes), finMinutes - debutMinutes, choix,
    SOURCES.MANUEL, '', intitule, NON, maintenant];
}

function trouverManuel(saisies, date, id) {
  const saisie = saisies.find((s) => s.id === id && s.source === SOURCES.MANUEL && s.date === date);
  if (!saisie) throw new Error(t('erreur.creneauIntrouvable'));
  return saisie;
}

/**
 * Renommer : la ligne est réécrite à l'identique, seul le titre change.
 */
export function planRenommage({ date, id, titre, saisies, maintenant }) {
  const intitule = titrePropre(titre);
  if (!intitule || intitule.length > LONGUEUR_MAX_TITRE) throw new Error(t('manuel.erreur.titre', { max: LONGUEUR_MAX_TITRE }));
  const s = trouverManuel(saisies, date, id);
  return {
    numeroLigne: s.numeroLigne,
    ligne: [s.id, s.date, s.debut, s.fin, s.minutes, s.code, SOURCES.MANUEL, s.idEvenement || '', intitule, NON, maintenant]
  };
}

/**
 * Supprimer : numéro de la ligne à retirer (seulement une ligne ajoutée à la main, de ce jour).
 */
export function planSuppression({ date, id, saisies }) {
  return trouverManuel(saisies, date, id).numeroLigne;
}
