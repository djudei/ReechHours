// « Mettre à jour mon Google Sheet » : réécrit l'onglet de chaque mois de l'année et « Récap annuel AAAA »,
// puis, pour un membre d'équipe, ses totaux dans « mes totaux ». Comme l'appli actuelle (Export.gs, Tableaux.gs) :
// ces onglets sont entièrement réécrits ; un onglet du même nom fait à la main n'est jamais touché (on signale).
import { construireTableauMois, construireTableauAnnuel, moisAExporter, moisDuRecapAnnuel, nomDuMois, COLONNES_FIXES } from './tableaux.js';
import { construireRecap, dateLimitePour } from './recap.js';
import { categories } from './projets.js';
import { t } from './textes.js';

const COULEURS = { enTete: '#EAF1F9', weekEnd: '#F3F4F6', section: '#5B6170', depassement: '#B3261E' };
// Écrit en calcul (et pas « 0.0001 ») : un Sheet en français refuse le point décimal dans une règle.
const SEUIL_DEPASSEMENT = '=1/10000';
const FORMATS = {
  duree: { type: 'TIME', pattern: '[h]:mm' },
  dureeSansZero: { type: 'TIME', pattern: '[h]:mm;-[h]:mm;""' },
  jours: { type: 'NUMBER', pattern: '0.00' },
  texte: { type: 'TEXT' }
};
// Débuts de titre (A1) des onglets générés, dans toutes les langues de l'appli (au cas où la langue a changé).
const TITRES_GENERES = ['Temps par jour', 'Time per day', 'Zeit pro Tag', 'Tiempo por día',
  'Récap annuel', 'Annual summary', 'Jahresübersicht', 'Resumen anual'];
const LARGEUR_COLONNE_PROJET = 240;
const LIGNES_MINIMUM = 100;
const deuxChiffres = (n) => String(n).padStart(2, '0');

function couleur(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { red: (n >> 16 & 255) / 255, green: (n >> 8 & 255) / 255, blue: (n & 255) / 255 };
}

const plage = (sheetId, ligneDe, ligneA, colDe, colA) => ({
  sheetId, startRowIndex: ligneDe - 1, endRowIndex: ligneA, startColumnIndex: colDe - 1, endColumnIndex: colA
});
const format = (range, userEnteredFormat, champs) => ({ repeatCell: { range, cell: { userEnteredFormat }, fields: champs } });

/**
 * Demandes à Google pour vider un onglet généré et le mettre en forme (avant d'y écrire les valeurs).
 * existant : { lignes, colonnes, regles } (taille actuelle et nombre de règles conditionnelles de l'onglet).
 */
export function requetesMiseEnForme(sheetId, tableau, existant) {
  const nbLignes = tableau.lignes.length;
  const largeur = tableau.largeur;
  const premiereEnTete = tableau.lignesEnTete[0];
  const r = [
    { updateCells: { range: { sheetId }, fields: 'userEnteredValue,userEnteredFormat' } },
    ...Array.from({ length: existant.regles }, (_, i) => ({ deleteConditionalFormatRule: { sheetId, index: existant.regles - 1 - i } })),
    { updateSheetProperties: {
      properties: { sheetId, gridProperties: {
        rowCount: Math.max(existant.lignes, nbLignes, LIGNES_MINIMUM), columnCount: Math.max(existant.colonnes, largeur),
        frozenRowCount: premiereEnTete, frozenColumnCount: 2 } },
      fields: 'gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)'
    } },
    // Texte brut là où Sheets pourrait « deviner » une date : N° de projet, et lignes d'en-tête (« Novembre 2026 »).
    format(plage(sheetId, 1, nbLignes, 1, 1), { numberFormat: FORMATS.texte }, 'userEnteredFormat.numberFormat'),
    ...tableau.lignesEnTete.map((n) => format(plage(sheetId, n, n, 1, largeur), { numberFormat: FORMATS.texte }, 'userEnteredFormat.numberFormat'))
  ];
  const formatPeriodes = tableau.unite === 'jours' ? FORMATS.jours : FORMATS.dureeSansZero;
  tableau.lignesDuree.forEach((n) => {
    r.push(format(plage(sheetId, n, n, 4, 4), { numberFormat: FORMATS.duree }, 'userEnteredFormat.numberFormat'));
    r.push(format(plage(sheetId, n, n, 5, 5), { numberFormat: FORMATS.jours }, 'userEnteredFormat.numberFormat'));
    if (largeur > COLONNES_FIXES) {
      r.push(format(plage(sheetId, n, n, COLONNES_FIXES + 1, largeur), { numberFormat: formatPeriodes }, 'userEnteredFormat.numberFormat'));
    }
  });
  tableau.colonnesGrisees.forEach((c) => {
    r.push(format(plage(sheetId, premiereEnTete, nbLignes, c, c), { backgroundColor: couleur(COULEURS.weekEnd) }, 'userEnteredFormat.backgroundColor'));
  });
  r.push(format(plage(sheetId, 1, 1, 1, 1), { textFormat: { bold: true, fontSize: 14 } }, 'userEnteredFormat.textFormat(bold,fontSize)'));
  tableau.lignesEnTete.forEach((n) => r.push(format(plage(sheetId, n, n, 1, largeur),
    { textFormat: { bold: true }, backgroundColor: couleur(COULEURS.enTete) }, 'userEnteredFormat(textFormat.bold,backgroundColor)')));
  tableau.lignesSection.forEach((n) => r.push(format(plage(sheetId, n, n, 1, largeur),
    { textFormat: { bold: true, foregroundColor: couleur(COULEURS.section) } }, 'userEnteredFormat.textFormat(bold,foregroundColor)')));
  tableau.lignesTotal.forEach((n) => r.push(format(plage(sheetId, n, n, 1, largeur), { textFormat: { bold: true } }, 'userEnteredFormat.textFormat.bold')));
  r.push(format(plage(sheetId, 1, nbLignes, 4, largeur), { horizontalAlignment: 'RIGHT' }, 'userEnteredFormat.horizontalAlignment'));
  if (tableau.ligneAuDela) {
    r.push({ addConditionalFormatRule: { index: 0, rule: {
      ranges: [plage(sheetId, tableau.ligneAuDela, tableau.ligneAuDela, 4, largeur)],
      booleanRule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: SEUIL_DEPASSEMENT }] },
        format: { textFormat: { foregroundColor: couleur(COULEURS.depassement) } } }
    } } });
  }
  r.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
    properties: { pixelSize: LARGEUR_COLONNE_PROJET }, fields: 'pixelSize' } });
  return r;
}

