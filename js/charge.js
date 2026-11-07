// Charge : missions par mois, rangées en zones (AO & Reco, Projets en cours…). Même onglet « Charge » que Charge.gs :
// ligne 1 = « Intitulé » puis un mois par colonne (« Octobre 2026 »), une ligne par intitulé, dernière ligne « Modifié le ».
// Dans une case : les missions, une par ligne ; « — » = zone affichée mais sans mission. Calculs purs.
import { t, calendrier } from './textes.js';
import { normaliser } from './regles.js';
import { ONGLETS, CHARGE } from './schema.js';

export const ONGLET_CHARGE = ONGLETS.CHARGE;
const ENTETE = CHARGE.ENTETE;
const LIGNE_MODIFIE = CHARGE.LIGNE_MODIFIE;
const ENTETE_ANCIEN_FORMAT = 'Mois';
const ZONE_SANS_MISSION = CHARGE.ZONE_SANS_MISSION;
export const INTITULES_PAR_DEFAUT = [...CHARGE.INTITULES];
const INTITULES_MAX = 5;
const ZONES_PAR_DEFAUT = 3;
const MAX_ELEMENTS_PAR_ZONE = 60;
const LONGUEUR_MAX_ELEMENT = 300;

const nettoyer = (texte) => String(texte ?? '').trim().replace(/\s+/g, ' ');

/**
 * Liste d'intitulés "AO & Reco | Projets en cours" → ["AO & Reco", "Projets en cours"] ; aucun → null.
 */
export function lireIntitulesCharge(texte) {
  const intitules = String(texte ?? '').split('|').map(nettoyer).filter(Boolean);
  return intitules.length ? intitules.slice(0, INTITULES_MAX) : null;
}

/**
 * "2026-10" → « Octobre 2026 » (en-tête de colonne écrit, comme Timesheets+).
 */
