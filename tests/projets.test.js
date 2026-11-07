// Projets : mêmes règles que Projets.gs (création, renommage, archivage, suppression d'un projet sans créneau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categories, planCreation, planStatut, planRenommageProjet, planSuppressionProjet } from '../js/projets.js';

const projets = [
  { code: '2026-001', nom: 'Morel', type: 'projet', statut: 'actif', equipe: false, numeroLigne: 2 },
  { code: '0001', nom: 'Admin', type: 'interne', statut: 'actif', equipe: false, numeroLigne: 3 },
  { code: '2026-002', nom: 'Équipe', type: 'projet', statut: 'actif', equipe: true, numeroLigne: 4 },
  { code: '2026-003', nom: 'Vieux', type: 'projet', statut: 'archivé', equipe: false, numeroLigne: 5 }
];
const cats = categories({ nomCategorieProjet: '', nomCategorieAutre: '' });

test('catégories : projets clients et lignes internes (comme Timesheets+)', () => {
  assert.deepEqual(cats.map((c) => [c.type, c.nom]), [['projet', 'Projets clients'], ['interne', 'Lignes internes']]);
});

test('création : ligne de l\'onglet Projets (lien doc vide) ; N° mal formé, déjà pris (archives comprises), nom vide, type inconnu → erreur', () => {
  assert.deepEqual(planCreation({ code: ' 2026-004 ', nom: ' Lumen ', type: 'projet', projets, categories: cats, aujourdhui: '2026-11-06' }),
    ['2026-004', 'Lumen', 'projet', 'actif', '']);
  assert.deepEqual(planCreation({ code: '0002', nom: 'Formation', type: 'interne', projets, categories: cats, aujourdhui: '2026-11-06' })[2], 'interne');
  assert.throws(() => planCreation({ code: '20 26', nom: 'x', type: 'projet', projets, categories: cats, aujourdhui: '' }));
  assert.throws(() => planCreation({ code: '2026-003', nom: 'x', type: 'projet', projets, categories: cats, aujourdhui: '' }));
  assert.throws(() => planCreation({ code: '2026-009', nom: '  ', type: 'projet', projets, categories: cats, aujourdhui: '' }));
  assert.throws(() => planCreation({ code: '2026-009', nom: 'x', type: 'autre', projets, categories: cats, aujourdhui: '' }));
});

test('archiver / réactiver et renommer : une seule cellule ; projet de l\'équipe ou introuvable → erreur', () => {
  assert.deepEqual(planStatut({ code: '2026-001', statut: 'archivé', projets }), { plage: "'Projets'!D2", valeur: 'archivé' });
  assert.deepEqual(planStatut({ code: '2026-003', statut: 'actif', projets }), { plage: "'Projets'!D5", valeur: 'actif' });
  assert.deepEqual(planRenommageProjet({ code: '0001', nom: ' Admin,  compta ', projets }), { plage: "'Projets'!B3", valeur: 'Admin, compta' });
  assert.throws(() => planStatut({ code: '2026-002', statut: 'archivé', projets }));
  assert.throws(() => planRenommageProjet({ code: '9999', nom: 'x', projets }));
});

test('supprimer : seulement sans créneau attribué (sinon on propose d\'archiver)', () => {
  const saisies = [{ code: '2026-001' }, { code: '2026-001' }, { code: 'Pause' }];
  assert.equal(planSuppressionProjet({ code: '2026-003', projets, saisies }), 5);
  assert.throws(() => planSuppressionProjet({ code: '2026-001', projets, saisies }), /2 créneaux/);
});
