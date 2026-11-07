// Le Sheet de la personne (même structure que Classeur.gs de Timesheets+) : création pour un nouveau venu
// et vérification d'un Sheet existant relié par son lien. Calculs purs.
import { t } from './textes.js';
import { ONGLETS, EN_TETES as EN_TETES_SHEET, REGLAGES, NOM_NOUVEAU_SHEET } from './schema.js';

// Onglets vérifiés à la liaison d'un Sheet existant (nom de l'onglet → en-têtes attendus).
export const EN_TETES = {
  [ONGLETS.PROJETS]: EN_TETES_SHEET.Projets,
  [ONGLETS.SAISIES]: EN_TETES_SHEET.Saisies
};
// Colonnes gardées en texte brut, pour que Sheets ne transforme pas les codes, dates et heures.
const COLONNES_TEXTE = {
  [ONGLETS.PROJETS]: ['Code'],
  [ONGLETS.SAISIES]: ['Id', 'Date', 'Début', 'Fin', 'Code projet', 'Id événement']
};
const REGLAGES_PAR_DEFAUT = [
  [REGLAGES.emailDestinataire, ''],
  [REGLAGES.prenomDestinataire, ''],
  [REGLAGES.ecritureDocsReels, 'non'],
  [REGLAGES.nomDocs, ''],
  [REGLAGES.posteDocs, ''],
  [REGLAGES.signature, ''],
  [REGLAGES.debutSuivi, ''],
  [REGLAGES.initiales, '']
];
const LIGNES_PREPAREES = 1000;
const LARGEURS_REGLAGES = [180, 280];

const cellule = (texte, gras = false) => ({
  userEnteredValue: { stringValue: texte },
  ...(gras ? { userEnteredFormat: { textFormat: { bold: true } } } : {})
});

function onglet(titre, enTetes, colonnesTexte) {
  return {
    properties: { title: titre, gridProperties: { rowCount: LIGNES_PREPAREES, columnCount: Math.max(enTetes.length, 12), frozenRowCount: 1 } },
    data: [{ startRow: 0, startColumn: 0, rowData: [{ values: enTetes.map((e) => cellule(e, true)) }] }],
    texte: colonnesTexte.map((nom) => enTetes.indexOf(nom))
  };
}

/**
 * Corps de la demande à Google pour créer le Sheet d'un nouveau venu (« Timesheets+ App »).
 * Le suivi commence au 1er du mois de création.
 */
export function nouveauClasseur({ aujourdhui, fuseau }) {
  const reglages = REGLAGES_PAR_DEFAUT.map(([libelle, valeur]) =>
    [libelle, libelle === REGLAGES.debutSuivi ? `${aujourdhui.slice(0, 7)}-01` : valeur]);
  const projets = onglet(ONGLETS.PROJETS, EN_TETES_SHEET.Projets, COLONNES_TEXTE[ONGLETS.PROJETS]);
  const saisies = onglet(ONGLETS.SAISIES, EN_TETES_SHEET.Saisies, COLONNES_TEXTE[ONGLETS.SAISIES]);
  return {
    properties: { title: NOM_NOUVEAU_SHEET, ...(fuseau ? { timeZone: fuseau } : {}) },
    sheets: [projets, saisies, {
      properties: { title: ONGLETS.REGLAGES, gridProperties: { rowCount: LIGNES_PREPAREES, columnCount: 4 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [
        { values: EN_TETES_SHEET.Reglages.map((e) => cellule(e, true)) },
        ...reglages.map(([libelle, valeur]) => ({ values: [cellule(libelle), cellule(valeur)] }))
      ] }]
    }].map(({ texte, ...reste }) => reste),
    colonnesTexte: { [ONGLETS.PROJETS]: projets.texte, [ONGLETS.SAISIES]: saisies.texte },
    largeursReglages: LARGEURS_REGLAGES,
    ongletReglages: ONGLETS.REGLAGES
  };
}

/**
 * En-têtes lus (ligne 1 des onglets Projets et Saisies, null si absent) → message si ce n'est pas un Sheet Timesheets+, sinon ''.
 * Les en-têtes sont comparés sans tenir compte des majuscules, accents et espaces en trop.
 */
export function problemeStructure(enTetes) {
  const propre = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [nom, attendus] of Object.entries(EN_TETES)) {
    const trouves = enTetes[nom];
    if (!trouves) return t('sheet.erreur.absent', { onglet: nom });
    if (trouves.slice(0, attendus.length).map(propre).join('|') !== attendus.map(propre).join('|')) {
      return t('sheet.erreur.enTetes', { onglet: nom });
    }
  }
  return '';
}
