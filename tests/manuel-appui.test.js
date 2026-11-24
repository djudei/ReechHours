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

test('modifier un créneau manuel : date, heures, titre ; contrôles comme à la création', async () => {
  const { planModification } = await import('../js/manuels.js');
  const { lireSaisies } = await import('../js/regles.js');
  const saisies = lireSaisies([
    ['m1', '2026-11-16', '10:00', '11:00', '60', '2105', 'manuel', '', 'Atelier', 'non', ''],
    ['a1', '2026-11-17', '14:00', '15:00', '60', '2034', 'agenda', 'x@google.com_1', 'Réunion', 'oui', ''],
    ['a2', '2026-11-17', '16:00', '17:00', '60', 'Ignoré', 'agenda', 'y@google.com_1', 'Pas pour moi', 'oui', '']
  ]);
  const p = planModification({ date: '2026-11-16', id: 'm1', nouvelleDate: '2026-11-16', debut: '09:30', fin: '11:15', titre: ' Atelier  long ', saisies, maintenant: 'm' });
  assert.equal(p.numeroLigne, 2);
  assert.deepEqual(p.ligne, ['m1', '2026-11-16', '09:30', '11:15', 105, '2105', 'manuel', '', 'Atelier long', 'non', 'm']);
  // Déplacé au 17 : chevauche une réunion comptée → refus ; par-dessus un Ignoré → accepté
  assert.throws(() => planModification({ date: '2026-11-16', id: 'm1', nouvelleDate: '2026-11-17', debut: '14:30', fin: '15:30', titre: 'x', saisies, maintenant: 'm' }));
  assert.equal(planModification({ date: '2026-11-16', id: 'm1', nouvelleDate: '2026-11-17', debut: '16:00', fin: '17:00', titre: 'x', saisies, maintenant: 'm' }).ligne[1], '2026-11-17');
  assert.throws(() => planModification({ date: '2026-11-16', id: 'm1', nouvelleDate: '2026-11-16', debut: '11:00', fin: '10:00', titre: 'x', saisies, maintenant: 'm' }));
  assert.throws(() => planModification({ date: '2026-11-16', id: 'm1', nouvelleDate: '2026-11-16', debut: '10:10', fin: '11:00', titre: 'x', saisies, maintenant: 'm' }));
  assert.throws(() => planModification({ date: '2026-11-16', id: 'a1', nouvelleDate: '2026-11-16', debut: '10:00', fin: '11:00', titre: 'x', saisies, maintenant: 'm' }));   // créneau de l'Agenda : jamais
});
