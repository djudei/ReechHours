// Mise en forme : durées, numéro de semaine, période, couleurs et libellés des choix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duree, numeroSemaine, periode, titreJour, couleurChoix, libelleChoix } from '../js/format.js';

test('durées : heures et minutes', () => {
  assert.equal(duree(1410), '23 h 30');
  assert.equal(duree(60), '1 h');
  assert.equal(duree(30), '30 min');
  assert.equal(duree(0), '0 h');
  assert.equal(duree(65), '1 h 05');
});

test('numéro de semaine ISO', () => {
  assert.equal(numeroSemaine('2026-11-02'), 45);
  assert.equal(numeroSemaine('2026-12-28'), 53);
  assert.equal(numeroSemaine('2027-01-04'), 1);
});

test('période et titre du jour', () => {
  assert.equal(periode('2026-11-02', '2026-11-08'), '2 – 8 novembre');
  assert.equal(periode('2026-09-28', '2026-10-04'), '28 septembre – 4 octobre');
  assert.equal(titreJour('2026-11-06'), 'Vendredi 6 novembre');
});

test('couleurs et libellés : projet, interne, spécial, à attribuer', () => {
  const projets = [{ code: 'A', nom: 'Alpha', type: 'projet' }, { code: '0001', nom: 'Admin', type: 'interne' }, { code: 'B', nom: 'Beta', type: 'projet' }];
  assert.equal(couleurChoix('B', projets), 'var(--projet-1)');
  assert.equal(couleurChoix('0001', projets), 'var(--projet-interne)');
  assert.equal(couleurChoix('Pause', projets), 'var(--neutre)');
  assert.equal(couleurChoix('', projets), 'var(--signal)');
  assert.equal(libelleChoix('A', projets), 'A · Alpha');
  assert.equal(libelleChoix('0001', projets), 'Admin');
  assert.equal(libelleChoix('Pause', projets), 'Pause');
  assert.equal(libelleChoix('', projets), 'À attribuer');
  assert.equal(libelleChoix('ZZ', projets), 'Projet ZZ');
});
