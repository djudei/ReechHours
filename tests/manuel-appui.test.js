// Appui sur une zone vide de la grille de l'Agenda : nouveau créneau d'1 h au quart d'heure touché.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuresDepuisAppui } from '../js/ecran-manuel.js';

test('appui à 14h37 → 14:30–15:30 ; tard le soir → fin à 23:45 au plus tard ; jamais négatif', () => {
  assert.deepEqual(heuresDepuisAppui(14 * 60 + 37), { debut: '14:30', fin: '15:30' });
  assert.deepEqual(heuresDepuisAppui(9 * 60), { debut: '09:00', fin: '10:00' });
  assert.deepEqual(heuresDepuisAppui(23 * 60 + 50), { debut: '23:30', fin: '23:45' });
  assert.deepEqual(heuresDepuisAppui(22 * 60 + 50), { debut: '22:45', fin: '23:45' });
  assert.deepEqual(heuresDepuisAppui(-10), { debut: '00:00', fin: '01:00' });
});
