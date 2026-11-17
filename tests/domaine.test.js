// Connexion réservée aux adresses de l'agence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adresseAutorisee, DOMAINE_AUTORISE } from '../js/config.js';

test('seules les adresses @reech.com sont acceptées', () => {
  assert.equal(DOMAINE_AUTORISE, 'reech.com');
  assert.equal(adresseAutorisee('julien@reech.com'), true);
  assert.equal(adresseAutorisee(' Alix@Reech.com '), true);
  assert.equal(adresseAutorisee('pirate@gmail.com'), false);
  assert.equal(adresseAutorisee('x@reech.com.pirate.io'), false);
  assert.equal(adresseAutorisee('x@sous.reech.com'), false);
  assert.equal(adresseAutorisee('@reech.com'), false);
  assert.equal(adresseAutorisee(''), false);
});
