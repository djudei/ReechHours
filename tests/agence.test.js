// Base agence : mêmes règles que Agence.gs de Timesheets+ (projets suivis, temps envoyés, réponses lues).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changementsProjetsAgence, lignesTempsAgence, lireReponseAgence, nomProjetAgence } from '../js/agence.js';
import { synchroniserProjetsAgence, envoyerTempsAgence } from '../js/donnees.js';
import { interpreterReglages, lireProjets, lireSaisies } from '../js/regles.js';

const lien = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit';
const locaux = lireProjets([
  ['2105', 'ALPHA', 'projet', 'actif', ''],
  ['2034', 'BETA', 'projet', 'actif', lien],
  ['1004', 'Dév. commercial', 'interne', 'actif', ''],
  ['ABC', 'Code libre', 'projet', 'actif', '']
]);

test('projets : nouveau ajouté « Client – Projet », terminé archivé, lien complété ; jamais de renommage ni de suppression', () => {
  const c = changementsProjetsAgence(locaux, [
    { numero: 2120, client: 'ORION', nom: 'Lancement', statut: 'En cours', lienAncienSheet: lien },
    { numero: '2121', client: 'ZETA', nom: '', statut: 'Terminé' },          // terminé et inconnu : pas ajouté
    { numero: '2105', client: 'ALPHA', nom: 'Autre nom', statut: 'Terminé', lienAncienSheet: lien },
    { numero: '2034', client: 'BETA', nom: '', statut: 'Terminé', lienAncienSheet: 'pas un lien' },
    { numero: '1004', client: 'X', nom: '', statut: 'Terminé' },             // ligne interne : intouchée
    { numero: 'PROJ-9', client: 'Y', nom: '', statut: 'En cours' }           // N° non numérique : ignoré
  ]);
  assert.deepEqual(c.ajouts, [{ code: '2120', nom: 'ORION – Lancement', lien }]);
  assert.deepEqual(c.archivages.map((a) => a.code), ['2105', '2034']);
  assert.deepEqual(c.liens.map((l) => [l.code, l.lien]), [['2105', lien]]);
  assert.equal(nomProjetAgence({ numero: 7 }), '7');
});

test('temps : projets clients au N° numérique, en jours à 2 décimales ; internes et codes libres non envoyés', () => {
  const recap = { minutesParJour: 420, projets: [
    { code: '2105', type: 'projet', minutes: 630 }, { code: '1004', type: 'interne', minutes: 420 },
    { code: 'ABC', type: 'projet', minutes: 60 }, { code: '2034', type: 'projet', minutes: 100 }, { code: '2050', type: 'projet', minutes: 0 }
  ] };
  assert.deepEqual(lignesTempsAgence(recap), [{ numero: '2105', jours: 1.5 }, { numero: '2034', jours: 0.24 }]);
});

test('réponse du collecteur : JSON attendu ; page HTML, code d\'erreur ou JSON inattendu → refus clair', () => {
  assert.deepEqual(lireReponseAgence(200, '{"succes":true,"donnees":[1]}'), { succes: true, donnees: [1] });
  assert.equal(lireReponseAgence(200, '<html>Connexion</html>').succes, false);
  assert.equal(lireReponseAgence(500, '').succes, false);
  assert.equal(lireReponseAgence(200, '{"ok":1}').succes, false);
});

function sourceFausse() {
  const appels = [];
  const ecrit = { modifications: [], ajouts: [] };
  return {
    appels, ecrit,
    async lireSheet() {
      return {
        reglages: interpreterReglages([['Début du suivi', '2026-10-01']]),
        projets: locaux,
        saisies: lireSaisies([['a', '2026-11-03', '09:00', '12:30', '210', '2105', 'manuel', '', '', 'non', ''],
          ['b', '2026-11-03', '14:00', '15:00', '60', '1004', 'manuel', '', '', 'non', '']])
      };
    },
    async appelerAgence(action, donnees) {
      appels.push({ action, donnees });
      return action === 'projets' ? [{ numero: '2120', client: 'ORION', nom: 'Lancement', statut: 'En cours' }, { numero: '2105', statut: 'Terminé' }]
        : { enregistres: donnees.lignes.length, ignores: [] };
    },
    async modifierPlages(_, m) { ecrit.modifications.push(...m); },
    async ajouterLignes(_, l, onglet) { ecrit.ajouts.push({ l, onglet }); }
  };
}

test('synchronisation : archivage (colonne D) et ajout en bas de l\'onglet Projets', async () => {
  const source = sourceFausse();
  const r = await synchroniserProjetsAgence({ idSheet: 'x', source });
  assert.deepEqual(r, { ajoutes: ['2120 ORION – Lancement'], archives: ['2105 ALPHA'], liens: [] });
  assert.deepEqual(source.ecrit.modifications, [{ plage: "'Projets'!D2", valeurs: [['archivé']] }]);
  assert.deepEqual(source.ecrit.ajouts, [{ l: [['2120', 'ORION – Lancement', 'projet', 'actif', '']], onglet: 'Projets' }]);
});

test('envoi des temps : mois à date, seulement les projets clients', async () => {
  const source = sourceFausse();
  const r = await envoyerTempsAgence({ idSheet: 'x', mois: '2026-11', aujourdhui: '2026-11-16', source });
  assert.deepEqual(source.appels[0], { action: 'temps', donnees: { mois: '2026-11', lignes: [{ numero: '2105', jours: 0.5 }] } });
  assert.deepEqual([r.envoyes, r.enregistres, r.dateLimite], [1, 1, '2026-11-16']);
});
