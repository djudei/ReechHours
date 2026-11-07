// Données inventées pour la démonstration (?demo) : même chemin que les vraies données, y compris
// l'écriture, mais tout reste en mémoire dans la page (rien chez Google). Les événements suivent la semaine affichée.
import { interpreterReglages, lireProjets, lireSaisies } from './regles.js';
import { evenementDepuisApi, joursDeLaSemaine } from './semaine.js';
import { ONGLETS, REGLAGES } from './schema.js';

// Projets et personnes inventés (jamais de vraies données dans ce dépôt public).
const PROJETS = [
  ['2014', 'MOREL – site vitrine', 'projet', 'actif', ''],
  ['2009', 'LUMEN – contenus', 'projet', 'actif', ''],
  ['2011', 'VEGA – identité', 'projet', 'actif', ''],
  ['1001', 'Admin, compta', 'interne', 'actif', '']
];

// [jour de la semaine (0 = lundi), début, fin, titre]
const AGENDA = [
  [0, '09:00', '13:00', 'MOREL | maquettes'], [0, '14:00', '16:00', 'LUMEN | contenus'], [0, '16:00', '17:00', 'Admin | factures'],
  [1, '09:00', '10:00', 'Admin | compta'], [1, '10:00', '12:30', 'LUMEN | atelier'], [1, '14:00', '17:00', 'LUMEN | rédaction'],
  [2, '09:30', '12:30', 'MOREL | revue'], [2, '14:00', '16:00', 'Admin | devis'],
  [3, '09:00', '09:30', 'Admin | point équipe'], [3, '09:30', '12:00', 'MOREL | page d’accueil'],
  [3, '12:00', '13:00', 'Déjeuner'], [3, '14:00', '15:00', 'Appel client'], [3, '15:00', '17:30', 'LUMEN | contenus'],
  [3, '17:30', '18:00', 'Relances devis'],
  [4, '10:00', '11:00', 'VEGA | cadrage'], [4, '11:00', '12:00', 'Point hebdo']
];

const COLONNES = 'ABCDEFGHIJK';

function iso(date, heure) {
  return new Date(`${date}T${heure}:00`).toISOString();
}

export function sourceDemo() {
  // Les onglets de la démo, à partir de la ligne 2.
  let onglets = {
    [ONGLETS.SAISIES]: [],
    [ONGLETS.PROJETS]: PROJETS.map((ligne) => [...ligne]),
    // Réglages : à partir de la ligne 2, comme les autres (la ligne 1 « Réglage | Valeur » est ajoutée à la lecture).
    [ONGLETS.REGLAGES]: [[REGLAGES.nomDocs, 'Camille D'], [REGLAGES.initiales, 'CD'], [REGLAGES.posteDocs, 'Chef de projet'],
      [REGLAGES.debutSuivi, '2026-01-01']]
  };
  let generes = {};

  return {
    async lireSheet() {
      return {
        reglages: interpreterReglages(onglets[ONGLETS.REGLAGES]),
        projets: lireProjets(onglets[ONGLETS.PROJETS]),
        saisies: lireSaisies(onglets[ONGLETS.SAISIES])
      };
    },
    async lireEvenements(debut) {
      const jours = joursDeLaSemaine(debut);
      return AGENDA.map(([jour, de, a, titre]) => evenementDepuisApi({
        iCalUID: `demo-${jour}-${de}@reechhours`, summary: titre,
        start: { dateTime: iso(jours[jour], de) }, end: { dateTime: iso(jours[jour], a) }
      }));
    },
    async ajouterLignes(_, nouvelles, onglet = ONGLETS.SAISIES) {
      onglets = { ...onglets, [onglet]: [...onglets[onglet], ...nouvelles.map((l) => [...l])] };
    },
    async supprimerLigne(_, numeroLigne, onglet = ONGLETS.SAISIES) {
      onglets = { ...onglets, [onglet]: onglets[onglet].filter((__, i) => i !== numeroLigne - 2) };
    },
    // Onglets générés (mise à jour du Google Sheet) : gardés en mémoire, pour voir le parcours sans Google.
    async lireStructure() {
      const titres = [ONGLETS.PROJETS, ONGLETS.SAISIES, ONGLETS.REGLAGES, ...Object.keys(generes)];
      return { lien: '#', titre: 'Timesheets+ App', onglets: titres.map((titre, i) => ({ titre, sheetId: i, lignes: 1000, colonnes: 26, regles: 0 })) };
    },
    async lireValeurs(_, plages) {
      return plages.map((p) => {
        const nom = /^'?([^'!]+)'?!/.exec(p)?.[1];
        if (onglets[nom]) return [['Réglage', 'Valeur'], ...onglets[nom]];
        const contenu = generes[nom] || [];
        return /!A1$/.test(p) ? [[contenu[0]?.[0] ?? '']] : contenu;
      });
    },
    async modifierClasseur(_, requetes) {
      requetes.filter((r) => r.addSheet).forEach((r) => { generes = { ...generes, [r.addSheet.properties.title]: [] }; });
      return [];
    },
    async ecrireFormules(_, modifications) {
      modifications.forEach(({ plage, valeurs }) => { generes = { ...generes, [/^'(.+)'!/.exec(plage)[1]]: valeurs }; });
    },
    async viderPlages() {},
    async modifierPlages(_, modifications) {
      // Onglet entier écrit depuis A1 (Charge) : remplacé tel quel.
      const entiers = modifications.filter((m) => /^'(.+)'!A1$/.test(m.plage));
      entiers.forEach(({ plage, valeurs }) => { generes = { ...generes, [/^'(.+)'!/.exec(plage)[1]]: valeurs }; });
      const autres = modifications.filter((m) => !entiers.includes(m));
      onglets = autres.reduce((courants, { plage, valeurs }) => {
        const [, onglet, colonne, numero] = /^'?([^'!]+)'?!([A-K])(\d+)/.exec(plage);
        const index = Number(numero) - 2;
        const debut = COLONNES.indexOf(colonne);
        const remplir = (ligne) => Array.from({ length: Math.max(ligne.length, debut + valeurs[0].length) },
          (__, c) => (c >= debut && c < debut + valeurs[0].length ? valeurs[0][c - debut] : ligne[c] ?? ''));
        return { ...courants, [onglet]: courants[onglet].map((ligne, i) => (i !== index ? ligne : remplir(ligne))) };
      }, onglets);
    }
  };
}
