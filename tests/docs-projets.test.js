// Docs projets (onglet TIMESHEET) : mêmes règles que Docs.gs de Timesheets+, sur un modèle inventé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDoc, trimestreDe, idDepuisLien, lettre, nombreDe, ecritureAutorisee, STATUTS } from '../js/docs-projets.js';
import { simulerDocs, ecrireDocs } from '../js/donnees.js';
import { interpreterReglages, lireProjets, lireSaisies } from '../js/regles.js';

// Modèle TIMESHEET inventé : titre, en-têtes trimestres en ligne 3, sections par poste, lignes libres, total.
const modele = () => [
  ['Projet ALPHA'],
  [],
  ['Profil', 'Taux', 'T3 2026', 'T4 2026', 'Total'],
  ['Directeur conseil'],
  ['Sam B', '', '1,5', '2', '3,5'],
  ['Account manager'],
  ['Julien', '', '', '', ''],
  ['Prénom - à compléter', '', '', '', ''],
  ['Chef de projet'],
  ['Camille D', '', '0,5', '3,25', '3,75'],
  ['Prénom - à compléter', '', '', '', ''],
  ['Global TH', '', '2', '5,25', '7,25']
];
const camille = { nomDocs: 'Camille D', posteDocs: 'Chef de projet', postes: [] };

