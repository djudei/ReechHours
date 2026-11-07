// La semaine : créneaux de chaque jour (Agenda + saisies du Sheet) et résumé (anneau, colonnes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evenementDepuisApi, creneauxDuJour, resumeSemaine, joursDeLaSemaine, lundiDe } from '../js/semaine.js';

const TEMPS = { minutesParJour: 420, jours: [1, 2, 3, 4, 5], avecBase: true, titresConges: ['Off', 'RTT'] };
const PROJETS = [
  { code: '2026-014', nom: 'Morel', type: 'projet', statut: 'actif' },
  { code: '2026-009', nom: 'Lumen', type: 'projet', statut: 'actif' },
  { code: '2026-001', nom: 'Ancien', type: 'projet', statut: 'archivé' }
];
const ev = (id, titre, debut, fin, autres) => evenementDepuisApi(Object.assign({
  iCalUID: id, summary: titre, start: { dateTime: debut }, end: { dateTime: fin }
}, autres));

test('semaine : du lundi au dimanche', () => {
  assert.equal(lundiDe('2026-11-06'), '2026-11-02');
  assert.equal(lundiDe('2026-11-08'), '2026-11-02');
  assert.deepEqual(joursDeLaSemaine('2026-11-02'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
});

test('événement Google : annulé → null ; refusé repéré ; journée entière lue', () => {
  assert.equal(evenementDepuisApi({ status: 'cancelled' }), null);
  const refuse = ev('a@google.com', 'Réunion', '2026-11-06T10:00:00+01:00', '2026-11-06T11:00:00+01:00',
    { attendees: [{ self: true, responseStatus: 'declined' }] });
  assert.equal(refuse.refuse, true);
  const off = evenementDepuisApi({ iCalUID: 'o@google.com', summary: 'Off', start: { date: '2026-11-06' }, end: { date: '2026-11-07' } });
  assert.deepEqual(off.journee, { debut: '2026-11-06', fin: '2026-11-07' });
});

test('créneaux du jour : id compatible avec le Sheet, saisie existante gagne, sinon proposition, refusé caché', () => {
  const evenements = [
    ev('m@google.com', 'MOREL | maquettes', '2026-11-06T09:30:00+01:00', '2026-11-06T12:00:00+01:00'),
    ev('l@google.com', 'Appel Lumen', '2026-11-06T14:00:00+01:00', '2026-11-06T15:00:00+01:00'),
    ev('r@google.com', 'Refusée', '2026-11-06T16:00:00+01:00', '2026-11-06T17:00:00+01:00',
      { attendees: [{ self: true, responseStatus: 'declined' }] }),
    ev('d@google.com', 'Autre jour', '2026-11-05T09:00:00+01:00', '2026-11-05T10:00:00+01:00')
  ];
  const idLumen = 'l@google.com_' + Date.parse('2026-11-06T14:00:00+01:00');
  const saisies = [
    { date: '2026-11-06', source: 'agenda', idEvenement: idLumen, code: '2026-009' },
    { id: 'S9', date: '2026-11-06', source: 'manuel', debut: '17:30', fin: '18:00', minutes: 30, titre: 'Relances', code: '' }
  ];
  const creneaux = creneauxDuJour('2026-11-06', evenements, saisies, PROJETS, TEMPS);
  assert.deepEqual(creneaux.map((c) => [c.titre, c.debut, c.fin, c.minutes, c.choix]), [
    ['MOREL | maquettes', '09:30', '12:00', 150, '2026-014'],
    ['Appel Lumen', '14:00', '15:00', 60, '2026-009'],
    ['Relances', '17:30', '18:00', 30, '']
  ]);
  assert.equal(creneaux[1].id, idLumen);
  assert.equal(creneaux[2].manuel, true);
});

test('jour de congé (« Off » toute la journée, jour travaillé) → une journée Not worked, le reste Ignored', () => {
  const evenements = [
    evenementDepuisApi({ iCalUID: 'o@google.com', summary: 'off', start: { date: '2026-11-06' }, end: { date: '2026-11-07' } }),
    ev('m@google.com', 'MOREL | point', '2026-11-06T09:30:00+01:00', '2026-11-06T10:00:00+01:00')
  ];
  const creneaux = creneauxDuJour('2026-11-06', evenements, [], PROJETS, TEMPS);
  assert.deepEqual(creneaux.map((c) => [c.id, c.minutes, c.choix, c.journeeEntiere]), [
    ['o@google.com_2026-11-06', 420, 'Non travaillé', true],
    ['m@google.com_' + Date.parse('2026-11-06T09:30:00+01:00'), 30, 'Ignoré', false]
  ]);
});

test('résumé de la semaine : travaillé, à attribuer, base moins les congés, pourcentage', () => {
  const jours = [
    { date: '2026-11-02', creneaux: [{ minutes: 240, choix: '2026-014' }, { minutes: 60, choix: 'Pause' }, { minutes: 120, choix: '2026-009' }] },
    { date: '2026-11-03', creneaux: [{ minutes: 420, choix: 'Non travaillé' }] },
    { date: '2026-11-04', creneaux: [{ minutes: 90, choix: '' }, { minutes: 30, choix: '2026-014' }] },
    { date: '2026-11-05', creneaux: [] }, { date: '2026-11-06', creneaux: [] },
    { date: '2026-11-07', creneaux: [] }, { date: '2026-11-08', creneaux: [] }
  ];
  const r = resumeSemaine(jours, TEMPS);
  assert.equal(r.travaille, 390);
  assert.equal(r.libre, 90);
  assert.equal(r.base, 5 * 420 - 420);
  assert.equal(r.pourcent, Math.round(390 / 1680 * 100));
  assert.deepEqual(r.jours[0].parts, [{ code: '2026-014', minutes: 240 }, { code: '2026-009', minutes: 120 }]);
  assert.equal(r.jours[2].libre, 90);
  const sansBase = resumeSemaine(jours, { ...TEMPS, avecBase: false });
  assert.equal(sansBase.base, null);
  assert.equal(sansBase.pourcent, null);
});
