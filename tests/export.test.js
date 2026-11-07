// « Mettre à jour mon Google Sheet » : onglets à écrire, protection des onglets faits à la main,
// mise en forme demandée à Google, totaux envoyés à l'équipe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ongletsAEcrire, requetesMiseEnForme, estOngletGenere, lignesMesTotaux } from '../js/export-sheet.js';

const TEMPS = { minutesParJour: 420, jours: [1, 2, 3, 4, 5], avecBase: true, titresConges: [] };
const sheet = {
  reglages: { tempsDeTravail: TEMPS, debutSuivi: '', nomCategorieProjet: '', nomCategorieAutre: '' },
  projets: [{ code: 'A', nom: 'Alpha', type: 'projet', statut: 'actif' }],
  saisies: [
    { date: '2026-09-14', minutes: 120, code: 'A', debut: '09:00' },
    { date: '2026-11-03', minutes: 60, code: 'A', debut: '09:00' },
    { date: '2025-12-01', minutes: 60, code: 'A', debut: '09:00' }
  ]
};

test('onglets à écrire : chaque mois depuis le premier avec des saisies, puis le récap annuel', () => {
  const onglets = ongletsAEcrire({ moisAffiche: '2026-11', sheet, aujourdhui: '2026-11-06', maintenant: new Date(2026, 10, 6, 18, 5) });
  assert.deepEqual(onglets.map((o) => o.nom), ['Septembre 2026', 'Octobre 2026', 'Novembre 2026', 'Récap annuel 2026']);
  assert.equal(onglets[0].tableau.lignes[1][0], 'Généré le 06/11/2026 à 18:05');
});

test('onglet existant : réutilisé seulement s\'il a été généré par l\'appli (A1), ou s\'il est vide', () => {
  assert.equal(estOngletGenere('Temps par jour · Octobre 2026'), true);
  assert.equal(estOngletGenere('Annual summary 2026'), true);
  assert.equal(estOngletGenere(''), true);
  assert.equal(estOngletGenere('Mes temps à moi'), false);
});

test('mise en forme : onglet vidé, anciennes règles retirées, lignes figées, Au-delà en rouge', () => {
  const [onglet] = ongletsAEcrire({ moisAffiche: '2026-11', sheet: { ...sheet, saisies: [sheet.saisies[1]] }, aujourdhui: '2026-11-06', maintenant: new Date() });
  const requetes = requetesMiseEnForme(7, onglet.tableau, { lignes: 1000, colonnes: 26, regles: 2 });
  assert.deepEqual(requetes[0], { updateCells: { range: { sheetId: 7 }, fields: 'userEnteredValue,userEnteredFormat' } });
  assert.deepEqual(requetes.filter((r) => r.deleteConditionalFormatRule).map((r) => r.deleteConditionalFormatRule.index), [1, 0]);
  const proprietes = requetes.find((r) => r.updateSheetProperties).updateSheetProperties.properties.gridProperties;
  assert.equal(proprietes.columnCount, 35);   // 5 colonnes fixes + 30 jours de novembre
  assert.equal(proprietes.frozenRowCount, onglet.tableau.lignesEnTete[0]);
  const regle = requetes.find((r) => r.addConditionalFormatRule).addConditionalFormatRule.rule;
  assert.equal(regle.ranges[0].startRowIndex, onglet.tableau.ligneAuDela - 1);
  assert.equal(regle.booleanRule.condition.type, 'NUMBER_GREATER');
  // Seuil écrit en calcul : « 0.0001 » est refusé par un Sheet réglé en français (virgule décimale).
  assert.deepEqual(regle.booleanRule.condition.values, [{ userEnteredValue: '=1/10000' }]);
});

test('mes totaux (équipe) : mois, N°, nom, minutes — projets seulement', () => {
  const lignes = lignesMesTotaux({ saisies: [...sheet.saisies, { date: '2026-11-04', minutes: 30, code: 'Pause' }],
    projets: sheet.projets, temps: TEMPS, dateDebut: '', aujourdhui: '2026-11-06' });
  assert.deepEqual(lignes, [['2025-12', 'A', 'Alpha', '60'], ['2026-09', 'A', 'Alpha', '120'], ['2026-11', 'A', 'Alpha', '60']]);
});
