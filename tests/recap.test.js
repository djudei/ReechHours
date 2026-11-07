// Récap du mois : mêmes chiffres que Recap.gs (travaillé, base, au-delà, congés arrondis à la demi-journée).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nonTravailleDuJour, construireRecap, dateLimitePour } from '../js/recap.js';

const TEMPS = { minutesParJour: 420, jours: [1, 2, 3, 4, 5], avecBase: true, titresConges: [] };
const projets = [{ code: 'A', nom: 'Alpha', type: 'projet' }, { code: '0001', nom: 'Admin', type: 'interne' }];

test('congé : journée entière, matin plafonné à ½ journée, plage à cheval, total plafonné', () => {
  assert.equal(nonTravailleDuJour([{ debut: '', minutes: 420 }], 420), 420);
  assert.equal(nonTravailleDuJour([{ debut: '08:00', minutes: 300 }], 420), 210);          // matin (finit à 13h) → ½
  assert.equal(nonTravailleDuJour([{ debut: '13:00', minutes: 120 }], 420), 120);          // après-midi : durée réelle
  assert.equal(nonTravailleDuJour([{ debut: '10:00', minutes: 300 }], 420), 210);          // à cheval, < 1 jour → ½
  assert.equal(nonTravailleDuJour([{ debut: '08:00', minutes: 240 }, { debut: '13:00', minutes: 400 }], 420), 420);
});

test('mois en cours : arrêté à aujourd\'hui ; mois passé : complet', () => {
  assert.equal(dateLimitePour('2026-11', '2026-11-06'), '2026-11-06');
  assert.equal(dateLimitePour('2026-10', '2026-11-06'), null);
});

test('récap de novembre au 6 : travaillé, base des jours ouvrés passés moins les congés, au-delà, à attribuer', () => {
  const saisies = [
    { date: '2026-11-02', debut: '09:00', minutes: 420, code: 'A' },
    { date: '2026-11-03', debut: '09:00', minutes: 240, code: 'A' },
    { date: '2026-11-03', debut: '14:00', minutes: 120, code: '0001' },
    { date: '2026-11-04', debut: '', minutes: 420, code: 'Non travaillé' },
    { date: '2026-11-05', debut: '12:00', minutes: 60, code: 'Pause' },
    { date: '2026-11-05', debut: '09:00', minutes: 480, code: 'A' },
    { date: '2026-11-06', debut: '10:00', minutes: 60, code: '' },
    { date: '2026-11-09', debut: '10:00', minutes: 600, code: 'A' },      // après la date limite : ignoré
    { date: '2026-10-30', debut: '10:00', minutes: 600, code: 'A' }       // autre mois : ignoré
  ];
  const r = construireRecap({ saisies, projets, annee: 2026, mois: 11, dateLimite: '2026-11-06', dateDebut: '', temps: TEMPS });
  assert.equal(r.totalTravailleMinutes, 420 + 240 + 120 + 480);
  assert.equal(r.totalBaseMinutes, 5 * 420 - 420);       // 5 jours ouvrés du 2 au 6, moins un jour de congé
  assert.equal(r.totalEcartMinutes, 1260 - 1680);
  assert.equal(r.aAttribuerMinutes, 60);
  assert.equal(r.nonTravailleMinutes, 420);
  assert.equal(r.joursTravailles, 3);
  assert.deepEqual(r.projets.map((p) => [p.code, p.minutes, p.type]), [['0001', 120, 'interne'], ['A', 1140, 'projet']]);
});

test('sans base : base et écart à 0 ; code absent de Projects → signalé', () => {
  const r = construireRecap({ saisies: [{ date: '2026-10-05', minutes: 60, code: 'ZZ' }], projets, annee: 2026, mois: 10,
    dateLimite: null, dateDebut: '', temps: { ...TEMPS, avecBase: false } });
  assert.equal(r.totalBaseMinutes, 0);
  assert.equal(r.projets[0].nom, 'N° inconnu (absent de l\'onglet Projects)');
});

test('avant le début du suivi : rien n\'est compté, ni la base', () => {
  const r = construireRecap({ saisies: [{ date: '2026-11-02', minutes: 420, code: 'A' }], projets, annee: 2026, mois: 11,
    dateLimite: '2026-11-06', dateDebut: '2026-11-04', temps: TEMPS });
  assert.equal(r.totalTravailleMinutes, 0);
  assert.equal(r.totalBaseMinutes, 3 * 420);
});
