// Mise en forme des durées, dates et couleurs de projets pour l'affichage.
import { t, calendrier } from './textes.js';
import { CODES_SPECIAUX } from './regles.js';

const MINUTES_PAR_HEURE = 60;
const NOMBRE_COULEURS_PROJETS = 8;

/**
 * 1410 → "23 h 30" ; 60 → "1 h" ; 30 → "30 min" ; 0 → "0 h".
 */
export function duree(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / MINUTES_PAR_HEURE);
  const m = total % MINUTES_PAR_HEURE;
  if (h === 0 && m > 0) return t('duree.minutes', { m });
  if (m === 0) return t('duree.heures', { h });
  return t('duree.heuresMinutes', { h, m: String(m).padStart(2, '0') });
}

/**
 * Numéro de semaine ISO (le lundi de la semaine en "2026-11-02") → 45.
 */
export function numeroSemaine(lundi) {
  const [a, m, j] = lundi.split('-').map(Number);
  const date = new Date(Date.UTC(a, m - 1, j + 3));   // le jeudi décide de l'année de la semaine
  const premierJeudi = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date - premierJeudi) / 86400000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7);
}

const morceaux = (texte) => texte.split('-').map(Number);

/**
 * "2026-11-02" et "2026-11-08" → "2 – 8 novembre" ; à cheval sur deux mois → "28 sept. – 4 octobre".
 */
export function periode(debut, fin) {
  const [, m1, j1] = morceaux(debut);
  const [, m2, j2] = morceaux(fin);
  const mois = calendrier.NOMS_MOIS;
  if (m1 === m2) return `${j1} – ${j2} ${mois[m2 - 1]}`;
  return `${j1} ${mois[m1 - 1]} – ${j2} ${mois[m2 - 1]}`;
}

/**
 * "2026-11-06" → "Vendredi 6 novembre".
 */
export function titreJour(date) {
  const [a, m, j] = morceaux(date);
  const nom = calendrier.NOMS_JOURS[new Date(a, m - 1, j).getDay()];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${j} ${calendrier.NOMS_MOIS[m - 1]}`;
}

export function lettreJour(date) {
  const [a, m, j] = morceaux(date);
  return calendrier.JOURS_COURTS[new Date(a, m - 1, j).getDay()];
}

/**
 * Couleur d'un choix : projet (couleur stable d'après sa place dans la liste), interne, pause / ignoré, à attribuer.
 * Renvoie un nom de variable CSS (les couleurs exactes changent avec le thème clair / sombre).
 */
export function couleurChoix(code, projets) {
  if (!code) return 'var(--signal)';
  if (CODES_SPECIAUX.includes(code)) return 'var(--neutre)';
  const projet = projets.find((p) => p.code === code);
  if (projet && projet.type === 'interne') return 'var(--projet-interne)';
  const clients = projets.filter((p) => p.type !== 'interne');
  const place = clients.findIndex((p) => p.code === code);
  return `var(--projet-${(place < 0 ? 0 : place) % NOMBRE_COULEURS_PROJETS})`;
}

/**
 * Libellé d'un choix : "2026-014 · Atelier Morel", "Pause", "À attribuer".
 */
export function libelleChoix(code, projets) {
  if (!code) return t('creneau.aAttribuer');
  if (CODES_SPECIAUX.includes(code)) return t(`special.${code}`);
  const projet = projets.find((p) => p.code === code);
  if (!projet) return t('projet.inconnu', { code });
  return projet.type === 'interne' ? projet.nom : `${projet.code} · ${projet.nom}`;
}
