// Ce qu'il faut écrire dans l'onglet Saisies, calculé à partir d'une lecture fraîche du Sheet.
// Mêmes règles que l'appli Apps Script (mettreAJourJournee_, construireLigneSaisie, enregistrerAttribution) :
// rien n'est jamais supprimé, une attribution existante n'est jamais changée par la synchro.
// Calculs purs ; l'envoi à Google est dans donnees.js.
import { CODES, CODES_SPECIAUX, SOURCES } from './regles.js';
import { OUI, NON } from './schema.js';
import { t } from './textes.js';

const deuxChiffres = (n) => String(n).padStart(2, '0');

/**
 * Date → "2026-11-06 09:05:07" (colonne Modifié le, heure de l'appareil).
 */
export function horodatage(date) {
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())} `
    + `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}:${deuxChiffres(date.getSeconds())}`;
}

/**
 * Ligne de Saisies pour un créneau de l'Agenda (colonnes Id … Modifié le).
 * Attribué auto = « oui » seulement si le choix enregistré est celui proposé automatiquement.
 */
export function ligneSaisie({ id, date, creneau, choix, maintenant }) {
  const auto = Boolean(creneau.proposition) && creneau.proposition === choix;
  return [id, date, creneau.debut, creneau.fin, creneau.minutes, choix, SOURCES.AGENDA, creneau.id, creneau.titre,
    auto ? OUI : NON, maintenant];
}

/**
 * Synchro des jours affichés (jusqu'à aujourd'hui, à partir du début du suivi) :
 * créneaux de l'Agenda pas encore dans Saisies → ajoutés avec leur proposition (ou vide = À attribuer) ;
 * lignes de l'Agenda dont la réunion a disparu (refusée, supprimée, déplacée) → passées en Ignoré.
 * Renvoie { ajouts: [ligne], ignores: [numeroLigne] }.
 */
export function planSynchroSemaine({ jours, saisies, aujourdhui, debutSuivi, maintenant, nouvelId }) {
  const plan = { ajouts: [], ignores: [] };
  const connus = new Set(saisies.filter((s) => s.idEvenement).map((s) => s.idEvenement));
  jours
    .filter(({ date }) => date <= aujourdhui && (!debutSuivi || date >= debutSuivi))
    .forEach(({ date, creneaux }) => {
      const agenda = creneaux.filter((c) => !c.manuel);
      const presents = new Set(agenda.map((c) => c.id));
      agenda.filter((c) => !connus.has(c.id)).forEach((c) => {
        plan.ajouts.push(ligneSaisie({ id: nouvelId(), date, creneau: c, choix: c.proposition, maintenant }));
      });
      saisies
        .filter((s) => s.source === SOURCES.AGENDA && s.date === date && s.idEvenement
          && !presents.has(s.idEvenement) && s.code !== CODES.IGNORE)
        .forEach((s) => plan.ignores.push(s.numeroLigne));
    });
  return plan;
}

/**
 * Attribution d'un créneau : { numeroLigne (null = nouvelle ligne), ligne }.
 * Créneau manuel : sa ligne est réécrite à l'identique, seul le choix change ; introuvable → erreur (on n'écrit pas).
 */
export function planAttribution({ date, creneau, choix, saisies, maintenant, nouvelId }) {
  if (creneau.manuel) {
    const saisie = saisies.find((s) => s.id === creneau.id && s.source === SOURCES.MANUEL && s.date === date);
    if (!saisie) throw new Error(t('erreur.creneauIntrouvable'));
    return {
      numeroLigne: saisie.numeroLigne,
      ligne: [saisie.id, saisie.date, saisie.debut, saisie.fin, saisie.minutes, choix, SOURCES.MANUEL,
        saisie.idEvenement, saisie.titre, NON, maintenant]
    };
  }
  const existante = saisies.find((s) => s.idEvenement === creneau.id);
  return {
    numeroLigne: existante ? existante.numeroLigne : null,
    ligne: ligneSaisie({ id: existante ? existante.id : nouvelId(), date, creneau, choix, maintenant })
  };
}

/**
 * Le choix doit être un projet actif, un choix spécial, ou vide (À attribuer). Sinon : erreur, rien n'est écrit.
 */
export function verifierChoix(choix, projets) {
  if (!choix || CODES_SPECIAUX.includes(choix)) return;
  if (!projets.some((p) => p.code === choix && p.statut === 'actif')) {
    throw new Error(t('erreur.choixInconnu', { code: choix }));
  }
}
