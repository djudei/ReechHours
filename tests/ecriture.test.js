// Écriture dans l'onglet Entries : mêmes lignes que l'appli Apps Script (synchro du jour, attribution).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ligneSaisie, planSynchroSemaine, planAttribution, verifierChoix, horodatage } from '../js/ecriture.js';

const MAINTENANT = '2026-11-06 10:00:00';
let compteur = 0;
const nouvelId = () => `id-${++compteur}`;

const creneau = (id, choix, autres) => ({ id, titre: `Titre ${id}`, debut: '09:00', fin: '10:00', minutes: 60,
  choix, proposition: choix, enregistre: false, journeeEntiere: false, manuel: false, ...autres });

test('horodatage au format du Sheet', () => {
  assert.equal(horodatage(new Date(2026, 10, 6, 9, 5, 7)), '2026-11-06 09:05:07');
});

test('ligne de saisie : 11 colonnes, « yes » seulement si le choix est la proposition', () => {
  const c = creneau('ev_1', '2026-014');
  assert.deepEqual(ligneSaisie({ id: 'S1', date: '2026-11-06', creneau: c, choix: '2026-014', maintenant: MAINTENANT }),
    ['S1', '2026-11-06', '09:00', '10:00', 60, '2026-014', 'agenda', 'ev_1', 'Titre ev_1', 'oui', MAINTENANT]);
  assert.equal(ligneSaisie({ id: 'S1', date: '2026-11-06', creneau: c, choix: 'Pause', maintenant: MAINTENANT })[9], 'non');
  assert.equal(ligneSaisie({ id: 'S1', date: '2026-11-06', creneau: creneau('ev_2', ''), choix: '', maintenant: MAINTENANT })[9], 'non');
});

test('synchro : créneaux nouveaux ajoutés (jusqu\'à aujourd\'hui, dès le début du suivi), disparus passés en Ignored', () => {
  const jours = [
    { date: '2026-10-31', creneaux: [creneau('avant_1', '')] },                         // avant le début du suivi
    { date: '2026-11-05', creneaux: [creneau('connu_1', '0001', { enregistre: true }), creneau('nouveau_1', '')] },
    { date: '2026-11-07', creneaux: [creneau('futur_1', '')] }                           // jour futur
  ];
  const saisies = [
    { numeroLigne: 2, date: '2026-11-05', source: 'agenda', idEvenement: 'connu_1', code: '0001' },
    { numeroLigne: 3, date: '2026-11-05', source: 'agenda', idEvenement: 'parti_1', code: '2026-014' },
    { numeroLigne: 4, date: '2026-11-05', source: 'agenda', idEvenement: 'parti_2', code: 'Ignoré' },
    { numeroLigne: 5, date: '2026-11-05', source: 'manuel', idEvenement: '', code: '0001' }
  ];
  const plan = planSynchroSemaine({ jours, saisies, aujourdhui: '2026-11-06', debutSuivi: '2026-11-01', maintenant: MAINTENANT, nouvelId });
  assert.deepEqual(plan.ajouts.map((l) => l[7]), ['nouveau_1']);
  assert.deepEqual(plan.ignores, [3]);
});

test('synchro : rien à faire → plan vide', () => {
  const jours = [{ date: '2026-11-05', creneaux: [creneau('connu_1', '0001', { enregistre: true })] }];
  const saisies = [{ numeroLigne: 2, date: '2026-11-05', source: 'agenda', idEvenement: 'connu_1', code: '0001' }];
  const plan = planSynchroSemaine({ jours, saisies, aujourdhui: '2026-11-06', debutSuivi: '', maintenant: MAINTENANT, nouvelId });
  assert.deepEqual(plan, { ajouts: [], ignores: [] });
});

test('attribution : créneau déjà enregistré → sa ligne est réécrite (même id) ; sinon nouvelle ligne', () => {
  const saisies = [{ numeroLigne: 7, id: 'S7', date: '2026-11-06', source: 'agenda', idEvenement: 'ev_1', code: '' }];
  const existant = planAttribution({ date: '2026-11-06', creneau: creneau('ev_1', ''), choix: '2026-014', saisies, maintenant: MAINTENANT, nouvelId });
  assert.equal(existant.numeroLigne, 7);
  assert.equal(existant.ligne[0], 'S7');
  assert.equal(existant.ligne[5], '2026-014');
  const nouveau = planAttribution({ date: '2026-11-06', creneau: creneau('ev_2', ''), choix: 'Pause', saisies, maintenant: MAINTENANT, nouvelId });
  assert.equal(nouveau.numeroLigne, null);
  assert.match(nouveau.ligne[0], /^id-/);
});

test('attribution d\'un créneau manuel : sa ligne garde ses valeurs, seul le choix change ; introuvable → erreur', () => {
  const saisies = [{ numeroLigne: 9, id: 'M1', date: '2026-11-06', debut: '17:30', fin: '18:00', minutes: 30,
    source: 'manuel', idEvenement: '', titre: 'Relances', code: '' }];
  const manuel = { id: 'M1', manuel: true };
  const plan = planAttribution({ date: '2026-11-06', creneau: manuel, choix: '0001', saisies, maintenant: MAINTENANT, nouvelId });
  assert.deepEqual(plan, { numeroLigne: 9, ligne: ['M1', '2026-11-06', '17:30', '18:00', 30, '0001', 'manuel', '', 'Relances', 'non', MAINTENANT] });
  assert.throws(() => planAttribution({ date: '2026-11-06', creneau: { id: 'M2', manuel: true }, choix: '0001', saisies, maintenant: MAINTENANT, nouvelId }));
});

test('choix vérifié : projet actif, choix spécial ou vide ; projet archivé ou inconnu → erreur', () => {
  const projets = [{ code: 'A', statut: 'actif' }, { code: 'B', statut: 'archivé' }];
  assert.doesNotThrow(() => verifierChoix('A', projets));
  assert.doesNotThrow(() => verifierChoix('Ignoré', projets));
  assert.doesNotThrow(() => verifierChoix('', projets));
  assert.throws(() => verifierChoix('B', projets));
  assert.throws(() => verifierChoix('Z', projets));
});
