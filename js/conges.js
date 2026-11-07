// Congés (« Non travaillé ») : temps compté pour une journée, arrondi à la demi-journée (même règle que Recap.gs).

const DEBUT_APRES_MIDI = 12 * 60;   // un congé qui commence à 12h00 ou après = après-midi
const FIN_MATIN = 14 * 60;          // un congé qui finit à 14h00 ou avant = matin

const minutesDepuisMinuit = (heure) => {
  const [h, m] = String(heure).split(':').map(Number);
  return h * 60 + (m || 0);
};

function selonDuree(minutes, journee) {
  if (minutes >= journee) return journee;
  return minutes > journee / 2 ? journee / 2 : minutes;
}

/**
 * Temps de congé compté pour une journée, selon l'heure des plages (matin, après-midi, à cheval sur midi).
 * plages : [{ debut: "12:30" ou "" (journée entière), minutes }]
 */
export function nonTravailleDuJour(plages, journee) {
  let matin = 0;
  let apresMidi = 0;
  let aCheval = 0;
  plages.forEach((p) => {
    const debut = p.debut ? minutesDepuisMinuit(p.debut) : null;
    if (debut === null) aCheval += p.minutes;
    else if (debut >= DEBUT_APRES_MIDI) apresMidi += p.minutes;
    else if (debut + p.minutes <= FIN_MATIN) matin += p.minutes;
    else aCheval += p.minutes;
  });
  const demi = journee / 2;
  return Math.min(Math.min(matin, demi) + Math.min(apresMidi, demi) + selonDuree(aCheval, journee), journee);
}
