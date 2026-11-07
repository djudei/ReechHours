// Numéro de projet automatique : mêmes résultats que Numerotation.gs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prochainNumero, lettresClient, proposerNumero, FORMATS_NUMERO } from '../js/numerotation.js';

const novembre = { annee: 2026, mois: 11 };

test('annuel : suite du plus grand N° de l\'année, nouvelle année → 001, jamais tronqué', () => {
  assert.equal(prochainNumero('YYYY-001', [], novembre), '2026-001');
  assert.equal(prochainNumero('YYYY-001', ['2026-001', '2026-007', '2025-012', 'ACME-009'], novembre), '2026-008');
  assert.equal(prochainNumero('YYYY-001', ['2026-999'], novembre), '2026-1000');
});

test('mensuels et continu', () => {
  assert.equal(prochainNumero('YYYYMM-001', ['202611-002', '202610-005'], novembre), '202611-003');
  assert.equal(prochainNumero('001-YYYY-MM', ['004-2026-11', '009-2026-10'], novembre), '005-2026-11');
  assert.equal(prochainNumero('1', ['1', '2', '10', '2026-001'], novembre), '11');
});

test('client : compteur par client, sans lettres → erreur', () => {
  assert.equal(prochainNumero('CLIENT-001', ['ACME-001', 'acme-004', 'BETA-009'], novembre, 'ACME'), 'ACME-005');
  assert.equal(prochainNumero('CLIENT-001', ['ACME-001'], novembre, 'NOVA'), 'NOVA-001');
  assert.throws(() => prochainNumero('CLIENT-001', [], novembre, ' '));
  assert.equal(lettresClient('l\'Écume x'), 'LECUME');
  assert.equal(lettresClient(' École Moreau'), 'ECOLE');
});

test('par catégorie : un compteur par catégorie, plein après 999', () => {
  const codes = ['1001', '1002', '0001', '2001', '1007'];
  assert.equal(prochainNumero('CATEGORY-001', codes, novembre, '', 'projet'), '1008');
  assert.equal(prochainNumero('CATEGORY-001', codes, novembre, '', 'interne'), '0002');
  assert.equal(prochainNumero('CATEGORY-001', codes, novembre, '', 'autre'), '2002');
  assert.throws(() => prochainNumero('CATEGORY-001', ['1999'], novembre, '', 'projet'));
});

test('proposition : format client sans lettres ni nom → "" ; avec le nom → lettres du 1er mot', () => {
  assert.equal(proposerNumero({ format: 'CLIENT-001', codes: [], periode: novembre, lettres: '', nom: '' }), '');
  assert.equal(proposerNumero({ format: 'CLIENT-001', codes: ['NOVA-002'], periode: novembre, lettres: '', nom: 'Nova lancement' }), 'NOVA-003');
  assert.equal(proposerNumero({ format: 'YYYY-001', codes: ['2026-009'], periode: novembre }), '2026-010');
  assert.equal(FORMATS_NUMERO.length, 7);
});

test('agence : lignes internes en 10XX, projets clients en 2XXX, suite du plus grand N° ; série pleine → erreur', () => {
  const codes = ['2116', '2034', '1001', '1004', '2060', '2060 - ALPHA'];
  assert.equal(prochainNumero('REECH', codes, novembre, '', 'projet'), '2117');
  assert.equal(prochainNumero('REECH', codes, novembre, '', 'interne'), '1005');
  assert.equal(prochainNumero('REECH', [], novembre, '', 'projet'), '2001');
  assert.equal(prochainNumero('REECH', [], novembre, '', 'interne'), '1001');
  assert.throws(() => prochainNumero('REECH', ['1099'], novembre, '', 'interne'));
});
