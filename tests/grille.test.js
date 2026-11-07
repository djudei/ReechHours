// Grille horaire du jour (comme Google Agenda) : place de chaque créneau, côte à côte quand ils se chevauchent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispositionJour } from '../js/grille.js';

const c = (id, debut, fin) => ({ id, debut, fin, minutes: 0, journeeEntiere: false });

test('plage affichée : 8 h – 19 h par défaut, élargie aux créneaux plus tôt ou plus tard', () => {
  assert.deepEqual(dispositionJour([]).plage, { debut: 8, fin: 19 });
  assert.deepEqual(dispositionJour([c('a', '07:30', '08:00'), c('b', '20:00', '21:15')]).plage, { debut: 7, fin: 22 });
});

test('créneaux séparés : une colonne chacun ; chevauchement : côte à côte', () => {
  const { blocs } = dispositionJour([c('a', '09:00', '10:00'), c('b', '09:30', '11:00'), c('c', '10:00', '10:30'), c('d', '14:00', '15:00')]);
  const place = Object.fromEntries(blocs.map((b) => [b.creneau.id, [b.colonne, b.colonnes]]));
  assert.deepEqual(place, { a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  assert.deepEqual(blocs.find((b) => b.creneau.id === 'b').minutes, { debut: 570, fin: 660 });
});

test('journées entières à part (en haut de la grille)', () => {
  const r = dispositionJour([{ id: 'off', debut: '', fin: '', journeeEntiere: true }, c('a', '09:00', '10:00')]);
  assert.deepEqual(r.journee.map((x) => x.id), ['off']);
  assert.deepEqual(r.blocs.map((b) => b.creneau.id), ['a']);
});
