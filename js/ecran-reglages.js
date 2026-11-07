// Écran Réglages, façon Réglages de l'iPhone : groupes de lignes.
// Mêmes réglages que Timesheets+ (nom dans les docs, initiales, poste, destinataire du récap).
// Les valeurs restent dans les champs jusqu'à « Enregistrer les réglages » (un seul enregistrement, tout vérifié).
import { h } from './dom.js';
import { t } from './textes.js';
import { initialesProposees } from './reglages-edition.js';

const enDateFr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * vue : { enCours, erreur, saisie } ; actions : { enregistrer(saisie), ouvrirSheet(), changerSheet(), deconnecter() }
 */
export function ecranReglages(reglagesSheet, vue, actions, { demo }) {
  // Après une erreur, le formulaire garde ce qui a été tapé.
  const r = { ...reglagesSheet, ...(vue.saisie || {}) };
  const champ = (id, valeur, attributs = {}) => h('input', { id, type: 'text', value: valeur ?? '', ...attributs });
  const nomDocs = champ('reglage-nom', r.nomDocs, { maxlength: 60, autocomplete: 'name', placeholder: 'ex. Julien M' });
  const initiales = champ('reglage-initiales', r.initiales, { maxlength: 5, autocapitalize: 'characters', placeholder: initialesProposees(r.nomDocs) || 'JM' });
  const poste = champ('reglage-poste', r.posteDocs, { maxlength: 60, placeholder: 'ex. Account manager' });
  const prenomDest = champ('reglage-prenom-dest', r.prenomDestinataire, { maxlength: 60 });
  const emailDest = champ('reglage-email-dest', r.emailDestinataire, { type: 'email', inputmode: 'email', autocapitalize: 'off', maxlength: 120 });
  nomDocs.addEventListener('input', () => { initiales.placeholder = initialesProposees(nomDocs.value) || 'JM'; });

  const enregistrer = (evenement) => {
    evenement.preventDefault();
    actions.enregistrer({
      nomDocs: nomDocs.value, initiales: initiales.value, posteDocs: poste.value,
      prenomDestinataire: prenomDest.value, emailDestinataire: emailDest.value
    });
  };
  const ligne = (id, libelle, element) => h('label', { class: 'champ-ligne', for: id }, h('span', {}, libelle), element);
  const groupe = (titre, ...contenu) => [h('div', { class: 'entete-section' }, h('h2', {}, titre)), h('div', { class: 'carte liste formulaire-manuel groupe-reglages' }, ...contenu)];
  const aide = (texte) => h('p', { class: 'note note-reglages' }, texte);
  const info = (libelle, valeur) => h('div', { class: 'champ-ligne' }, h('span', {}, libelle), h('span', { class: 'secondaire' }, valeur));

  return h('section', { class: 'ecran', 'aria-labelledby': 'titre-reglages' },
    h('div', { class: 'barre-outils' }),
    h('header', { class: 'grand-titre' }, h('h1', { id: 'titre-reglages' }, t('reglages.titre'))),
    vue.bienvenue ? h('p', { class: 'note bienvenue' }, t('reglages.bienvenue')) : null,
    h('form', { class: 'formulaire-reglages', onsubmit: enregistrer },
      groupe(t('reglages.toi'),
        ligne('reglage-nom', t('reglages.nomDocs'), nomDocs),
        ligne('reglage-initiales', t('reglages.initiales'), initiales),
        ligne('reglage-poste', t('reglages.posteDocs'), poste)),
      aide(t('reglages.nomDocs.aide')),
      groupe(t('reglages.partage'),
        ligne('reglage-prenom-dest', t('reglages.prenomDestinataire'), prenomDest),
        ligne('reglage-email-dest', t('reglages.emailDestinataire'), emailDest)),
      aide(t('reglages.partage.aide')),
      vue.erreur ? h('p', { class: 'note erreur', role: 'alert' }, vue.erreur) : null,
      h('button', { class: 'bouton-principal bouton-large', type: 'submit', disabled: vue.enCours }, t('reglages.enregistrer'))),
    ...groupe(t('reglages.temps'),
      info(t('reglages.debutSuivi'), enDateFr(reglagesSheet.debutSuivi) || '—'),
      info(t('reglages.regleAgence'), t('reglages.regleAgence.valeur'))),
    aide(t('reglages.temps.aide')),
    ...groupe(t('reglages.sheet'),
      demo ? null : h('button', { class: 'ligne ligne-bouton lien-ligne', type: 'button', onclick: actions.ouvrirSheet }, t('reglages.ouvrirSheet')),
      demo ? null : h('button', { class: 'ligne ligne-bouton lien-ligne', type: 'button', onclick: actions.changerSheet }, t('reglages.changerSheet')),
      demo ? null : h('button', { class: 'ligne ligne-bouton lien-ligne bouton-danger', type: 'button', onclick: actions.deconnecter }, t('reglages.deconnecter'))));
}