export function enteteDeMois(cle) {
  const [annee, mois] = cle.split('-').map(Number);
  const nom = calendrier.NOMS_MOIS[mois - 1];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${annee}`;
}

/**
 * En-tête de colonne → "2026-11" (« Novembre 2026 », ou "2026-11") ; illisible → "".
 */
function moisDeEntete(entete) {
  const texte = String(entete).trim();
  if (/^\d{4}-\d{2}$/.test(texte)) return texte;
  const [nom, annee] = texte.split(/\s+/);
  const index = calendrier.NOMS_MOIS.findIndex((m) => normaliser(m) === normaliser(nom));
  return index >= 0 && /^\d{4}$/.test(annee || '') ? `${annee}-${String(index + 1).padStart(2, '0')}` : '';
}

/**
 * Grille de l'onglet → { mois: { "2026-11": { intitulé: texte } }, modifie: { mois: date }, intitules }.
 * Ancien format (avant le tableau) ou colonne illisible : erreur, on n'écrit rien.
 */
export function lireTableauCharge(grille, intitulesReglages) {
  const resultat = { mois: {}, modifie: {}, intitules: [...intitulesReglages] };
  if (!grille.length) return resultat;
  if (String(grille[0][0]).trim() === ENTETE_ANCIEN_FORMAT) throw new Error(t('charge.erreur.ancienFormat'));
  const colonnes = grille[0].slice(1).map((entete) => {
    if (!String(entete ?? '').trim()) return '';
    const cle = moisDeEntete(entete);
    if (!cle) throw new Error(t('charge.erreur.colonne', { colonne: entete }));
    return cle;
  });
  grille.slice(1).forEach((ligne) => {
    const intitule = nettoyer(ligne[0]);
    if (!intitule) return;
    if (normaliser(intitule) === normaliser(LIGNE_MODIFIE)) {
      colonnes.forEach((cle, i) => { if (cle && ligne[i + 1]) resultat.modifie[cle] = ligne[i + 1]; });
      return;
    }
    if (!resultat.intitules.includes(intitule)) resultat.intitules.push(intitule);
    colonnes.forEach((cle, i) => {
      if (!cle) return;
      resultat.mois[cle] = resultat.mois[cle] || {};
      if (String(ligne[i + 1] ?? '').trim()) resultat.mois[cle][intitule] = String(ligne[i + 1]);
    });
  });
  return resultat;
}

/**
 * Zones d'un mois, dans l'ordre des intitulés des Réglages : [{ categorie, elements }] ; [] si rien n'est noté.
 */
export function zonesDuMois(tableau, mois, intitules) {
  const cases = tableau.mois[mois] || {};
  return intitules.filter((c) => cases[c]).map((categorie) => ({
    categorie,
    elements: cases[categorie] === ZONE_SANS_MISSION ? [] : cases[categorie].split('\n').filter(Boolean)
  }));
}

export function zonesParDefaut(intitules) {
  return intitules.slice(0, ZONES_PAR_DEFAUT).map((categorie) => ({ categorie, elements: [] }));
}

/**
 * Missions saisies (liste ou texte, une par ligne) → liste propre ; les puces tapées (« - », « • ») sont retirées.
 */
function nettoyerElements(elements) {
  const liste = Array.isArray(elements) ? elements : String(elements ?? '').split(/\r?\n/);
  return liste
    .map((e) => String(e ?? '').replace(/^\s*(?:[-–—•*·]\s*)+/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((e) => {
      if (e.length > LONGUEUR_MAX_ELEMENT) throw new Error(t('charge.erreur.ligneLongue', { max: LONGUEUR_MAX_ELEMENT, debut: e.slice(0, 30) }));
      return e;
    });
}

/**
 * Contrôle les zones d'un mois : intitulés connus, chacun une seule fois ; missions nettoyées.
 */
export function verifierZones(zones, intitules) {
  if (zones.length > intitules.length) throw new Error(t('charge.erreur.zones', { max: intitules.length }));
  const vues = new Set();
  return zones.map((zone) => {
    if (!intitules.includes(zone.categorie)) throw new Error(t('charge.erreur.zoneInconnue', { intitule: zone.categorie }));
    if (vues.has(zone.categorie)) throw new Error(t('charge.erreur.zoneDouble', { intitule: zone.categorie }));
    vues.add(zone.categorie);
    const elements = nettoyerElements(zone.elements);
    if (elements.length > MAX_ELEMENTS_PAR_ZONE) throw new Error(t('charge.erreur.tropDeLignes', { intitule: zone.categorie, max: MAX_ELEMENTS_PAR_ZONE }));
    return { categorie: zone.categorie, elements };
  });
}

/**
 * Nouvelle grille complète de l'onglet, avec la colonne du mois remplacée (aucune zone : la colonne disparaît).
 */
export function grilleCharge(tableau, mois, zones, maintenant) {
  const parMois = { ...tableau.mois };
  if (zones.length) {
    parMois[mois] = Object.fromEntries(zones.map((z) => [z.categorie, z.elements.length ? z.elements.join('\n') : ZONE_SANS_MISSION]));
  } else {
    delete parMois[mois];
  }
  return grilleTableau({ ...tableau, mois: parMois, modifie: { ...tableau.modifie, [mois]: maintenant } });
}

/**
 * Grille complète de l'onglet à partir du tableau (mois triés, du plus ancien au plus récent).
 */
export function grilleTableau(tableau) {
  const { mois: parMois, modifie } = tableau;
  const moisTries = Object.keys(parMois).filter((cle) => Object.keys(parMois[cle]).length).sort();
  return [
    [ENTETE, ...moisTries.map(enteteDeMois)],
    ...tableau.intitules.map((intitule) => [intitule, ...moisTries.map((cle) => parMois[cle][intitule] || '')]),
    [LIGNE_MODIFIE, ...moisTries.map((cle) => modifie[cle] || '')]
  ];
}

export function moisSuivant(mois) {
  const [annee, m] = mois.split('-').map(Number);
  return m === 12 ? `${annee + 1}-01` : `${annee}-${String(m + 1).padStart(2, '0')}`;
}
