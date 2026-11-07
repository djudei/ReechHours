// Créneaux ajoutés à la main : mêmes règles que Manuels.gs (quarts d'heure, pas de chevauchement compté,
// seules ces lignes peuvent être supprimées).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireHeure, chercherChevauchement, planAjoutManuel, planRenommage, planSuppression } from '../js/manuels.js';

const MAINTENANT = '2026-11-06 10:00:00';
const nouvelId = () => 'M-neuf';
const jour = [
  { id: 'ev_1', titre: 'Point', debut: '09:00', fin: '10:00', minutes: 60, choix: '0001', journeeEntiere: false },
  { id: 'ev_2', titre: 'Déjeuner', debut: '12:00', fin: '13:00', minutes: 60, choix: 'Pause', journeeEntiere: false },
  { id: 'M1', titre: 'Relances', debut: '17:30', fin: '18:00', minutes: 30, choix: '', journeeEntiere: false, manuel: true }
];

test('heures : quarts d\'heure seulement, « 24:00 » accepté', () => {
  assert.equal(lireHeure('09:15'), 555);
  assert.equal(lireHeure('24:00'), 1440);
  assert.throws(() => lireHeure('09:10'));
  assert.throws(() => lireHeure('9h'));
});

test('chevauchement : un créneau compté ou à attribuer bloque ; Pause et Ignoré non ; le créneau lui-même non', () => {
  assert.equal(chercherChevauchement(jour, 570, 630, null).id, 'ev_1');
  assert.equal(chercherChevauchement(jour, 720, 780, null), null);          // sur le déjeuner en Pause
  assert.equal(chercherChevauchement(jour, 1050, 1080, null).id, 'M1');
  assert.equal(chercherChevauchement(jour, 1050, 1080, 'M1'), null);
  assert.equal(chercherChevauchement(jour, 600, 720, null), null);           // pile entre deux créneaux
});

test('ajout : ligne « manual » complète ; titre vide → titre par défaut ; fin avant début ou chevauchement → erreur', () => {
  const ligne = planAjoutManuel({ date: '2026-11-06', debut: '10:00', fin: '11:30', titre: '  Rédaction  ', choix: '2026-014',
    creneauxDuJour: jour, maintenant: MAINTENANT, nouvelId });
  assert.deepEqual(ligne, ['M-neuf', '2026-11-06', '10:00', '11:30', 90, '2026-014', 'manuel', '', 'Rédaction', 'non', MAINTENANT]);
  const sansTitre = planAjoutManuel({ date: '2026-11-06', debut: '14:00', fin: '15:00', titre: '', choix: '',
    creneauxDuJour: jour, maintenant: MAINTENANT, nouvelId });
  assert.equal(sansTitre[8], 'Créneau manuel');
  assert.throws(() => planAjoutManuel({ date: '2026-11-06', debut: '11:00', fin: '10:00', titre: 'x', choix: '', creneauxDuJour: jour, maintenant: MAINTENANT, nouvelId }));
  assert.throws(() => planAjoutManuel({ date: '2026-11-06', debut: '09:30', fin: '10:30', titre: 'x', choix: '0001', creneauxDuJour: jour, maintenant: MAINTENANT, nouvelId }));
  // Un créneau en Pause peut recouvrir un autre créneau : il ne compte pas.
  assert.doesNotThrow(() => planAjoutManuel({ date: '2026-11-06', debut: '09:30', fin: '10:30', titre: 'x', choix: 'Pause', creneauxDuJour: jour, maintenant: MAINTENANT, nouvelId }));
});

const saisies = [
  { numeroLigne: 5, id: 'M1', date: '2026-11-06', debut: '17:30', fin: '18:00', minutes: 30, code: '', source: 'manuel', idEvenement: '', titre: 'Relances' },
  { numeroLigne: 6, id: 'S2', date: '2026-11-06', source: 'agenda', idEvenement: 'ev_1', code: '0001' }
];

test('renommer : seul le titre change ; vide ou trop long → erreur', () => {
  assert.deepEqual(planRenommage({ date: '2026-11-06', id: 'M1', titre: ' Relances  devis ', saisies, maintenant: MAINTENANT }),
    { numeroLigne: 5, ligne: ['M1', '2026-11-06', '17:30', '18:00', 30, '', 'manuel', '', 'Relances devis', 'non', MAINTENANT] });
  assert.throws(() => planRenommage({ date: '2026-11-06', id: 'M1', titre: '   ', saisies, maintenant: MAINTENANT }));
  assert.throws(() => planRenommage({ date: '2026-11-06', id: 'M1', titre: 'x'.repeat(101), saisies, maintenant: MAINTENANT }));
});

test('supprimer : seulement une ligne manuelle de ce jour ; une ligne de l\'Agenda ou introuvable → erreur', () => {
  assert.equal(planSuppression({ date: '2026-11-06', id: 'M1', saisies }), 5);
  assert.throws(() => planSuppression({ date: '2026-11-06', id: 'S2', saisies }));
  assert.throws(() => planSuppression({ date: '2026-11-07', id: 'M1', saisies }));
});
