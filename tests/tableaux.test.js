// Onglets générés dans le Sheet : mêmes cellules que l'appli actuelle (mêmes cas que tests/test_recap_mois.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireTableauMois, construireTableauAnnuel, moisAExporter, lettreColonne, nomDuMois } from '../js/tableaux.js';
import { construireRecap } from '../js/recap.js';
import { categories } from '../js/projets.js';

const TEMPS = { minutesParJour: 420, jours: [1, 2, 3, 4, 5], avecBase: true, titresConges: [] };
const cats = categories({});
const projets = [
  { code: '2032', nom: 'OMEGA 2026', type: 'projet', statut: 'actif' },
  { code: '1001', nom: 'Réunions', type: 'interne', statut: 'actif' },
  { code: '2034', nom: 'SIGMA 2026', type: 'projet', statut: 'actif' }
];
const s = (date, minutes, code, debut = '09:00') => ({ date, minutes, code, debut });
const saisies = [
  s('2026-10-13', 45, '2032'), s('2026-10-13', 30, '2032'), s('2026-10-13', 60, '1001'),
  s('2026-10-14', 90, '2034'), s('2026-10-14', 30, ''),
  s('2026-10-15', 390, 'Non travaillé', '12:30'), s('2026-10-15', 180, '2032'),
  s('2026-10-16', 420, 'Non travaillé', ''),
  s('2026-10-17', 60, '2032'),
  s('2026-10-20', 120, '2032')
];
const t = construireTableauMois({ annee: 2026, mois: 10, saisies, projets, temps: TEMPS, dateDebut: '2026-10-01',
  dateLimite: '2026-10-17', genereLe: 'Généré', categories: cats });
const L = t.lignes;
const ligne = (libelle) => L.findIndex((l) => l[0] === libelle || l[1] === libelle) + 1;
const colJour = (j) => 5 + j;
const cellule = (n, col) => L[n - 1][col - 1];
const proche = (a, minutes) => Math.abs(a - minutes / 1440) < 1e-9;

test('onglet du mois : nom, titre, colonnes, en-têtes des jours, week-ends grisés', () => {
  assert.equal(nomDuMois(10, 2026), 'Octobre 2026');
  assert.equal(L[0][0], 'Temps par jour · Octobre 2026 (arrêté au 17/10/2026)');
  assert.deepEqual(L[3].slice(0, 5), ['N° projet', 'Projet', 'Type', 'Total (HH:MM)', 'Total (jours)']);
  assert.equal(L[3].length, 36);
  assert.equal(L[3][5], 'Jeu 1');
  assert.equal(L[3][35], 'Sam 31');
  assert.equal(t.colonnesGrisees.length, 9);
  assert.ok(t.colonnesGrisees.includes(colJour(3)));
});

test('onglet du mois : temps cumulés par jour, cases vides sans temps, totaux', () => {
  const omega = ligne('2032');
  assert.ok(proche(cellule(omega, colJour(13)), 75));
  assert.ok(proche(cellule(omega, colJour(17)), 60));
  assert.equal(cellule(omega, colJour(20)), '');
  assert.equal(cellule(omega, colJour(1)), '');
  assert.ok(proche(cellule(omega, 4), 315));
  assert.equal(cellule(omega, 5), 0.75);
  assert.match(cellule(ligne('Total projets clients'), colJour(13)), /^=SUM\(/);
});

test('onglet du mois : base, congés, à attribuer, au-delà en formule', () => {
  const base = ligne('Base à date');
  const nt = ligne('Non travaillé');
  assert.ok(proche(cellule(base, colJour(13)), 420));
  assert.ok(proche(cellule(base, colJour(15)), 210));
  assert.ok(proche(cellule(nt, colJour(15)), 210));
  assert.equal(cellule(base, colJour(16)), 0);
  assert.equal(cellule(base, 5), 10.5);
  assert.ok(proche(cellule(ligne('Encore à attribuer (non compté)'), colJour(14)), 30));
  assert.equal(cellule(ligne('Au-delà'), colJour(13)), `=R${ligne('Travaillé')}-R${base}`);
  assert.equal(lettreColonne(colJour(13)), 'R');
  assert.equal(t.ligneAuDela, ligne('Au-delà'));
  const recap = construireRecap({ saisies, projets, annee: 2026, mois: 10, dateLimite: '2026-10-17', dateDebut: '2026-10-01', temps: TEMPS });
  assert.equal(Math.round(recap.totalBaseMinutes / 420 * 100) / 100, cellule(base, 5));
});

test('mois passé : « Base 35h », pas d\'« arrêté »', () => {
  const t3 = construireTableauMois({ annee: 2026, mois: 9, saisies: [], projets, temps: TEMPS, dateDebut: '', dateLimite: null, genereLe: 'x', categories: cats });
  assert.equal(t3.lignes[0][0], 'Temps par jour · Septembre 2026');
  assert.ok(t3.lignes.some((l) => l[1] === 'Base 35h'));
});

test('récap annuel : une colonne par mois, en jours ; mois à écrire', () => {
  const a = construireTableauAnnuel({ annee: 2026, mois: [10, 11], saisies, projets, temps: TEMPS, dateDebut: '', aujourdhui: '2026-11-06',
    genereLe: 'x', categories: cats });
  assert.equal(a.lignes[0][0], 'Récap annuel 2026 (arrêté au 06/11/2026)');
  assert.deepEqual(a.lignes[3].slice(5), ['Octobre 2026', 'Novembre 2026']);
  assert.equal(a.unite, 'jours');
  assert.deepEqual(moisAExporter(2026, [10, 11], '2026-11', '2026-11-06'), ['2026-10', '2026-11']);
  assert.deepEqual(moisAExporter(2026, [3], '2026-01', '2026-05-02'), ['2026-01', '2026-03', '2026-04', '2026-05']);
});
