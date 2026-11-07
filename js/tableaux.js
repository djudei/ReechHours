// Tableaux des onglets générés dans le Sheet (repris de Tableaux.gs, RecapMois.gs, RecapAnnuel.gs) :
// « Novembre 2026 » (une colonne par jour, en HH:MM) et « Récap annuel 2026 » (une colonne par mois, en jours).
// Calculs purs : les lignes du tableau, et où mettre quelle mise en forme.
import { CODES_SPECIAUX, CODES } from './regles.js';
import { nonTravailleDuJour } from './conges.js';
import { construireRecap, dateLimitePour } from './recap.js';
import { jourDeLaSemaine } from './semaine.js';
import { t, calendrier } from './textes.js';

export const COLONNES_FIXES = 5;   // N° projet, Projet, Type, Total (HH:MM), Total (jours)
const MINUTES_PAR_24H = 24 * 60;
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const deuxChiffres = (n) => String(n).padStart(2, '0');

const enJours = (minutes, mpj) => Math.round(minutes / mpj * 100) / 100;

/**
 * 1 → "A", 27 → "AA".
 */
export function lettreColonne(numero) {
  let lettres = '';
  let n = numero;
  while (n > 0) {
    const reste = (n - 1) % 26;
    lettres = String.fromCharCode(65 + reste) + lettres;
    n = Math.floor((n - 1) / 26);
  }
  return lettres;
}

/**
 * 11, 2026 → "Novembre 2026" (nom de l'onglet du mois).
 */
