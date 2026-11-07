// Récap d'un mois, calculé depuis l'onglet Entries : mêmes règles que Recap.gs. Calculs purs.
// - Travaillé = créneaux attribués à un projet (À attribuer, Pause, Ignoré n'en font pas partie).
// - Base par semaine = heures par jour × jours travaillés du mois − congés (arrondis par journée) ; 0 sans base.
import { CODES } from './regles.js';
import { lundiDe, jourDeLaSemaine } from './semaine.js';
import { t } from './textes.js';
import { nonTravailleDuJour } from './conges.js';

export { nonTravailleDuJour };

const deuxChiffres = (n) => String(n).padStart(2, '0');

/**
 * Mois en cours ("2026-11", aujourd'hui "2026-11-06") : arrêté à aujourd'hui ; mois passé : complet (null).
 */
export function dateLimitePour(mois, aujourdhui) {
  return aujourdhui.slice(0, 7) <= mois ? aujourdhui : null;
}

function semainesDuMois(annee, mois, dateLimite, dateDebut, temps) {
  const semaines = {};
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  for (let jour = 1; jour <= nbJours; jour++) {
    const date = `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
    const lundi = lundiDe(date);
    semaines[lundi] = semaines[lundi] || { joursOuvres: 0, conge: 0, travaille: 0 };
    const compte = (!dateLimite || date <= dateLimite) && (!dateDebut || date >= dateDebut);
    if (compte && temps.jours.includes(jourDeLaSemaine(date))) semaines[lundi].joursOuvres += 1;
  }
  return semaines;
}

/**
 * Récap d'un mois. saisies : lignes d'Entries (toutes : le filtre du mois est fait ici).
 */
export function construireRecap({ saisies, projets, annee, mois, dateLimite, dateDebut, temps }) {
  const prefixe = `${annee}-${deuxChiffres(mois)}-`;
  const duMois = saisies.filter((s) => s.date.startsWith(prefixe)
    && (!dateLimite || s.date <= dateLimite) && (!dateDebut || s.date >= dateDebut));
  const semaines = semainesDuMois(annee, mois, dateLimite, dateDebut, temps);
  const parCode = {};
  const congesParJour = {};
  const joursTravailles = new Set();
  const totaux = { aAttribuer: 0, pause: 0, ignore: 0, conge: 0 };

  duMois.forEach((s) => {
    if (s.code === '') totaux.aAttribuer += s.minutes;
    else if (s.code === CODES.NON_TRAVAILLE) congesParJour[s.date] = [...(congesParJour[s.date] || []), s];
    else if (s.code === CODES.PAUSE) totaux.pause += s.minutes;
    else if (s.code === CODES.IGNORE) totaux.ignore += s.minutes;
    else {
      parCode[s.code] = (parCode[s.code] || 0) + s.minutes;
      semaines[lundiDe(s.date)].travaille += s.minutes;
      joursTravailles.add(s.date);
    }
  });
  Object.entries(congesParJour).forEach(([date, plages]) => {
    if (!temps.jours.includes(jourDeLaSemaine(date))) return;
    const arrondi = nonTravailleDuJour(plages, temps.minutesParJour);
    totaux.conge += arrondi;
    semaines[lundiDe(date)].conge += arrondi;
  });

  const liste = Object.values(semaines).map((s) => ({
    ...s, base: temps.avecBase ? Math.max(0, s.joursOuvres * temps.minutesParJour - s.conge) : 0
  }));
  const somme = (champ) => liste.reduce((total, s) => total + s[champ], 0);
  const totalTravailleMinutes = somme('travaille');
  const totalBaseMinutes = somme('base');
  const projetsParCode = new Map(projets.map((p) => [p.code, p]));
  return {
    mois: `${annee}-${deuxChiffres(mois)}`,
    dateLimite: dateLimite || null,
    avecBase: temps.avecBase,
    minutesParJour: temps.minutesParJour,
    projets: Object.keys(parCode).sort().map((code) => ({
      code,
      nom: projetsParCode.get(code)?.nom ?? t('recap.codeInconnu'),
      type: projetsParCode.get(code)?.type ?? 'projet',
      minutes: parCode[code]
    })),
    totalTravailleMinutes,
    totalBaseMinutes,
    totalEcartMinutes: totalTravailleMinutes - totalBaseMinutes,
    joursOuvres: somme('joursOuvres'),
    joursTravailles: joursTravailles.size,
    aAttribuerMinutes: totaux.aAttribuer,
    nonTravailleMinutes: totaux.conge,
    pauseMinutes: totaux.pause,
    ignoreMinutes: totaux.ignore
  };
}
