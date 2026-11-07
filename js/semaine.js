// La semaine affichée : créneaux de chaque jour (Agenda + saisies déjà enregistrées dans le Sheet)
// et résumé (anneau de la semaine, colonnes par jour). Mêmes règles que lireCreneauxDuJour / chargerJournee
// de l'appli Apps Script. Calculs purs ; les dates sont celles du fuseau horaire de l'appareil.
import { CODES, CODES_SPECIAUX, SOURCES, normaliser, preAttribuer } from './regles.js';
import { nonTravailleDuJour } from './conges.js';

const MS_PAR_MINUTE = 60000;

const deuxChiffres = (n) => String(n).padStart(2, '0');

/**
 * Date locale → "2026-11-06".
 */
export function dateTexte(date) {
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
}

function minuitDe(texte) {
  const [a, m, j] = texte.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function ajouterJours(texte, nombre) {
  const date = minuitDe(texte);
  date.setDate(date.getDate() + nombre);
  return dateTexte(date);
}

export function jourDeLaSemaine(texte) {
  return minuitDe(texte).getDay();
}

/**
 * "2026-11-06" (vendredi) → "2026-11-02" (son lundi).
 */
export function lundiDe(texte) {
  return ajouterJours(texte, -((jourDeLaSemaine(texte) + 6) % 7));
}

export function joursDeLaSemaine(lundi) {
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
}

/**
 * Événement de l'API Google Agenda → { id, titre, debut, fin, journee, refuse } ; annulé ou illisible → null.
 * id = iCalUID : c'est l'identifiant que l'appli Apps Script a enregistré dans l'onglet Entries.
 */
export function evenementDepuisApi(e) {
  if (!e || e.status === 'cancelled' || !e.iCalUID || !e.start || !e.end) return null;
  const moi = (e.attendees || []).find((invite) => invite.self);
  const base = { id: e.iCalUID, titre: e.summary || '', refuse: Boolean(moi && moi.responseStatus === 'declined') };
  if (e.start.date) {
    return { ...base, debut: null, fin: null, journee: { debut: e.start.date, fin: e.end.date } };
  }
  const debut = new Date(e.start.dateTime);
  const fin = new Date(e.end.dateTime);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) return null;
  return { ...base, debut, fin, journee: null };
}

const heureMinute = (date) => `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`;

function estTitreConge(titre, temps) {
  const cherche = normaliser(titre);
  return temps.titresConges.some((t) => normaliser(t) === cherche);
}

function proposer(titre, projetsActifs, jourNonTravaille, temps) {
  if (jourNonTravaille) return CODES.IGNORE;
  if (estTitreConge(titre, temps)) return CODES.NON_TRAVAILLE;
  const projet = preAttribuer(titre, projetsActifs);
  return projet ? projet.code : '';
}

/**
 * Créneaux d'un jour : événements de l'Agenda (sans les refusés ni les journées entières, sauf un congé
 * un jour travaillé) avec leur choix enregistré, sinon la proposition automatique ; puis les créneaux manuels.
 * Renvoie [{ id, titre, debut, fin, minutes, choix, proposition, enregistre, journeeEntiere, manuel }], dans l'ordre de la journée.
 * « enregistre » : le créneau a déjà sa ligne dans l'onglet Entries.
 */
export function creneauxDuJour(date, evenements, saisies, projets, temps) {
  const debutJour = minuitDe(date);
  const finJour = minuitDe(ajouterJours(date, 1));
  const projetsActifs = projets.filter((p) => p.statut === 'actif');
  const jourOuvre = temps.jours.includes(jourDeLaSemaine(date));
  const conge = jourOuvre
    ? evenements.find((e) => e && e.journee && e.journee.debut <= date && date < e.journee.fin && estTitreConge(e.titre, temps))
    : null;

  const depuisAgenda = evenements
    .filter((e) => e && !e.journee && !e.refuse && e.debut < finJour && e.fin > debutJour)
    .map((e) => ({
      id: `${e.id}_${e.debut.getTime()}`,
      titre: e.titre,
      debut: heureMinute(e.debut),
      fin: heureMinute(e.fin),
      minutes: Math.round((e.fin - e.debut) / MS_PAR_MINUTE),
      proposition: proposer(e.titre, projetsActifs, Boolean(conge), temps),
      journeeEntiere: false
    }));
  const journeeConge = conge ? [{
    id: `${conge.id}_${date}`, titre: conge.titre, debut: '', fin: '', minutes: temps.minutesParJour,
    proposition: CODES.NON_TRAVAILLE, journeeEntiere: true
  }] : [];

  const enregistrees = new Map(saisies.filter((s) => s.idEvenement).map((s) => [s.idEvenement, s]));
  const agenda = [...journeeConge, ...depuisAgenda].map((creneau) => ({
    ...creneau,
    choix: enregistrees.has(creneau.id) ? enregistrees.get(creneau.id).code : creneau.proposition,
    enregistre: enregistrees.has(creneau.id),
    manuel: false
  }));
  const manuels = saisies
    .filter((s) => s.source === SOURCES.MANUEL && s.date === date)
    .map((s) => ({ id: s.id, titre: s.titre, debut: s.debut, fin: s.fin, minutes: s.minutes, choix: s.code,
      proposition: '', enregistre: true, journeeEntiere: false, manuel: true }));
  return [...agenda, ...manuels].sort((a, b) => a.debut.localeCompare(b.debut));
}

const estProjet = (code) => Boolean(code) && !CODES_SPECIAUX.includes(code);

/**
 * Résumé : [{ date, creneaux }] des 7 jours → par jour { date, parts: [{ code, minutes }], libre, travaille },
 * et pour la semaine { travaille, libre, base, pourcent }. Base = jours travaillés × heures par jour,
 * moins les congés (« Non travaillé ») ; null quand la personne ne calcule pas de base.
 */
export function resumeSemaine(jours, temps) {
  const resumes = jours.map(({ date, creneaux }) => {
    const parCode = new Map();
    creneaux.filter((c) => estProjet(c.choix))
      .forEach((c) => parCode.set(c.choix, (parCode.get(c.choix) || 0) + c.minutes));
    const somme = (filtre) => creneaux.filter(filtre).reduce((t, c) => t + c.minutes, 0);
    return {
      date,
      parts: [...parCode].map(([code, minutes]) => ({ code, minutes })),
      travaille: somme((c) => estProjet(c.choix)),
      libre: somme((c) => !c.choix),
      // Un congé ne réduit la base que sur un jour travaillé (comme dans le Récap).
      conge: temps.jours.includes(jourDeLaSemaine(date))
        ? nonTravailleDuJour(creneaux.filter((c) => c.choix === CODES.NON_TRAVAILLE), temps.minutesParJour) : 0,
      ouvre: temps.jours.includes(jourDeLaSemaine(date))
    };
  });
  const total = (champ) => resumes.reduce((t, j) => t + j[champ], 0);
  const travaille = total('travaille');
  const base = temps.avecBase
    ? Math.max(0, resumes.filter((j) => j.ouvre).length * temps.minutesParJour - total('conge'))
    : null;
  return {
    jours: resumes,
    travaille,
    libre: total('libre'),
    base,
    pourcent: base ? Math.round(travaille / base * 100) : null
  };
}
