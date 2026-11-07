// Charge : même onglet « Charge » que Charge.gs (intitulés en lignes, un mois par colonne, missions une par ligne).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireIntitulesCharge, lireTableauCharge, zonesDuMois, zonesParDefaut, verifierZones, grilleCharge, moisSuivant } from '../js/charge.js';

const INTITULES = ['Interne', 'Projets en cours', 'Projets à venir', 'Projets en clôture', 'Développement commercial'];
// Même forme que l'onglet Charge de Timesheets+ : « Intitulé », mois « Octobre 2026 », ligne « Modifié le ».
const grille = [
  ['Intitulé', 'Octobre 2026', 'Novembre 2026'],
  ['Interne', 'Compta\nSite', ''],
  ['Projets en cours', 'ALPHA - RdV', '—'],
  ['Projets à venir', '', 'BETA - Lancement'],
  ['Modifié le', '31/10/2026 18:00', '05/11/2026 09:00']
];

test('intitulés des Réglages : séparés par « | », 5 au plus ; vide → null', () => {
  assert.deepEqual(lireIntitulesCharge(' Interne |  Projets en cours | '), ['Interne', 'Projets en cours']);
  assert.equal(lireIntitulesCharge(''), null);
});

test('lecture du tableau : en-têtes « Octobre 2026 » (ou "2026-10") → clés "2026-10", date de modification', () => {
  const t = lireTableauCharge(grille, INTITULES);
  assert.deepEqual(Object.keys(t.mois).sort(), ['2026-10', '2026-11']);
  assert.equal(t.mois['2026-10'].Interne, 'Compta\nSite');
  assert.equal(t.modifie['2026-11'], '05/11/2026 09:00');
  assert.equal(lireTableauCharge([], INTITULES).mois && Object.keys(lireTableauCharge([], INTITULES).mois).length, 0);
  assert.throws(() => lireTableauCharge([['Mois', 'Zone']], INTITULES));   // ancien format : on ne touche pas
});

test('zones du mois : dans l\'ordre des intitulés, « — » = zone sans mission ; mois vide → 3 zones vides', () => {
  const t = lireTableauCharge(grille, INTITULES);
  assert.deepEqual(zonesDuMois(t, '2026-11', INTITULES), [
    { categorie: 'Projets en cours', elements: [] }, { categorie: 'Projets à venir', elements: ['BETA - Lancement'] }]);
  assert.deepEqual(zonesDuMois(t, '2026-12', INTITULES), []);
  assert.deepEqual(zonesParDefaut(INTITULES).map((z) => z.categorie), ['Interne', 'Projets en cours', 'Projets à venir']);
});

test('vérification : puces retirées, lignes vides ignorées ; intitulé inconnu ou en double → erreur', () => {
  assert.deepEqual(verifierZones([{ categorie: 'Interne', elements: '- Compta\n\n  • Site  ' }], INTITULES),
    [{ categorie: 'Interne', elements: ['Compta', 'Site'] }]);
  assert.throws(() => verifierZones([{ categorie: 'Inconnue', elements: [] }], INTITULES));
  assert.throws(() => verifierZones([{ categorie: 'Interne', elements: [] }, { categorie: 'Interne', elements: [] }], INTITULES));
});

test('écriture : la colonne du mois est remplacée, mois triés, en-têtes « Novembre 2026 », ligne « Modifié le »', () => {
  const t = lireTableauCharge(grille, INTITULES);
  const g = grilleCharge(t, '2026-11', [{ categorie: 'Interne', elements: ['Compta'] }, { categorie: 'Projets en cours', elements: [] }], '06/11/2026 10:00');
  assert.deepEqual(g[0], ['Intitulé', 'Octobre 2026', 'Novembre 2026']);
  assert.deepEqual(g.find((l) => l[0] === 'Interne'), ['Interne', 'Compta\nSite', 'Compta']);
  assert.deepEqual(g.find((l) => l[0] === 'Projets en cours'), ['Projets en cours', 'ALPHA - RdV', '—']);
  assert.deepEqual(g.find((l) => l[0] === 'Projets à venir'), ['Projets à venir', '', '']);
  assert.deepEqual(g[g.length - 1], ['Modifié le', '31/10/2026 18:00', '06/11/2026 10:00']);
  assert.equal(moisSuivant('2026-12'), '2027-01');
});

test('« Projets clôturés » : 6e intitulé, après « Projets en clôture » ; jusqu\'à 6 zones par mois', async () => {
  const { INTITULES_PAR_DEFAUT } = await import('../js/charge.js');
  assert.deepEqual(INTITULES_PAR_DEFAUT, ['AO & Reco', 'Projets en cours', 'Projets à venir', 'Projets en clôture', 'Projets clôturés', 'Développement commercial']);
  const six = INTITULES_PAR_DEFAUT.map((categorie) => ({ categorie, elements: ['x'] }));
  assert.equal(verifierZones(six, INTITULES_PAR_DEFAUT).length, 6);
});
