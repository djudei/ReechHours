// Réglages : mêmes étiquettes que Reglages.gs de Timesheets+ ; chaque valeur va sur la ligne de son étiquette.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifierReglages, planReglages, initialesProposees, ecrireHeuresParJour } from '../js/reglages-edition.js';

const saisie = { nomDocs: '  Camille   D ', initiales: '', posteDocs: 'Chef de projet', prenomDestinataire: 'Alix', emailDestinataire: ' Alix@Exemple.fr ' };

test('initiales proposées : « Camille D » → CD, « Benjamin LS » → BLS, « Élodie » → E', () => {
  assert.equal(initialesProposees('Camille D'), 'CD');
  assert.equal(initialesProposees('Benjamin LS'), 'BLS');
  assert.equal(initialesProposees('Élodie'), 'E');
  assert.equal(ecrireHeuresParJour(420), '7h00');
});

test('vérification : valeurs nettoyées ; nom vide, initiales ou email illisibles → erreur', () => {
  const p = verifierReglages(saisie);
  assert.deepEqual(p, { nomDocs: 'Camille D', initiales: 'CD', posteDocs: 'Chef de projet', prenomDestinataire: 'Alix', emailDestinataire: 'alix@exemple.fr' });
  assert.equal(verifierReglages({ ...saisie, initiales: 'cdx' }).initiales, 'CDX');
  assert.throws(() => verifierReglages({ ...saisie, nomDocs: ' ' }));
  assert.throws(() => verifierReglages({ ...saisie, initiales: 'ABCDEF' }));
  assert.throws(() => verifierReglages({ ...saisie, emailDestinataire: 'pas-un-email' }));
  assert.equal(verifierReglages({ ...saisie, emailDestinataire: '' }).emailDestinataire, '');
});

test('onglet Réglages : chaque valeur sur la ligne de son étiquette, ancienne étiquette reconnue, étiquettes manquantes ajoutées', () => {
  const lignes = [['Réglage', 'Valeur'], ['Email N+1', 'ancien@exemple.fr'], ['Écriture docs réels', 'oui'], ['Nom dans les docs', 'Ancien'], ['Initiales', 'AN']];
  const plan = planReglages(lignes, verifierReglages(saisie));
  assert.deepEqual(plan.modifications, [
    { plage: "'Réglages'!B4", valeurs: [['Camille D']] },
    { plage: "'Réglages'!B5", valeurs: [['CD']] },
    { plage: "'Réglages'!B2", valeurs: [['alix@exemple.fr']] }
  ]);
  assert.deepEqual(plan.ajouts, [['Poste dans les docs', 'Chef de projet'], ['Prénom destinataire', 'Alix']]);
  // « Écriture docs réels » n'est jamais touché depuis cet écran.
  assert.ok(!plan.modifications.some((m) => m.plage.endsWith('B3')));
});
