// Lecture et écriture des données de la personne : son Google Sheet Hours et son Agenda principal.
// Chaque écriture part d'une lecture fraîche du Sheet (l'appli actuelle peut l'avoir modifié entre-temps).
import { lireGoogle, ecrireGoogle } from './google.js';
import { t } from './textes.js';
import { interpreterReglages, lireProjets, lireSaisies, CODES } from './regles.js';
import { evenementDepuisApi, creneauxDuJour, resumeSemaine, joursDeLaSemaine, ajouterJours } from './semaine.js';
import { planSynchroSemaine, planAttribution, verifierChoix, horodatage } from './ecriture.js';
import { planCreation, planStatut, planRenommageProjet, planSuppressionProjet, categories } from './projets.js';
import { dateTexte } from './semaine.js';
import { construireRecap, dateLimitePour } from './recap.js';
import { ONGLET_CHARGE, INTITULES_PAR_DEFAUT, lireIntitulesCharge, lireTableauCharge, zonesDuMois, zonesParDefaut, verifierZones, grilleCharge, moisSuivant } from './charge.js';
import { nouveauClasseur, problemeStructure, EN_TETES } from './classeur.js';
import { ONGLETS } from './schema.js';
import { verifierReglages, planReglages } from './reglages-edition.js';
import { ongletsAEcrire, requetesMiseEnForme, estOngletGenere } from './export-sheet.js';
import { planAjoutManuel, planRenommage, planSuppression, verifierSansChevauchement } from './manuels.js';

const API_SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const API_AGENDA = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const plage = (onglet, cases) => `'${onglet.replace(/'/g, "''")}'!${cases}`;
const PLAGES = [plage(ONGLETS.REGLAGES, 'A1:B'), plage(ONGLETS.PROJETS, 'A2:E'), plage(ONGLETS.SAISIES, 'A2:K')];
const ONGLET_SAISIES = ONGLETS.SAISIES;
const COLONNE_CODE = 'F';
const COLONNE_MODIFIE = 'K';
const CHAMPS_EVENEMENTS = 'nextPageToken,items(iCalUID,status,summary,start,end,attendees(self,responseStatus))';
const MAX_PAGES_AGENDA = 10;

const urlClasseur = (idSheet) => `${API_SHEETS}/${encodeURIComponent(idSheet)}`;
const urlSheet = (idSheet, suite) => `${urlClasseur(idSheet)}/${suite}`;

/**
 * Accès Google réels. La démo fournit les mêmes fonctions, en mémoire.
 */
