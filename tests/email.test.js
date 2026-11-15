// Brouillon d'email du récap : contenu (temps, synthèse, charge) et mise en forme Gmail (accents gardés).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireEmail, messageBrut } from '../js/email.js';
import { interpreterReglages } from '../js/regles.js';

const recap = {
  mois: '2026-10', dateLimite: null, avecBase: true, minutesParJour: 420,
  projets: [
    { code: '2116', nom: 'ALPHA', type: 'projet', minutes: 1260 },
    { code: '2009', nom: 'BÉTA', type: 'projet', minutes: 840 },
    { code: '1004', nom: 'Développement commercial', type: 'interne', minutes: 210 }
  ],
  totalTravailleMinutes: 2310, totalBaseMinutes: 2100, totalEcartMinutes: 210, nonTravailleMinutes: 420, aAttribuerMinutes: 30
};
const reglages = interpreterReglages([['Nom dans les docs', 'Camille D'], ['Prénom destinataire', 'Alix'], ['Email destinataire', 'alix@exemple.fr']]);
const charge = { mois: '2026-11', aVenir: true, zones: [
  { categorie: 'Projets en cours', elements: ['ALPHA - refonte', '• BÉTA'] },
  { categorie: 'AO & Reco', elements: [] }
] };

test('email : destinataire, sujet, synthèse, projets clients puis internes par N°, charge à venir', () => {
  const e = construireEmail({ recap, reglages, charge });
  assert.equal(e.a, 'alix@exemple.fr');
  assert.equal(e.sujet, 'Récap temps Octobre 2026 – Camille D');
  const c = e.corps;
  assert.match(c, /^Bonjour Alix,\n\nVoici mon récap de temps d'octobre 2026\./);
  assert.match(c, /Travaillé : 38 h 30 \(5,50 j\)/);
  assert.match(c, /Base : 35 h \(5,00 j\)/);
  assert.match(c, /Au-delà : \+3 h 30 \(0,50 j\)/);
  assert.match(c, /Congés : 1,00 j/);
  assert.match(c, /Encore à attribuer : 30 min \(non compté\)/);
  assert.ok(c.indexOf('- 2009 · BÉTA') < c.indexOf('- 2116 · ALPHA'), 'clients par N°');
  assert.ok(c.indexOf('- 2116 · ALPHA') < c.indexOf('Lignes internes'), 'clients avant internes');
  assert.match(c, /Charge à venir – Novembre 2026\n\nProjets en cours\n- ALPHA - refonte\n- BÉTA/);
  assert.doesNotMatch(c, /AO & Reco/);   // zone vide : absente
  assert.match(c, /\n\nCamille D$/);
});

test('email : sans destinataire ni charge, mois en cours « arrêté au » ; en dessous de la base', () => {
  const e = construireEmail({
    recap: { ...recap, dateLimite: '2026-10-16', totalEcartMinutes: -60, aAttribuerMinutes: 0, nonTravailleMinutes: 0 },
    reglages: interpreterReglages([['Nom dans les docs', 'Camille D'], ['Signature email', 'Camille, cheffe de projet']]),
    charge: { mois: '2026-10', aVenir: false, zones: [] }
  });
  assert.equal(e.a, '');
  assert.match(e.corps, /^Bonjour,\n/);
  assert.match(e.corps, /d'octobre 2026 \(arrêté au 16\/10\)\./);
  assert.match(construireEmail({ recap: { ...recap, mois: '2026-11' }, reglages, charge: null }).corps, /temps de novembre 2026\./);
  assert.match(e.corps, /En dessous : −1 h \(0,14 j\)/);
  assert.doesNotMatch(e.corps, /Charge|Congés|attribuer/);
  assert.match(e.corps, /Camille, cheffe de projet$/);
});

test('message Gmail : en-têtes, sujet et corps encodés en UTF-8, base64 « url »', () => {
  const brut = messageBrut({ a: 'alix@exemple.fr', sujet: 'Récap temps', corps: 'Ligne é\nLigne 2' });
  assert.doesNotMatch(brut, /[+/=]/);
  const message = Buffer.from(brut.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert.match(message, /^To: alix@exemple\.fr\r\nSubject: =\?UTF-8\?B\?/);
  const sujet = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(message)[1];
  assert.equal(Buffer.from(sujet, 'base64').toString('utf8'), 'Récap temps');
  const corps = message.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  assert.equal(Buffer.from(corps, 'base64').toString('utf8'), 'Ligne é\r\nLigne 2');
  assert.doesNotMatch(messageBrut({ a: '', sujet: 'x', corps: 'y' }), /^VG86/);   // pas de « To: » vide
});
