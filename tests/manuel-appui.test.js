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

test('nouveau créneau en Pause, Congé ou Ignoré : enregistré avec ce code, sans contrôle de chevauchement', async () => {
  const { planAjoutManuel } = await import('../js/manuels.js');
  const { CODES } = await import('../js/regles.js');
  const occupe = [{ id: 'x', debut: '10:00', fin: '11:00', choix: '2105', journeeEntiere: false }];
  for (const code of [CODES.PAUSE, CODES.NON_TRAVAILLE, CODES.IGNORE]) {
    const ligne = planAjoutManuel({ date: '2026-11-16', debut: '10:00', fin: '11:00', titre: '', choix: code,
      creneauxDuJour: occupe, maintenant: 'm', nouvelId: () => 'id' });
    assert.equal(ligne[5], code);
  }
});
