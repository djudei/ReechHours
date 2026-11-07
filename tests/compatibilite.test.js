// Compatibilité avec Timesheets+ : un Sheet déjà rempli par l'appli Apps Script est relu tel quel,
// et une réunion déjà enregistrée n'est JAMAIS ajoutée une deuxième fois (sinon le temps compterait double).
// Données inventées, à la forme exacte du vrai Sheet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerSemaine } from '../js/donnees.js';
import { interpreterReglages, lireProjets, lireSaisies } from '../js/regles.js';
import { evenementDepuisApi } from '../js/semaine.js';

const REGLAGES = [['Réglage', 'Valeur'], ['Nom dans les docs', 'Camille D'], ['Début du suivi', '2026-10-01'], ['Initiales', 'CD']];
const PROJETS = [['2105', 'ALPHA', 'projet', 'actif', ''], ['1004', 'Développement commercial', 'interne', 'actif ', '']];
// Lundi 2 novembre 2026, 09:30–10:00 (heure de Paris) : id = iCalUID + « _ » + début en millisecondes (comme Code.gs).
const debut = new Date('2026-11-02T09:30:00+01:00');
const fin = new Date('2026-11-02T10:00:00+01:00');
const ID = `abc123@google.com_${debut.getTime()}`;
const SAISIES = [['s1', '2026-11-02', '09:30', '10:00', '30', '2105', 'agenda', ID, 'ALPHA | weekly', 'oui', '2026-11-02 10:01:00']];

function sourceFausse() {
  const ecrit = { ajouts: [], modifications: [] };
  return {
    ecrit,
    async lireSheet() {
      return { reglages: interpreterReglages(REGLAGES), projets: lireProjets(PROJETS), saisies: lireSaisies(SAISIES) };
    },
    async lireEvenements() {
      return [{ iCalUID: 'abc123@google.com', summary: 'ALPHA | weekly', start: { dateTime: debut.toISOString() }, end: { dateTime: fin.toISOString() } },
        { iCalUID: 'nouveau@google.com', summary: 'ALPHA | atelier', start: { dateTime: '2026-11-03T14:00:00+01:00' }, end: { dateTime: '2026-11-03T15:00:00+01:00' } }].map(evenementDepuisApi);
    },
    async ajouterLignes(_, lignes) { ecrit.ajouts.push(...lignes); },
    async modifierPlages(_, m) { ecrit.modifications.push(...m); }
  };
}

test('Sheet Timesheets+ : la réunion déjà enregistrée est reconnue, seule la nouvelle est ajoutée, en mots français', async () => {
  const source = sourceFausse();
  const semaine = await chargerSemaine({ lundi: '2026-11-02', idSheet: 'x', aujourdhui: '2026-11-04', source });
  assert.equal(semaine.reglages.prenom, 'Camille D');
  const lundi = semaine.jours[0].creneaux.find((c) => c.titre === 'ALPHA | weekly');
  assert.equal(lundi.choix, '2105');
  assert.equal(source.ecrit.ajouts.length, 1);   // seulement la réunion du mardi
  const [ligne] = source.ecrit.ajouts;
  assert.equal(ligne[5], '2105');          // pré-attribuée par le titre
  assert.equal(ligne[6], 'agenda');
  assert.equal(ligne[7], `nouveau@google.com_${new Date('2026-11-03T14:00:00+01:00').getTime()}`);
  assert.equal(ligne[9], 'oui');
  assert.equal(source.ecrit.modifications.length, 0);
});