test('outils : trimestre civil, id d\'un lien, lettres de colonne, nombres « à la française », interrupteur TEST', () => {
  assert.deepEqual(trimestreDe('2026-11'), { nom: 'T4 2026', mois: ['2026-10', '2026-11', '2026-12'] });
  assert.equal(trimestreDe('2026-01').nom, 'T1 2026');
  assert.equal(idDepuisLien('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit?gid=1#gid=1'), '1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  assert.equal(idDepuisLien('https://exemple.fr'), '');
  assert.deepEqual([lettre(0), lettre(3), lettre(26), lettre(27)], ['A', 'D', 'AA', 'AB']);
  assert.deepEqual([nombreDe('3,25'), nombreDe(''), nombreDe('2'), nombreDe('2 j')], [3.25, 0, 2, null]);
  assert.equal(ecritureAutorisee('TEST Alpha', false), true);
  assert.equal(ecritureAutorisee('Alpha', false), false);
  assert.equal(ecritureAutorisee('Alpha', true), true);
});

test('nom trouvé : la valeur est REMPLACÉE (jamais additionnée), arrondie à 2 décimales ; identique → déjà à jour', () => {
  const p = planDoc({ grille: modele(), personne: camille, trimestre: 'T4 2026', jours: 4.123 });
  assert.equal(p.statut, STATUTS.ECRIRE);
  assert.deepEqual([p.ligne, p.colonne, p.valeurDoc, p.valeur, p.renommer], [10, 'D', 3.25, 4.12, false]);
  assert.deepEqual(p.modifications, [{ plage: 'D10', valeurs: [[4.12]] }]);
  assert.equal(planDoc({ grille: modele(), personne: camille, trimestre: 'T4 2026', jours: 3.25 }).statut, STATUTS.A_JOUR);
  assert.equal(planDoc({ grille: modele(), personne: { ...camille, nomDocs: '  camille   d ' }, trimestre: 'T4 2026', jours: 4 }).ligne, 10);
});

test('doc plus grand que le calcul → conflit (rien d\'écrit sans choix)', () => {
  const p = planDoc({ grille: modele(), personne: camille, trimestre: 'T4 2026', jours: 3 });
  assert.equal(p.statut, STATUTS.CONFLIT);
  assert.deepEqual([p.valeurDoc, p.valeur], [3.25, 3]);
});

test('nom absent : première ligne « Prénom - à compléter » sous le poste, renommée ; jamais dans une autre section', () => {
  const p = planDoc({ grille: modele(), personne: { nomDocs: 'Alix R', posteDocs: 'Chef de projet', postes: [] }, trimestre: 'T4 2026', jours: 1 });
  assert.equal(p.statut, STATUTS.ECRIRE);
  assert.deepEqual(p.modifications, [{ plage: 'A11', valeurs: [['Alix R']] }, { plage: 'D11', valeurs: [[1]] }]);
  const g = modele(); g[10][0] = 'Lou P';   // plus de ligne libre sous Chef de projet
  assert.equal(planDoc({ grille: g, personne: { nomDocs: 'Alix R', posteDocs: 'Chef de projet', postes: [] }, trimestre: 'T4 2026', jours: 1 }).raison, 'pasDeLigneLibre');
});

test('doutes → anomalie : nom proche, poste absent, colonne absente ou en double, nom en double, case illisible', () => {
  const plan = (grille, personne, trimestre = 'T4 2026') => planDoc({ grille, personne, trimestre, jours: 1 });
  assert.equal(plan(modele(), { nomDocs: 'Julien M', posteDocs: 'Account manager', postes: [] }).raison, 'nomProche');
  assert.equal(plan(modele(), { nomDocs: 'Alix R', posteDocs: 'Stagiaire', postes: [] }).raison, 'posteAbsent');
  assert.equal(plan(modele(), camille, 'T1 2027').raison, 'colonne');
  const double = modele(); double[2].push('T4 2026');
  assert.equal(plan(double, camille).raison, 'colonneDouble');
  const deuxFois = modele(); deuxFois.splice(11, 0, ['Camille D', '', '', '1', '']);
  assert.equal(plan(deuxFois, camille).raison, 'nomDouble');
  const illisible = modele(); illisible[9][3] = 'voir Paul';
  assert.equal(plan(illisible, camille).raison, 'caseIllisible');
});

// Simulation puis écriture, avec une source inventée (aucun appel à Google).
function sourceFausse({ ecritureDocsReels = 'non', titre = 'TEST ALPHA' } = {}) {
  const ecrit = [];
  const lien = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit';
  return {
    ecrit,
    async lireSheet() {
      return {
        reglages: interpreterReglages([['Nom dans les docs', 'Camille D'], ['Poste dans les docs', 'Chef de projet'], ['Écriture docs réels', ecritureDocsReels]]),
        projets: lireProjets([['2116', 'ALPHA', 'projet', 'actif', lien], ['2009', 'BETA', 'projet', 'actif', ''], ['2010', 'GAMMA', 'projet', 'actif', 'pas un lien']]),
        saisies: lireSaisies([
          ['a', '2026-10-05', '09:00', '16:00', '420', '2116', 'manuel', '', '', 'non', ''],
          ['b', '2026-11-03', '09:00', '12:30', '1050', '2116', 'manuel', '', '', 'non', ''],
          ['c', '2026-11-03', '14:00', '15:00', '60', '2009', 'manuel', '', '', 'non', ''],
          ['d', '2026-11-04', '14:00', '15:00', '60', '2010', 'manuel', '', '', 'non', '']
        ])
      };
    },
    async lireStructure() { return { titre, onglets: [{ titre: 'Timesheet ' }] }; },
    async lireValeurs() { return [modele()]; },
    async modifierPlages(id, modifications) { ecrit.push({ id, modifications }); }
  };
}

test('simulation : jours du trimestre (oct. + nov.), projet sans lien ignoré, lien illisible signalé ; rien n\'est écrit', async () => {
  const source = sourceFausse();
  const s = await simulerDocs({ idSheet: 'x', mois: '2026-11', aujourdhui: '2026-11-16', source });
  assert.equal(s.trimestre, 'T4 2026');
  assert.deepEqual(s.lignes.map((l) => [l.code, l.statut, l.raison || '', l.valeur || 0]),
    [['2116', 'ecrire', '', 3.5], ['2010', 'anomalie', 'lien', 0.14]]);
  assert.equal(source.ecrit.length, 0);
});

test('écriture : seulement les docs « TEST » tant que l\'interrupteur est coupé ; plage avec le nom réel de l\'onglet', async () => {
  const source = sourceFausse();
  const r = await ecrireDocs({ idSheet: 'x', mois: '2026-11', aujourdhui: '2026-11-16', source });
  assert.equal(r.lignes[0].statut, 'ecrit');
  assert.deepEqual(source.ecrit, [{ id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', modifications: [{ plage: "'Timesheet '!D10", valeurs: [[3.5]] }] }]);
  const vrai = sourceFausse({ titre: 'ALPHA 2026' });
  const r2 = await ecrireDocs({ idSheet: 'x', mois: '2026-11', aujourdhui: '2026-11-16', source: vrai });
  assert.equal(r2.lignes[0].statut, 'ignore');
  assert.equal(vrai.ecrit.length, 0);
  const ouvert = sourceFausse({ titre: 'ALPHA 2026', ecritureDocsReels: 'oui' });
  await ecrireDocs({ idSheet: 'x', mois: '2026-11', aujourdhui: '2026-11-16', source: ouvert });
  assert.equal(ouvert.ecrit.length, 1);
});

test('conflit : rien n\'est écrit par défaut ; « Remplacer » choisi → écrit', async () => {
  const source = sourceFausse();
  const lire = source.lireSheet.bind(source);
  source.lireSheet = async () => {
    const s = await lire();
    s.saisies = s.saisies.filter((x) => x.id !== 'b');   // 1 j calculé, le doc dit 3,25 j
    return s;
  };
  const r = await ecrireDocs({ idSheet: 'x', mois: '2026-11', aujourdhui: '2026-11-16', source });
  assert.equal(r.lignes[0].statut, 'conflit');
  assert.equal(source.ecrit.length, 0);
  await ecrireDocs({ idSheet: 'x', mois: '2026-11', aujourdhui: '2026-11-16', remplacer: ['2116'], source });
  assert.deepEqual(source.ecrit[0].modifications, [{ plage: "'Timesheet '!D10", valeurs: [[1]] }]);
});
