// Petits écrans : connexion, choix du Sheet, chargement, erreur, « bientôt ici ».
import { h, icone, TRACES } from './dom.js';
import { t } from './textes.js';
import { LIEN_APPLI_ACTUELLE } from './config.js';

export function ecranConnexion({ configure, onConnecter, enCours }) {
  return h('section', { class: 'ecran ecran-centre' },
    h('img', { class: 'logo logo-image', src: 'img/icone-192.png', alt: '' }),
    h('h1', {}, t('connexion.titre')),
    h('p', { class: 'secondaire' }, t('connexion.texte')),
    configure
      ? h('button', { class: 'bouton-principal', onclick: onConnecter, disabled: enCours },
        enCours ? t('connexion.encours') : t('connexion.bouton'))
      : h('p', { class: 'note signal' }, t('config.manquante')),
    h('a', { class: 'lien', href: '?demo' }, t('connexion.demo')));
}

export function ecranSheet({ onCreer, onValider, erreur, enCours, formulaireOuvert, onOuvrirFormulaire }) {
  const champ = h('input', { id: 'lien-sheet', type: 'url', inputmode: 'url', autocomplete: 'off',
    placeholder: 'https://docs.google.com/spreadsheets/d/…' });
  const envoyer = (evenement) => {
    evenement.preventDefault();
    onValider(champ.value);
  };
  return h('section', { class: 'ecran ecran-centre' },
    h('img', { class: 'logo logo-image', src: 'img/icone-192.png', alt: '' }),
    h('h1', {}, t('sheet.titre')),
    h('p', { class: 'secondaire' }, t('sheet.creer.texte')),
    erreur ? h('p', { class: 'erreur', role: 'alert' }, erreur) : null,
    h('button', { class: 'bouton-principal', onclick: onCreer, disabled: enCours }, enCours ? t('sheet.creer.encours') : t('sheet.creer')),
    formulaireOuvert
      ? h('form', { class: 'formulaire', onsubmit: envoyer },
        h('p', { class: 'secondaire' }, t('sheet.texte')),
        h('label', { for: 'lien-sheet', class: 'etiquette' }, t('sheet.champ')),
        champ,
        h('button', { class: 'bouton-principal bouton-secondaire-plein', type: 'submit', disabled: enCours }, t('sheet.bouton')))
      : h('button', { class: 'bouton-texte', onclick: onOuvrirFormulaire }, t('sheet.dejaUn')));
}

export function ecranChargement() {
  return h('section', { class: 'ecran ecran-centre', 'aria-busy': 'true' },
    h('div', { class: 'roue', 'aria-hidden': 'true' }),
    h('p', { class: 'secondaire' }, t('semaine.chargement')));
}

export function ecranErreur({ message, onReessayer, onChangerSheet }) {
  return h('section', { class: 'ecran ecran-centre' },
    h('h1', {}, t('erreur.titre')),
    h('p', { class: 'erreur', role: 'alert' }, message),
    h('button', { class: 'bouton-principal', onclick: onReessayer }, t('erreur.reessayer')),
    onChangerSheet ? h('button', { class: 'bouton-texte', onclick: onChangerSheet }, t('sheet.changer')) : null);
}

export function ecranBientot(onglet) {
  return h('section', { class: 'ecran ecran-centre' },
    h('div', { class: 'logo logo-gris', 'aria-hidden': 'true' }, icone(TRACES[onglet], 30, 1.8)),
    h('h1', {}, t('bientot.titre')),
    h('p', { class: 'secondaire' }, t('bientot.texte')),
    LIEN_APPLI_ACTUELLE ? h('a', { class: 'bouton-principal', href: LIEN_APPLI_ACTUELLE, target: '_blank', rel: 'noopener' }, t('bientot.lien')) : null);
}

/**
 * Barre d'onglets du bas : 5 onglets, l'actif en couleur.
 */
export function barreOnglets(actif, onChoisir) {
  const onglets = ['agenda', 'charge', 'projets', 'recap', 'reglages'];
  return h('nav', { class: 'barre-onglets', 'aria-label': t('appli.nom') },
    onglets.map((onglet) => h('button', {
      class: `onglet${onglet === actif ? ' actif' : ''}`,
      'aria-current': onglet === actif ? 'page' : null,
      onclick: () => onChoisir(onglet)
    }, icone(TRACES[onglet], 26, 1.8), t(`onglet.${onglet}`))));
}
