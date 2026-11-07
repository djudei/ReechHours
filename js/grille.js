// Grille horaire d'un jour, comme Google Agenda : position de chaque créneau, et créneaux qui se chevauchent
// placés côte à côte (chaque groupe qui se chevauche se partage la largeur). Calcul pur.

const PLAGE_PAR_DEFAUT = { debut: 8, fin: 19 };
const MINUTES_PAR_HEURE = 60;

const enMinutes = (heure) => {
  const [h, m] = String(heure).split(':').map(Number);
  return h * MINUTES_PAR_HEURE + (m || 0);
};

/**
 * creneaux du jour → { plage: { debut, fin } (heures entières), journee: [créneaux sans heure], blocs: [{ creneau, minutes, colonne, colonnes }] }
 */
export function dispositionJour(creneaux) {
  const journee = creneaux.filter((c) => c.journeeEntiere || !c.debut);
  const horaires = creneaux
    .filter((c) => !c.journeeEntiere && c.debut)
    .map((creneau) => {
      const debut = enMinutes(creneau.debut);
      const fin = Math.max(enMinutes(creneau.fin || creneau.debut), debut + 15);
      return { creneau, minutes: { debut, fin } };
    })
    .sort((a, b) => a.minutes.debut - b.minutes.debut || b.minutes.fin - a.minutes.fin);

  // Groupes de créneaux qui se chevauchent, et dans chaque groupe la première colonne libre.
  const blocs = [];
  let groupe = [];
  let finGroupe = -1;
  const fermerGroupe = () => {
    const colonnes = Math.max(1, ...groupe.map((b) => b.colonne + 1));
    groupe.forEach((b) => blocs.push({ ...b, colonnes }));
    groupe = [];
  };
  horaires.forEach((element) => {
    if (element.minutes.debut >= finGroupe && groupe.length) fermerGroupe();
    const finsParColonne = [];
    groupe.forEach((b) => { finsParColonne[b.colonne] = Math.max(finsParColonne[b.colonne] ?? 0, b.minutes.fin); });
    let colonne = finsParColonne.findIndex((fin) => fin <= element.minutes.debut);
    if (colonne === -1) colonne = finsParColonne.length;
    groupe.push({ ...element, colonne });
    finGroupe = Math.max(finGroupe, element.minutes.fin);
  });
  if (groupe.length) fermerGroupe();

  const debuts = horaires.map((h) => Math.floor(h.minutes.debut / MINUTES_PAR_HEURE));
  const fins = horaires.map((h) => Math.ceil(h.minutes.fin / MINUTES_PAR_HEURE));
  return {
    plage: { debut: Math.min(PLAGE_PAR_DEFAUT.debut, ...debuts), fin: Math.min(24, Math.max(PLAGE_PAR_DEFAUT.fin, ...fins)) },
    journee,
    blocs
  };
}
