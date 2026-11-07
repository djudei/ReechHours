// Règles reprises de l'appli Apps Script : lecture du Sheet Timesheets+ (Réglages, Projets, Saisies) et pré-attribution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lireHeuresParJour, lireJoursTravailles, lireTitresConges, interpreterReglages,
  lireProjets, lireSaisies, preAttribuer, idSheetDepuisLien
} from '../js/regles.js';

test('heures par jour : formats acceptés, illisible → null', () => {
  assert.equal(lireHeuresParJour('7h00'), 420);
  assert.equal(lireHeuresParJour('7:30'), 450);
  assert.equal(lireHeuresParJour('7,5'), 450);
  assert.equal(lireHeuresParJour('beaucoup'), null);
  assert.equal(lireHeuresParJour('20'), null);
});

test('jours travaillés : « mon, tue » → [1, 2] ; nom inconnu → null', () => {
  assert.deepEqual(lireJoursTravailles('mon, tue, wed, thu, fri'), [1, 2, 3, 4, 5]);
  assert.deepEqual(lireJoursTravailles('sun, sat'), [6, 0]);
  assert.equal(lireJoursTravailles('lundi, xyz'), null);
});

test('titres de congés : sans doublons ni vides', () => {
  assert.deepEqual(lireTitresConges('Off, off ; RTT,,'), ['Off', 'RTT']);
});

test('réglages : onglet Réglages de Timesheets+ lu par étiquette ; temps de travail = règle de l\'agence', () => {
  const r = interpreterReglages([['Réglage', 'Valeur'], ['Email N+1', 'chef@exemple.fr'], ['Prénom destinataire', 'Alix'],
    ['Écriture docs réels', 'oui'], ['Nom dans les docs', 'Camille D'], ['Poste dans les docs', 'Chef de projet'],
    ['Début du suivi', '2026-10-01'], ['Initiales', 'CD'], ['Nom dans les docs', 'Doublon ignoré']]);
  assert.equal(r.prenom, 'Camille D');
  assert.equal(r.nomDocs, 'Camille D');
  assert.equal(r.initiales, 'CD');
  assert.equal(r.posteDocs, 'Chef de projet');
  assert.equal(r.emailDestinataire, 'chef@exemple.fr');   // ancienne étiquette « Email N+1 » reconnue
  assert.equal(r.prenomDestinataire, 'Alix');
  assert.equal(r.ecritureDocsReels, true);
  assert.equal(r.debutSuivi, '2026-10-01');
  assert.equal(r.formatNumero, 'REECH');
  assert.deepEqual(r.tempsDeTravail, { minutesParJour: 420, jours: [1, 2, 3, 4, 5], avecBase: true,
    titresConges: ['Non travaillé', 'Off', 'Congés', 'Congé', 'RTT'] });
  assert.equal(interpreterReglages([]).ecritureDocsReels, false);
});

test('projets : onglet Projets (Code, Nom, Type, Statut, Lien doc) ; lignes incomplètes ignorées', () => {
  const projets = lireProjets([
    ['2105', 'CLIENT A', 'projet', 'actif', 'https://docs.google.com/spreadsheets/d/abc/edit'],
    ['1001', 'Réunions', 'interne', 'actif '],
    ['', 'Sans numéro', 'projet', 'actif'],
    ['2002', 'Ancien', 'projet', 'archivé']
  ]);
  assert.deepEqual(projets.map((p) => [p.code, p.type, p.statut, p.lienDoc]),
    [['2105', 'projet', 'actif', 'https://docs.google.com/spreadsheets/d/abc/edit'], ['1001', 'interne', 'actif', ''], ['2002', 'projet', 'archivé', '']]);
});

test('saisies : une ligne de l\'onglet Saisies → objet saisie', () => {
  const [s] = lireSaisies([['S1', '2026-11-06', '09:00', '09:30', '30', '0001', 'agenda', 'abc@google.com_1', 'Point', 'oui', '']]);
  assert.deepEqual(s, { id: 'S1', date: '2026-11-06', debut: '09:00', fin: '09:30', minutes: 30, code: '0001',
    source: 'agenda', idEvenement: 'abc@google.com_1', titre: 'Point', auto: true, numeroLigne: 2 });
});

test('pré-attribution : « CLIENT | sujet » → le seul projet actif qui commence par CLIENT', () => {
  const actifs = [{ code: '1', nom: 'Morel 2026' }, { code: '2', nom: 'Lumen' }, { code: '3', nom: 'Lumière' }];
  assert.equal(preAttribuer('MOREL | maquettes', actifs).code, '1');
  assert.equal(preAttribuer('Agence x Lumen - brief', actifs).code, '2');
  assert.equal(preAttribuer('Lum - point', actifs), null);   // « Lum » n'est pas un mot entier
  assert.equal(preAttribuer('Déjeuner', actifs), null);
});

test('lien du Google Sheet → identifiant ; texte quelconque → ""', () => {
  assert.equal(idSheetDepuisLien('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0'),
    '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789');
  assert.equal(idSheetDepuisLien('bonjour'), '');
});
