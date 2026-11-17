// Sheet d'un nouveau venu : même structure que Classeur.gs de Timesheets+ (onglets, en-têtes, réglages par défaut) ;
// Sheet existant relié par son lien : on vérifie que c'est bien un Sheet Timesheets+ avant de s'en servir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nouveauClasseur, problemeStructure } from '../js/classeur.js';

const PROJETS = ['Code', 'Nom', 'Type', 'Statut', 'Lien doc'];
const SAISIES = ['Id', 'Date', 'Début', 'Fin', 'Minutes', 'Code projet', 'Source', 'Id événement', 'Titre', 'Attribué auto', 'Modifié le'];

test('nouveau Sheet : « REECH-HOURS », onglets Projets / Saisies / Réglages, suivi au 1er du mois', () => {
  const c = nouveauClasseur({ aujourdhui: '2026-11-06', fuseau: 'Europe/Paris' });
  assert.equal(c.properties.title, 'REECH-HOURS');
  assert.equal(c.properties.timeZone, 'Europe/Paris');
  assert.deepEqual(c.sheets.map((s) => s.properties.title), ['Projets', 'Saisies', 'Réglages']);
  const valeurs = (titre) => c.sheets.find((s) => s.properties.title === titre).data[0].rowData
    .map((ligne) => ligne.values.map((v) => v.userEnteredValue?.stringValue ?? ''));
  assert.deepEqual(valeurs('Projets')[0], PROJETS);
  assert.deepEqual(valeurs('Saisies')[0], SAISIES);
  assert.deepEqual(valeurs('Réglages')[0], ['Réglage', 'Valeur']);
  const reglages = Object.fromEntries(valeurs('Réglages').slice(1));
  assert.equal(reglages['Début du suivi'], '2026-11-01');
  assert.equal(reglages['Écriture docs réels'], 'non');   // jamais d'écriture dans les vrais docs sans le décider
  assert.ok('Nom dans les docs' in reglages);
  const saisies = c.sheets.find((s) => s.properties.title === 'Saisies');
  assert.equal(saisies.properties.gridProperties.frozenRowCount, 1);
});

test('Sheet relié : onglet absent ou autres en-têtes → message ; Sheet Timesheets+ → rien à signaler', () => {
  assert.equal(problemeStructure({ Projets: PROJETS, Saisies: SAISIES }), '');
  assert.equal(problemeStructure({ Projets: ['code', 'Nom ', 'Type', 'Statut', 'Lien doc'], Saisies: SAISIES }), '');   // casse, espaces
  assert.match(problemeStructure({ Projets: null, Saisies: [] }), /Projets/);
  assert.match(problemeStructure({ Projets: PROJETS, Saisies: ['Id', 'Date'] }), /Saisies/);
  // Un Sheet Hours (en anglais) n'est pas un Sheet Timesheets+ : rien n'est écrit dedans.
  assert.match(problemeStructure({ Projets: ['Code', 'Name', 'Type', 'Status'], Saisies: SAISIES }), /Projets/);
});

test('nom du Sheet : REECH-HOURS_<initiales> pour les noms donnés par une appli ; un nom choisi à la main est gardé', async () => {
  const { nomDuSheet } = await import('../js/schema.js');
  assert.equal(nomDuSheet('REECH-HOURS', 'jm'), 'REECH-HOURS_JM');
  assert.equal(nomDuSheet('REECH-HOURS_AB', 'JM'), 'REECH-HOURS_JM');
  assert.equal(nomDuSheet('REECH-HOURS_JM', 'JM'), '');            // déjà bon
  assert.equal(nomDuSheet('REECH_JM_Timesheets+App', 'JM'), 'REECH-HOURS_JM');
  assert.equal(nomDuSheet('JM_Timesheets+App', 'JM'), 'REECH-HOURS_JM');
  assert.equal(nomDuSheet('Timesheets+ App', 'JM'), 'REECH-HOURS_JM');
  assert.equal(nomDuSheet('Mes temps 2026', 'JM'), '');            // nom personnel : intact
  assert.equal(nomDuSheet('REECH-HOURS', ''), '');
});