export const sourceGoogle = {
  /** Le Sheet Hours : { reglages, projets, saisies }, les trois onglets en un seul appel. */
  async lireSheet(idSheet) {
    const parametres = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
    PLAGES.forEach((plage) => parametres.append('ranges', plage));
    const reponse = await lireGoogle(urlSheet(idSheet, `values:batchGet?${parametres}`));
    const [reglages, projets, saisies] = (reponse.valueRanges || []).map((plage) => plage.values || []);
    return { reglages: interpreterReglages(reglages), projets: lireProjets(projets), saisies: lireSaisies(saisies) };
  },

  /** Événements de l'Agenda principal entre deux dates (fin exclue), répétitions dépliées. */
  async lireEvenements(debut, finExclue) {
    const evenements = [];
    let page = '';
    for (let i = 0; i < MAX_PAGES_AGENDA; i++) {
      const parametres = new URLSearchParams({
        singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', fields: CHAMPS_EVENEMENTS,
        timeMin: new Date(`${debut}T00:00:00`).toISOString(),
        timeMax: new Date(`${finExclue}T00:00:00`).toISOString()
      });
      if (page) parametres.set('pageToken', page);
      const reponse = await lireGoogle(`${API_AGENDA}?${parametres}`);
      evenements.push(...(reponse.items || []).map(evenementDepuisApi).filter(Boolean));
      page = reponse.nextPageToken || '';
      if (!page) break;
    }
    return evenements;
  },

  /** Lignes ajoutées en bas d'un onglet, valeurs écrites telles quelles (RAW : pas de conversion par Sheets). */
  async ajouterLignes(idSheet, lignes, nomOnglet = ONGLET_SAISIES) {
    if (!lignes.length) return;
    const parametres = new URLSearchParams({ valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
    await ecrireGoogle(urlSheet(idSheet, `values/${encodeURIComponent(plage(nomOnglet, 'A1:A1'))}:append?${parametres}`), 'POST', { values: lignes });
  },

  /** Retire une ligne d'un onglet (vérifiée avant l'appel : créneau manuel, projet sans créneau). */
  async supprimerLigne(idSheet, numeroLigne, nomOnglet = ONGLET_SAISIES) {
    const infos = await lireGoogle(`${urlClasseur(idSheet)}?fields=${encodeURIComponent('sheets.properties(sheetId,title)')}`);
    const onglet = (infos.sheets || []).find((f) => f.properties.title === nomOnglet);
    if (!onglet) throw new Error(t('erreur.ongletIntrouvable', { onglet: nomOnglet }));
    await ecrireGoogle(`${urlClasseur(idSheet)}:batchUpdate`, 'POST', {
      requests: [{ deleteDimension: { range: { sheetId: onglet.properties.sheetId, dimension: 'ROWS',
        startIndex: numeroLigne - 1, endIndex: numeroLigne } } }]
    });
  },

  /** Crée un Google Sheet dans le Drive de la personne ; renvoie { spreadsheetId, sheets }. */
  async creerClasseur(corps) {
    return ecrireGoogle(API_SHEETS, 'POST', corps);
  },

  /** Onglets du classeur : [{ titre, sheetId, lignes, colonnes, regles }] (taille, règles de mise en forme conditionnelle). */
  async lireStructure(idSheet) {
    const champs = 'spreadsheetUrl,properties.title,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),conditionalFormats(ranges))';
    const infos = await lireGoogle(`${urlClasseur(idSheet)}?fields=${encodeURIComponent(champs)}`);
    return {
      lien: infos.spreadsheetUrl,
      titre: infos.properties?.title || '',
      onglets: (infos.sheets || []).map((f) => ({
        titre: f.properties.title, sheetId: f.properties.sheetId,
        lignes: f.properties.gridProperties?.rowCount || 0, colonnes: f.properties.gridProperties?.columnCount || 0,
        regles: (f.conditionalFormats || []).length
      }))
    };
  },

  /** Valeurs affichées de plusieurs plages : [[[…]]] dans l'ordre des plages. */
  async lireValeurs(idSheet, plages) {
    if (!plages.length) return [];
    const parametres = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
    plages.forEach((p) => parametres.append('ranges', p));
    const reponse = await lireGoogle(urlSheet(idSheet, `values:batchGet?${parametres}`));
    return (reponse.valueRanges || []).map((v) => v.values || []);
  },

  /** Changements de structure et de mise en forme (batchUpdate) ; renvoie les réponses de Google. */
  async modifierClasseur(idSheet, requetes) {
    if (!requetes.length) return [];
    const reponse = await ecrireGoogle(`${urlClasseur(idSheet)}:batchUpdate`, 'POST', { requests: requetes });
    return reponse.replies || [];
  },

  /** Valeurs « comme tapées » (les formules =SUM(…) sont calculées par Sheets). */
  async ecrireFormules(idSheet, modifications) {
    if (!modifications.length) return;
    await ecrireGoogle(urlSheet(idSheet, 'values:batchUpdate'), 'POST', {
      valueInputOption: 'USER_ENTERED',
      data: modifications.map(({ plage, valeurs }) => ({ range: plage, values: valeurs }))
    });
  },

  /** Vide des plages (contenu seulement). */
  async viderPlages(idSheet, plages) {
    if (!plages.length) return;
    await ecrireGoogle(urlSheet(idSheet, 'values:batchClear'), 'POST', { ranges: plages });
  },

  /** Plusieurs plages modifiées en un seul appel : [{ plage: "'Saisies'!F7", valeurs: [[…]] }]. */
  async modifierPlages(idSheet, modifications) {
    if (!modifications.length) return;
    await ecrireGoogle(urlSheet(idSheet, 'values:batchUpdate'), 'POST', {
      valueInputOption: 'RAW',
      data: modifications.map(({ plage, valeurs }) => ({ range: plage, values: valeurs }))
    });
  }
};

function construireJours(lundi, sheet, evenements) {
  const temps = sheet.reglages.tempsDeTravail;
  return joursDeLaSemaine(lundi).map((date) => ({
    date,
    creneaux: creneauxDuJour(date, evenements, sheet.saisies, sheet.projets, temps)
  }));
}

/**
 * Tout ce qu'il faut pour l'écran Semaine. Les jours passés et aujourd'hui sont d'abord synchronisés
 * dans Saisies (comme à l'ouverture d'un jour dans l'appli actuelle), puis relus.
 */
export async function chargerSemaine({ lundi, idSheet, aujourdhui, source = sourceGoogle }) {
  const evenements = await source.lireEvenements(lundi, ajouterJours(lundi, 7));
  let sheet = await source.lireSheet(idSheet);
  const plan = planSynchroSemaine({
    jours: construireJours(lundi, sheet, evenements), saisies: sheet.saisies, aujourdhui,
    debutSuivi: sheet.reglages.debutSuivi, maintenant: horodatage(new Date()), nouvelId: () => crypto.randomUUID()
  });
  if (plan.ajouts.length || plan.ignores.length) {
    const maintenant = horodatage(new Date());
    await source.modifierPlages(idSheet, plan.ignores.flatMap((ligne) => [
      { plage: plage(ONGLET_SAISIES, `${COLONNE_CODE}${ligne}`), valeurs: [[CODES.IGNORE]] },
      { plage: plage(ONGLET_SAISIES, `${COLONNE_MODIFIE}${ligne}`), valeurs: [[maintenant]] }
    ]));
    await source.ajouterLignes(idSheet, plan.ajouts);
    sheet = await source.lireSheet(idSheet);
  }
  const jours = construireJours(lundi, sheet, evenements);
  return {
    reglages: sheet.reglages, projets: sheet.projets, jours,
    resume: resumeSemaine(jours, sheet.reglages.tempsDeTravail),
    synchro: { ajoutes: plan.ajouts.length, ignores: plan.ignores.length }
  };
}

const nouvelId = () => crypto.randomUUID();
const ligneEntries = (numero) => plage(ONGLET_SAISIES, `A${numero}:K${numero}`);

/**
 * Attribue un créneau à un choix (projet, Pause, Ignoré…) : relit le Sheet, vérifie, puis écrit une seule ligne.
 * creneauxDuJour : sert à refuser qu'un créneau manuel compté en chevauche un autre.
 */
export async function attribuer({ idSheet, date, creneau, choix, creneauxDuJour = [], source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  verifierChoix(choix, sheet.projets);
  if (creneau.manuel) {
    const debut = Number(creneau.debut.slice(0, 2)) * 60 + Number(creneau.debut.slice(3, 5));
    verifierSansChevauchement(creneauxDuJour, debut, debut + creneau.minutes, creneau.id, choix);
  }
  const plan = planAttribution({
    date, creneau, choix, saisies: sheet.saisies, maintenant: horodatage(new Date()), nouvelId
  });
  if (plan.numeroLigne) {
    await source.modifierPlages(idSheet, [{ plage: ligneEntries(plan.numeroLigne), valeurs: [plan.ligne] }]);
  } else {
    await source.ajouterLignes(idSheet, [plan.ligne]);
  }
}

/**
 * Ajoute un créneau à la main (relit le Sheet pour vérifier le choix). Renvoie la ligne écrite.
 */
export async function ajouterManuel({ idSheet, date, debut, fin, titre, choix, creneauxDuJour, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  verifierChoix(choix, sheet.projets);
  const ligne = planAjoutManuel({ date, debut, fin, titre, choix, creneauxDuJour, maintenant: horodatage(new Date()), nouvelId });
  await source.ajouterLignes(idSheet, [ligne]);
  return ligne;
}

/**
 * Renomme un créneau ajouté à la main (horaires et projet ne bougent pas).
 */
export async function renommerManuel({ idSheet, date, id, titre, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  const plan = planRenommage({ date, id, titre, saisies: sheet.saisies, maintenant: horodatage(new Date()) });
  await source.modifierPlages(idSheet, [{ plage: ligneEntries(plan.numeroLigne), valeurs: [plan.ligne] }]);
  return plan.ligne[8];
}

/**
 * Supprime un créneau ajouté à la main. Les lignes venant de l'Agenda ne sont jamais supprimées.
 */
export async function supprimerManuel({ idSheet, date, id, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  await source.supprimerLigne(idSheet, planSuppression({ date, id, saisies: sheet.saisies }));
}

// ---------- Projets ----------

const ONGLET_PROJETS = ONGLETS.PROJETS;

/**
 * Crée un projet actif en bas de l'onglet Projets (relit le Sheet : un N° ne sert jamais deux fois).
 */
export async function creerProjet({ idSheet, code, nom, type, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  const ligne = planCreation({ code, nom, type, projets: sheet.projets, categories: categories(sheet.reglages), aujourdhui: dateTexte(new Date()) });
  await source.ajouterLignes(idSheet, [ligne], ONGLET_PROJETS);
  return ligne[0];
}

export async function changerStatutProjet({ idSheet, code, statut, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  const { plage, valeur } = planStatut({ code, statut, projets: sheet.projets });
  await source.modifierPlages(idSheet, [{ plage, valeurs: [[valeur]] }]);
}

export async function renommerProjet({ idSheet, code, nom, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  const { plage, valeur } = planRenommageProjet({ code, nom, projets: sheet.projets });
  await source.modifierPlages(idSheet, [{ plage, valeurs: [[valeur]] }]);
}

export async function supprimerProjet({ idSheet, code, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  const numeroLigne = planSuppressionProjet({ code, projets: sheet.projets, saisies: sheet.saisies });
  await source.supprimerLigne(idSheet, numeroLigne, ONGLET_PROJETS);
}

// ---------- Récap ----------

/**
 * Récap d'un mois "2026-11" (mois en cours : arrêté à aujourd'hui), relu dans le Sheet.
 */
export async function chargerRecap({ idSheet, mois, aujourdhui, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  const [annee, numero] = mois.split('-').map(Number);
  return construireRecap({
    saisies: sheet.saisies, projets: sheet.projets, annee, mois: numero,
    dateLimite: dateLimitePour(mois, aujourdhui), dateDebut: sheet.reglages.debutSuivi, temps: sheet.reglages.tempsDeTravail
  });
}

// ---------- Mise à jour du Google Sheet ----------

const nomPlage = (onglet, plage) => `'${onglet.replace(/'/g, "''")}'!${plage}`;

/**
 * Réécrit les onglets générés (mois de l'année + récap annuel).
 * Dans le doute (un onglet du même nom fait à la main), rien n'est écrit : on signale.
 * Renvoie { nombreMois, nomAnnuel, lien, equipe, equipeErreur }.
 */
export async function exporterSheet({ idSheet, moisAffiche, aujourdhui, source = sourceGoogle }) {
  const sheet = await source.lireSheet(idSheet);
  const onglets = ongletsAEcrire({ moisAffiche, sheet, aujourdhui, maintenant: new Date() });
  let structure = await source.lireStructure(idSheet);
  const existants = new Map(structure.onglets.map((o) => [o.titre, o]));

  // 1. Vérifier, avant toute écriture, que les onglets existants ont bien été créés par l'appli.
  const aVerifier = onglets.filter((o) => existants.has(o.nom));
  const titres = await source.lireValeurs(idSheet, aVerifier.map((o) => nomPlage(o.nom, 'A1')));
  aVerifier.forEach((o, i) => {
    if (!estOngletGenere(titres[i]?.[0]?.[0])) throw new Error(t('sheet.pasGenere', { onglet: o.nom }));
  });

  // 2. Créer les onglets qui manquent, puis relire leurs identifiants.
  const manquants = onglets.filter((o) => !existants.has(o.nom));
  if (manquants.length) {
    await source.modifierClasseur(idSheet, manquants.map((o) => ({ addSheet: { properties: { title: o.nom } } })));
    structure = await source.lireStructure(idSheet);
  }
  const parTitre = new Map(structure.onglets.map((o) => [o.titre, o]));

  // 3. Vider et mettre en forme, puis 4. écrire les valeurs.
  await source.modifierClasseur(idSheet, onglets.flatMap((o) => {
    const existant = parTitre.get(o.nom);
    return requetesMiseEnForme(existant.sheetId, o.tableau, existant);
  }));
  await source.ecrireFormules(idSheet, onglets.map((o) => ({ plage: nomPlage(o.nom, 'A1'), valeurs: o.tableau.lignes })));

  const affiche = onglets.find((o) => o.mois === moisAffiche);
  const resultat = {
    nombreMois: onglets.filter((o) => !o.annuel).length,
    nomOnglet: affiche?.nom || '',
    nomAnnuel: onglets.find((o) => o.annuel)?.nom || '',
    lien: affiche ? `${structure.lien}#gid=${parTitre.get(affiche.nom).sheetId}` : structure.lien,
    equipe: false,
    equipeErreur: ''
  };

  return resultat;
}

// ---------- Charge ----------

const PLAGE_CHARGE = `'${ONGLET_CHARGE}'!A1:ZZ`;
const intitulesCharge = (reglages) => lireIntitulesCharge(reglages.intitulesChargeTexte) || INTITULES_PAR_DEFAUT;

async function lireCharge(idSheet, source) {
  const [sheet, structure] = await Promise.all([source.lireSheet(idSheet), source.lireStructure(idSheet)]);
  const existe = structure.onglets.some((o) => o.titre === ONGLET_CHARGE);
  const [grille] = existe ? await source.lireValeurs(idSheet, [PLAGE_CHARGE]) : [[]];
  const intitules = intitulesCharge(sheet.reglages);
  return { intitules, tableau: lireTableauCharge(grille || [], intitules), existe };
}

/**
 * La charge d'un mois "2026-11" : { zones, enregistree, intitules, suivanteExiste }.
 * Mois sans charge : 3 zones vides (rien n'est écrit tant qu'on n'enregistre pas).
 */
export async function chargerCharge({ idSheet, mois, source = sourceGoogle }) {
  const { intitules, tableau } = await lireCharge(idSheet, source);
  const zones = zonesDuMois(tableau, mois, intitules);
  return {
    mois, intitules, enregistree: zones.length > 0,
    zones: zones.length ? zones : zonesParDefaut(intitules),
    suivanteExiste: zonesDuMois(tableau, moisSuivant(mois), intitules).length > 0
  };
}

async function ecrireCharge(idSheet, source, lecture, mois, zones) {
  const grille = grilleCharge(lecture.tableau, mois, zones, horodatage(new Date()).slice(0, 16));
  if (!lecture.existe) await source.modifierClasseur(idSheet, [{ addSheet: { properties: { title: ONGLET_CHARGE } } }]);
  await source.viderPlages(idSheet, [PLAGE_CHARGE]);
  await source.modifierPlages(idSheet, [{ plage: `'${ONGLET_CHARGE}'!A1`, valeurs: grille }]);
}

/**
 * Remplace la charge du mois par ces zones [{ categorie, elements }] (relit d'abord l'onglet).
 */
export async function enregistrerCharge({ idSheet, mois, zones, source = sourceGoogle }) {
  const lecture = await lireCharge(idSheet, source);
  await ecrireCharge(idSheet, source, lecture, mois, verifierZones(zones, lecture.intitules));
}

/**
 * Copie la charge du mois vers le suivant. Mois suivant déjà rempli : rien n'est écrasé sans « ecraser ».
 */
export async function dupliquerCharge({ idSheet, mois, ecraser, source = sourceGoogle }) {
  const lecture = await lireCharge(idSheet, source);
  const cible = moisSuivant(mois);
  if (!ecraser && zonesDuMois(lecture.tableau, cible, lecture.intitules).length) return { duplique: false, cibleExiste: true, cible };
  const zones = zonesDuMois(lecture.tableau, mois, lecture.intitules);
  await ecrireCharge(idSheet, source, lecture, cible, zones.length ? zones : zonesParDefaut(lecture.intitules));
  return { duplique: true, cible };
}

// ---------- Réglages ----------

/**
 * Enregistre les réglages de la personne (relit d'abord l'onglet Réglages) : chaque étiquette est retrouvée
 * par son nom ; une étiquette absente est ajoutée en bas. Le nom du Sheet n'est jamais changé ici.
 */
export async function enregistrerReglages({ idSheet, saisie, source = sourceGoogle }) {
  const propres = verifierReglages(saisie);
  const [lignes] = await source.lireValeurs(idSheet, [plage(ONGLETS.REGLAGES, 'A1:B')]);
  const plan = planReglages(lignes || [], propres);
  if (plan.modifications.length) await source.modifierPlages(idSheet, plan.modifications);
  if (plan.ajouts.length) await source.ajouterLignes(idSheet, plan.ajouts, ONGLETS.REGLAGES);
  return { renumerotes: 0 };
}

// ---------- Le Sheet de la personne ----------

/**
 * Nouveau venu : crée son Sheet « Timesheets+ App » (onglets, en-têtes, réglages par défaut), puis pose le format texte
 * sur les colonnes de codes, dates et heures. Renvoie son identifiant.
 */
export async function creerSheet({ aujourdhui, source = sourceGoogle }) {
  const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { colonnesTexte, largeursReglages, ongletReglages, ...corps } = nouveauClasseur({ aujourdhui, fuseau });
  const cree = await source.creerClasseur(corps);
  const idDe = (titre) => cree.sheets.find((f) => f.properties.title === titre).properties.sheetId;
  await source.modifierClasseur(cree.spreadsheetId, [
    ...Object.entries(colonnesTexte).flatMap(([titre, colonnes]) => colonnes.map((c) => ({ repeatCell: {
      range: { sheetId: idDe(titre), startRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } }, fields: 'userEnteredFormat.numberFormat'
    } }))),
    ...largeursReglages.map((largeur, c) => ({ updateDimensionProperties: {
      range: { sheetId: idDe(ONGLETS.REGLAGES), dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
      properties: { pixelSize: largeur }, fields: 'pixelSize'
    } }))
  ]);
  return cree.spreadsheetId;
}

/**
 * Sheet existant relié par son lien : vérifie que c'est bien un Sheet Timesheets+ (onglets et en-têtes), sinon erreur.
 */
export async function verifierSheet({ idSheet, source = sourceGoogle }) {
  const structure = await source.lireStructure(idSheet);
  const noms = Object.keys(EN_TETES);
  const presents = noms.filter((nom) => structure.onglets.some((o) => o.titre === nom));
  const lus = await source.lireValeurs(idSheet, presents.map((nom) => plage(nom, 'A1:K1')));
  const enTetes = Object.fromEntries(noms.map((nom) => [nom, presents.includes(nom) ? (lus[presents.indexOf(nom)][0] || []) : null]));
  const probleme = problemeStructure(enTetes);
  if (probleme) throw new Error(probleme);
}