export function nomDuMois(mois, annee) {
  const nom = calendrier.NOMS_MOIS[mois - 1];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${annee}`;
}

/**
 * Ligne « Base » : "Base 35h", "Base à date" (mois en cours) ou null (pas de base).
 */
export function libelleBase(temps, aDate) {
  if (!temps.avecBase) return null;
  if (aDate) return t('sheet.baseADate');
  const total = temps.minutesParJour * temps.jours.length;
  const heures = `${Math.floor(total / 60)}h${total % 60 ? deuxChiffres(total % 60) : ''}`;
  return t('sheet.base', { heures });
}

/**
 * Le tableau d'un onglet de récap. o = { titre, sousTitre, enTetesPeriodes, periodes: [{ minutesParCode, baseMinutes,
 * nonTravailleMinutes, aAttribuerMinutes }], projets, libelleBase, categories, unite: 'jours' | 'duree', periodesGrisees, minutesParJour }
 */
export function construireTableauRecap(o) {
  const nbPeriodes = o.periodes.length;
  const largeur = COLONNES_FIXES + nbPeriodes;
  const mpj = o.minutesParJour;
  const lignes = [];
  const info = { lignesTitre: [], lignesEnTete: [], lignesSection: [], lignesTotal: [], lignesDuree: [] };
  const ajouter = (ligne) => {
    lignes.push([...ligne, ...Array(Math.max(0, largeur - ligne.length)).fill('')].slice(0, largeur));
    return lignes.length;
  };
  const enPeriode = (minutes, videSiZero) => {
    if (o.unite === 'jours') return enJours(minutes, mpj);
    return videSiZero && !minutes ? '' : minutes / MINUTES_PAR_24H;
  };

  const minutes = {};
  o.periodes.forEach((periode, i) => {
    Object.entries(periode.minutesParCode).forEach(([code, m]) => {
      minutes[code] = minutes[code] || Array(nbPeriodes).fill(0);
      minutes[code][i] += m;
    });
  });
  const total = (code) => (minutes[code] || []).reduce((a, b) => a + b, 0);

  // Projets affichés, dans l'ordre de l'onglet Projects : actifs, ou avec du temps sur la période.
  const nomCategorie = Object.fromEntries(o.categories.map((c) => [c.type, c.nom]));
  const listes = Object.fromEntries(o.categories.map((c) => [c.type, []]));
  const connus = new Set();
  o.projets.forEach((p) => {
    connus.add(p.code);
    if (p.statut !== 'actif' && total(p.code) === 0) return;
    const type = listes[p.type] ? p.type : 'projet';
    listes[type].push({ code: p.code, nom: p.nom, type });
  });
  Object.keys(minutes).forEach((code) => {
    if (!connus.has(code)) listes.projet.push({ code, nom: t('sheet.codeInconnu'), type: 'projet' });
  });

  info.lignesTitre.push(ajouter([o.titre]));
  ajouter([o.sousTitre]);
  ajouter([]);
  const enTetes = [t('sheet.enTete.totalDuree'), t('sheet.enTete.totalJours'), ...o.enTetesPeriodes];
  info.lignesEnTete.push(ajouter([t('sheet.enTete.code'), t('sheet.enTete.projet'), t('sheet.enTete.type'), ...enTetes]));

  const ligneProjet = (p) => {
    const parPeriode = minutes[p.code] || Array(nbPeriodes).fill(0);
    const n = ajouter([p.code, p.nom, nomCategorie[p.type], total(p.code) / MINUTES_PAR_24H, enJours(total(p.code), mpj),
      ...parPeriode.map((m) => enPeriode(m, true))]);
    info.lignesDuree.push(n);
    return n;
  };
  const plages = o.categories.map((c) => {
    info.lignesSection.push(ajouter([c.nom]));
    const numeros = listes[c.type].map(ligneProjet);
    return numeros.length ? { de: numeros[0], a: numeros[numeros.length - 1] } : null;
  });

  // Totaux : de vraies sommes, colonne par colonne (D, E et chaque période).
  const ligneFormule = (libelle, fabrique, estTotal) => {
    const cellules = ['', libelle, ''];
    for (let c = 4; c <= largeur; c++) cellules.push(fabrique(lettreColonne(c)));
    const n = ajouter(cellules);
    info.lignesDuree.push(n);
    if (estTotal) info.lignesTotal.push(n);
    return n;
  };
  const somme = (plage) => (l) => (plage ? `=SUM(${l}${plage.de}:${l}${plage.a})` : 0);
  const totaux = o.categories.map((c, i) => ligneFormule(t('sheet.total', { categorie: c.nom.toLowerCase() }), somme(plages[i]), true));
  ajouter([]);

  info.lignesEnTete.push(ajouter([t('sheet.synthese'), '', '', ...enTetes]));
  const ligneValeurs = (libelle, champ) => {
    const parPeriode = o.periodes.map((p) => p[champ]);
    const tot = parPeriode.reduce((a, b) => a + b, 0);
    const n = ajouter(['', libelle, '', tot / MINUTES_PAR_24H, enJours(tot, mpj), ...parPeriode.map((m) => enPeriode(m, false))]);
    info.lignesDuree.push(n);
    return n;
  };
  const travaille = ligneFormule(t('sheet.travaille'), (l) => `=${totaux.map((n) => `${l}${n}`).join('+')}`);
  const base = o.libelleBase ? ligneValeurs(o.libelleBase, 'baseMinutes') : null;
  const auDela = base ? ligneFormule(t('sheet.auDela'), (l) => `=${l}${travaille}-${l}${base}`) : null;
  ligneValeurs(t('sheet.nonTravaille'), 'nonTravailleMinutes');
  ligneValeurs(t('sheet.aAttribuer'), 'aAttribuerMinutes');

  return {
    lignes, largeur, unite: o.unite, ...info, ligneAuDela: auDela,
    colonnesGrisees: (o.periodesGrisees || []).map((i) => COLONNES_FIXES + i + 1)
  };
}

const arrete = (dateLimite) => {
  const [a, m, j] = dateLimite.split('-');
  return t('sheet.arrete', { date: `${j}/${m}/${a}` });
};

/**
 * Tableau de l'onglet du mois : une colonne par jour (week-ends compris), durées en HH:MM.
 */
export function construireTableauMois({ annee, mois, saisies, projets, temps, dateDebut, dateLimite, genereLe, categories }) {
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const periodes = [];
  const enTetes = [];
  const grisees = [];
  for (let jour = 1; jour <= nbJours; jour++) {
    const date = `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
    const dansLaPeriode = (!dateDebut || date >= dateDebut) && (!dateLimite || date <= dateLimite);
    const duJour = dansLaPeriode ? saisies.filter((s) => s.date === date) : [];
    const minutesParCode = {};
    let aAttribuer = 0;
    const conges = [];
    duJour.forEach((s) => {
      if (s.code === '') aAttribuer += s.minutes;
      else if (s.code === CODES.NON_TRAVAILLE) conges.push(s);
      else if (!CODES_SPECIAUX.includes(s.code)) minutesParCode[s.code] = (minutesParCode[s.code] || 0) + s.minutes;
    });
    const ouvreJour = temps.jours.includes(jourDeLaSemaine(date));
    const ouvre = ouvreJour && dansLaPeriode;
    const conge = ouvre ? nonTravailleDuJour(conges, temps.minutesParJour) : 0;
    periodes.push({
      minutesParCode,
      baseMinutes: ouvre && temps.avecBase ? Math.max(0, temps.minutesParJour - conge) : 0,
      nonTravailleMinutes: conge,
      aAttribuerMinutes: aAttribuer
    });
    enTetes.push(`${JOURS_COURTS[jourDeLaSemaine(date)]} ${jour}`);
    if (!ouvreJour) grisees.push(jour - 1);
  }
  const estArrete = Boolean(dateLimite) && dateLimite.slice(0, 7) === `${annee}-${deuxChiffres(mois)}`;
  return construireTableauRecap({
    titre: `${t('sheet.titreMois')} · ${nomDuMois(mois, annee)}${estArrete ? arrete(dateLimite) : ''}`,
    sousTitre: genereLe, enTetesPeriodes: enTetes, periodes, projets, categories,
    libelleBase: libelleBase(temps, estArrete), unite: 'duree', periodesGrisees: grisees, minutesParJour: temps.minutesParJour
  });
}

