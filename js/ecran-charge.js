// Écran Charge : un mois (flèches), une carte par zone avec ses missions, une feuille pour modifier une zone,
// et « Dupliquer vers le mois suivant ».
import { h, icone, TRACES } from './dom.js';
import { t } from './textes.js';
import { nomMois, decalerMois } from './ecran-recap.js';

const COULEURS_ZONES = ['var(--projet-0)', 'var(--projet-interne)', 'var(--projet-1)', 'var(--projet-4)', 'var(--projet-2)'];
const TRACE_COPIER = 'M8 8h12v12H8zM16 8V4H4v12h4';

/**
 * vue : { mois, charge: { zones, enregistree, intitules, suivanteExiste } | null, erreur, feuille, confirmerDuplication, enCours }
 * actions : { changerMois(d), ouvrirZone(index), ajouterZone(), fermer(), choisirIntitule(i, texte), enregistrer(texte), retirer(), dupliquer() }
 */
export function ecranCharge(vue, actions) {
  const { charge } = vue;
  const missions = charge ? charge.zones.reduce((total, z) => total + z.elements.length, 0) : 0;
  return h('section', { class: 'ecran', 'aria-labelledby': 'titre-charge' },
    h('div', { class: 'barre-outils' },
      h('button', { class: 'bouton-texte', onclick: () => actions.changerMois(-1) },
        icone(TRACES.precedent, 20, 2.4), nomMois(decalerMois(vue.mois, -1)).split(' ')[0]),
      h('button', { class: 'bouton-texte', onclick: () => actions.changerMois(1) },
        nomMois(decalerMois(vue.mois, 1)).split(' ')[0], icone(TRACES.suivant, 20, 2.4))),
    h('header', { class: 'grand-titre' },
      h('h1', { id: 'titre-charge' }, t('charge.titre')),
      h('p', { class: 'secondaire' }, t('charge.sousTitre', { mois: nomMois(vue.mois), zones: charge?.zones.length ?? 0, missions }))),
    vue.erreur ? h('p', { class: 'note erreur', role: 'alert' }, vue.erreur) : null,
    !charge ? h('div', { class: 'ecran-centre petit' }, h('div', { class: 'roue', 'aria-hidden': 'true' })) : [
      charge.enregistree ? null : h('p', { class: 'note' }, t('charge.vide')),
      h('div', { class: 'zones' }, charge.zones.map((zone, i) => carteZone(zone, i, actions))),
      charge.zones.length < charge.intitules.length
        ? h('button', { class: 'bouton-secondaire bouton-ajout-zone', onclick: actions.ajouterZone }, `+ ${t('charge.ajouter')}`) : null,
      h('button', { class: `bouton-flottant${vue.confirmerDuplication ? ' bouton-alerte' : ''}`, onclick: actions.dupliquer, disabled: vue.enCours },
        icone(TRACE_COPIER, 18, 2.2),
        vue.confirmerDuplication
          ? t('charge.dupliquer.confirmer', { mois: nomMois(decalerMois(vue.mois, 1)).split(' ')[0] })
          : t('charge.dupliquer', { mois: nomMois(decalerMois(vue.mois, 1)).split(' ')[0].toLowerCase() }))
    ],
    vue.feuille && charge ? feuilleZone(vue.feuille, charge, actions) : null);
}

// « ACME - Brief le 16 » : le client (avant le premier tiret) en gras.
function mission(texte) {
  const morceaux = /^(.+?)\s+[-–—]\s+(.+)$/.exec(texte);
  return h('li', { class: 'mission' }, morceaux ? [h('strong', {}, morceaux[1]), ' ', h('span', { class: 'secondaire' }, morceaux[2])] : texte);
}

function carteZone(zone, index, actions) {
  return h('section', { class: 'carte zone' },
    h('div', { class: 'zone-entete' },
      h('span', { class: 'zone-pastille', style: { background: COULEURS_ZONES[index % COULEURS_ZONES.length] } }, String(zone.elements.length)),
      h('h2', {}, zone.categorie),
      h('button', { class: 'bouton-zone', onclick: () => actions.ouvrirZone(index), 'aria-label': t('charge.modifier', { zone: zone.categorie }) }, '···')),
    zone.elements.length
      ? h('ul', { class: 'missions' }, zone.elements.map(mission))
      : h('p', { class: 'secondaire zone-vide' }, t('charge.zone.vide')));
}

function feuilleZone(feuille, charge, actions) {
  const prises = charge.zones.filter((_, i) => i !== feuille.index).map((z) => z.categorie);
  const libres = charge.intitules.filter((c) => !prises.includes(c));
  const champ = h('textarea', { id: 'charge-missions', rows: 8, placeholder: t('charge.feuille.exemple') });
  champ.value = feuille.texte;
  return h('div', { class: 'voile', onclick: (e) => { if (e.target === e.currentTarget) actions.fermer(); } },
    h('section', { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'titre-zone', 'aria-busy': String(feuille.enCours) },
      h('span', { class: 'poignee', 'aria-hidden': 'true' }),
      h('div', { class: 'feuille-barre' },
        h('button', { class: 'bouton-texte', onclick: actions.fermer }, t('tri.fermer')),
        h('span', { class: 'feuille-compteur', id: 'titre-zone' }, t('charge.feuille.titre')),
        h('span')),
      h('div', { class: 'entete-section' }, h('h3', {}, t('charge.feuille.intitule'))),
      h('ul', { class: 'carte liste' }, libres.map((c) => h('li', {},
        h('button', { class: `ligne ligne-bouton${c === feuille.categorie ? ' actuel' : ''}`, onclick: () => actions.choisirIntitule(c, champ.value) },
          h('span', { class: 'ligne-texte' }, h('span', { class: 'ligne-titre' }, c)),
          c === feuille.categorie ? h('span', { class: 'ligne-duree' }, icone('M5 12.5l4.5 4.5L19 7.5', 18, 2.6)) : null)))),
      h('label', { class: 'entete-section', for: 'charge-missions' }, h('h3', {}, t('charge.feuille.missions'))),
      champ,
      feuille.erreur ? h('p', { class: 'erreur feuille-erreur', role: 'alert' }, feuille.erreur) : null,
      h('button', { class: 'bouton-principal', onclick: () => actions.enregistrer(champ.value), disabled: feuille.enCours }, t('charge.feuille.enregistrer')),
      feuille.index >= 0 ? h('button', { class: `bouton-secondaire bouton-danger${feuille.confirmerRetrait ? ' confirmer' : ''}`,
        onclick: actions.retirer, disabled: feuille.enCours },
      feuille.confirmerRetrait ? t('charge.feuille.retirer.confirmer') : t('charge.feuille.retirer')) : null,
      feuille.enCours ? h('div', { class: 'feuille-attente', 'aria-hidden': 'true' }, h('div', { class: 'roue' })) : null));
}
