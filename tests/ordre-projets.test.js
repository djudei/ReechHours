// Listes de choix (Trier, Nouveau créneau) : projets clients d'abord, lignes internes ensuite, chacun par N°.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projetsPourTri } from '../js/ecran-tri.js';

test('clients 2XXX avant les lignes internes 10XX ; archivés absents', () => {
  const p = (code, type, statut = 'actif') => ({ code, nom: code, type, statut });
  const ordre = projetsPourTri([p('1004', 'interne'), p('2116', 'projet'), p('1001', 'interne'), p('2009', 'projet'), p('2001', 'projet', 'archivé')])
    .map((x) => x.code);
  assert.deepEqual(ordre, ['2009', '2116', '1001', '1004']);
});