/**
 * Mois (1 à 12) du récap annuel : du premier mois avec des saisies jusqu'au mois en cours
 * (année en cours) ou au dernier mois avec des saisies (année passée). Année future : rien.
 */
export function moisDuRecapAnnuel(annee, moisAvecSaisies, aujourdhui) {
  if (!moisAvecSaisies.length) return [];
  const anneeEnCours = Number(aujourdhui.slice(0, 4));
  if (annee > anneeEnCours) return [];
  const premier = Math.min(...moisAvecSaisies);
  const dernier = annee === anneeEnCours ? Number(aujourdhui.slice(5, 7)) : Math.max(...moisAvecSaisies);
  return Array.from({ length: Math.max(0, dernier - premier + 1) }, (_, i) => premier + i);
}

/**
 * Mois à écrire ("2026-03"…) : ceux du récap annuel, plus le mois affiché.
 */
export function moisAExporter(annee, moisAvecSaisies, moisAffiche, aujourdhui) {
  const liste = moisDuRecapAnnuel(annee, moisAvecSaisies, aujourdhui).map((m) => `${annee}-${deuxChiffres(m)}`);
  return [...new Set([...liste, moisAffiche])].sort();
}

/**
 * Tableau de l'onglet « Récap annuel AAAA » : une colonne par mois, en jours.
 */
export function construireTableauAnnuel({ annee, mois, saisies, projets, temps, dateDebut, aujourdhui, genereLe, categories }) {
  const recaps = mois.map((m) => construireRecap({
    saisies, projets, annee, mois: m, dateLimite: dateLimitePour(`${annee}-${deuxChiffres(m)}`, aujourdhui), dateDebut, temps
  }));
  const dernier = recaps[recaps.length - 1];
  return construireTableauRecap({
    titre: `${t('sheet.titreAnnuel')} ${annee}${dernier.dateLimite ? arrete(dernier.dateLimite) : ''}`,
    sousTitre: genereLe,
    enTetesPeriodes: recaps.map((r) => nomDuMois(Number(r.mois.slice(5, 7)), annee)),
    periodes: recaps.map((r) => ({
      minutesParCode: Object.fromEntries(r.projets.map((p) => [p.code, p.minutes])),
      baseMinutes: r.totalBaseMinutes, nonTravailleMinutes: r.nonTravailleMinutes, aAttribuerMinutes: r.aAttribuerMinutes
    })),
    projets, categories, libelleBase: libelleBase(temps, Boolean(dernier.dateLimite)), unite: 'jours', minutesParJour: temps.minutesParJour
  });
}