/**
 * Vrai si la cellule A1 d'un onglet existant montre qu'il a été généré par l'appli (ou s'il est vide).
 */
export function estOngletGenere(a1) {
  const titre = String(a1 ?? '').trim();
  return !titre || TITRES_GENERES.some((debut) => titre.startsWith(debut));
}

/**
 * Totaux par mois pour « mes totaux » (membre d'équipe) : [[mois, N°, nom, minutes]], projets seulement.
 */
export function lignesMesTotaux({ saisies, projets, temps, dateDebut, aujourdhui }) {
  const mois = [...new Set(saisies.map((s) => s.date.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  return mois.flatMap((m) => {
    const recap = construireRecap({ saisies, projets, annee: Number(m.slice(0, 4)), mois: Number(m.slice(5, 7)),
      dateLimite: dateLimitePour(m, aujourdhui), dateDebut, temps });
    return recap.projets.filter((p) => p.minutes > 0).map((p) => [m, p.code, p.nom, String(p.minutes)]);
  });
}

function genereLe(maintenant) {
  return t('sheet.genereLe', {
    date: `${deuxChiffres(maintenant.getDate())}/${deuxChiffres(maintenant.getMonth() + 1)}/${maintenant.getFullYear()}`,
    heure: `${deuxChiffres(maintenant.getHours())}:${deuxChiffres(maintenant.getMinutes())}`
  });
}

/**
 * Les onglets à écrire pour le mois affiché "2026-11" : [{ nom, tableau }] (mois de l'année, puis le récap annuel).
 */
export function ongletsAEcrire({ moisAffiche, sheet, aujourdhui, maintenant }) {
  const annee = Number(moisAffiche.slice(0, 4));
  const { reglages, projets } = sheet;
  const temps = reglages.tempsDeTravail;
  const dateDebut = reglages.debutSuivi;
  const saisies = sheet.saisies.filter((s) => s.date.startsWith(`${annee}-`) && (!dateDebut || s.date >= dateDebut));
  const moisAvecSaisies = [...new Set(saisies.map((s) => Number(s.date.slice(5, 7))))];
  const cats = categories(reglages);
  const sousTitre = genereLe(maintenant);
  const onglets = moisAExporter(annee, moisAvecSaisies, moisAffiche, aujourdhui).map((m) => {
    const mois = Number(m.slice(5, 7));
    return { nom: nomDuMois(mois, annee), mois: m, tableau: construireTableauMois({
      annee, mois, saisies, projets, temps, dateDebut, dateLimite: dateLimitePour(m, aujourdhui), genereLe: sousTitre, categories: cats
    }) };
  });
  const moisAnnuel = moisDuRecapAnnuel(annee, moisAvecSaisies, aujourdhui);
  if (moisAnnuel.length) {
    onglets.push({ nom: `${t('sheet.titreAnnuel')} ${annee}`, annuel: true, tableau: construireTableauAnnuel({
      annee, mois: moisAnnuel, saisies, projets, temps, dateDebut, aujourdhui, genereLe: sousTitre, categories: cats
    }) });
  }
  return onglets;
}
