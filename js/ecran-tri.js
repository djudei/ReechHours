// Feuille « Trier » : un créneau à la fois, on choisit son projet (ou Pause, Congé, Ignoré).
// Elle monte depuis le bas, par-dessus la semaine ; Échap ou « Fermer » la referme.
import { h, icone } from './dom.js';
import { t } from './textes.js';
import { CODES } from './regles.js';
import { duree, titreJour, couleurChoix, libelleChoix } from './format.js';
import { normaliser } from './regles.js';
import { LONGUEUR_MAX_TITRE } from './manuels.js';

const TRACE_COCHE = 'M5 12.5l4.5 4.5L19 7.5';
const TRACE_LOUPE = 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2';

/**
 * tri : { file: [{ date, creneau }], position, enCours, erreur }
 * projets : projets actifs, les plus utilisés de la semaine d'abord.
 * tri.mode : '' | 'renommer' | 'supprimer' (créneau ajouté à la main : renommer, ou suppression à confirmer)
 * actions : { choisir(choix), passer(), fermer(), renommer(titre?), supprimer() }
 */
export function feuilleTri(tri, projets, tousProjets, actions) {
  const { date, creneau } = tri.file[tri.position];
  const quand = creneau.journeeEntiere ? t('creneau.journee') : `${creneau.debut} – ${creneau.fin}`;
  const proposition = creneau.proposition && creneau.proposition !== creneau.choix ? creneau.proposition : '';
  const liste = h('ul', { class: 'carte liste liste-projets' },
    projets.map((p) => h('li', { 'data-recherche': normaliser(`${p.code} ${p.nom}`) },
      boutonChoix(p.code, tousProjets, creneau.choix, actions, tri.enCours))));
  const filtrer = (evenement) => {
    const cherche = normaliser(evenement.target.value);
    liste.querySelectorAll('li').forEach((li) => { li.hidden = Boolean(cherche) && !li.dataset.recherche.includes(cherche); });
  };

  return h('div', { class: 'voile', onclick: (e) => { if (e.target === e.currentTarget) actions.fermer(); } },
    h('section', { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'titre-tri', 'aria-busy': String(tri.enCours) },
      h('span', { class: 'poignee', 'aria-hidden': 'true' }),
      h('div', { class: 'feuille-barre' },
        h('button', { class: 'bouton-texte', onclick: actions.fermer }, t('tri.fermer')),
        h('span', { class: 'feuille-compteur' }, tri.file.length > 1
          ? t('tri.compteur', { rang: tri.position + 1, total: tri.file.length }) : ''),
        tri.file.length > 1
          ? h('button', { class: 'bouton-texte', onclick: actions.passer, disabled: tri.enCours }, t('tri.passer'))
          : h('span')),
      h('div', { class: 'feuille-entete' },
        h('span', { class: 'surtitre' }, `${titreJour(date)} · ${quand}`),
        h('h2', { id: 'titre-tri' }, creneau.titre || '—'),
        h('span', { class: 'secondaire' }, `${duree(creneau.minutes)} · ${creneau.manuel ? t('creneau.manuel') : t('tri.depuisAgenda')}`),
        creneau.choix ? h('span', { class: 'secondaire' }, t('tri.actuel', { choix: libelleChoix(creneau.choix, tousProjets) })) : null),
      creneau.manuel ? blocManuel(tri, creneau, actions) : null,
      tri.erreur ? h('p', { class: 'erreur feuille-erreur', role: 'alert' }, tri.erreur) : null,
      proposition ? h('button', { class: 'bouton-proposition', onclick: () => actions.choisir(proposition), disabled: tri.enCours },
        h('span', { class: 'pastille pastille-claire' }),
        h('span', { class: 'ligne-texte' },
          h('span', { class: 'ligne-titre' }, libelleChoix(proposition, tousProjets)),
          h('span', { class: 'proposition-note' }, t('tri.propose'))),
        icone(TRACE_COCHE, 22, 2.6)) : null,
      h('label', { class: 'recherche' },
        icone(TRACE_LOUPE, 18, 2.2),
        h('input', { type: 'search', 'aria-label': t('tri.chercher'), placeholder: t('tri.chercher'), oninput: filtrer })),
      h('div', { class: 'entete-section' }, h('h3', {}, t('tri.projets'))),
      liste,
      h('div', { class: 'choix-speciaux' },
        [CODES.PAUSE, CODES.NON_TRAVAILLE, CODES.IGNORE].map((code) => h('button', {
          class: `bouton-secondaire${creneau.choix === code ? ' actif' : ''}`, onclick: () => actions.choisir(code), disabled: tri.enCours
        }, t(`tri.special.${code}`)))),
      tri.enCours ? h('div', { class: 'feuille-attente', 'aria-hidden': 'true' }, h('div', { class: 'roue' })) : null));
}

// Créneau ajouté à la main : le renommer, ou le supprimer (deuxième appui pour confirmer).
function blocManuel(tri, creneau, actions) {
  if (tri.mode === 'renommer') {
    const champ = h('input', { type: 'text', value: creneau.titre, maxlength: LONGUEUR_MAX_TITRE, 'aria-label': t('manuel.intitule') });
    const valider = (evenement) => { evenement.preventDefault(); actions.renommer(champ.value); };
    setTimeout(() => champ.select(), 0);
    return h('form', { class: 'renommage', onsubmit: valider },
      champ,
      h('button', { class: 'bouton-principal bouton-petit', type: 'submit', disabled: tri.enCours }, t('manuel.renommer.ok')));
  }
  const confirmer = tri.mode === 'supprimer';
  return h('div', { class: 'actions-manuel' },
    h('button', { class: 'bouton-secondaire', onclick: () => actions.renommer(), disabled: tri.enCours }, t('manuel.renommer')),
    h('button', { class: `bouton-secondaire bouton-danger${confirmer ? ' confirmer' : ''}`, onclick: actions.supprimer, disabled: tri.enCours },
      confirmer ? t('manuel.supprimer.confirmer') : t('manuel.supprimer')));
}

function boutonChoix(code, tousProjets, choixActuel, actions, enCours) {
  return h('button', { class: `ligne ligne-bouton${code === choixActuel ? ' actuel' : ''}`, onclick: () => actions.choisir(code), disabled: enCours },
    h('span', { class: 'pastille', style: { background: couleurChoix(code, tousProjets) } }),
    h('span', { class: 'ligne-texte' }, h('span', { class: 'ligne-titre' }, libelleChoix(code, tousProjets))),
    code === choixActuel ? h('span', { class: 'ligne-duree' }, icone(TRACE_COCHE, 18, 2.6)) : null);
}

/**
 * Projets actifs, classés par numéro (« 2 » avant « 10 » : comparaison des nombres dans le texte).
 */
export function projetsPourTri(projets) {
  return projets
    .filter((p) => p.statut === 'actif')
    .sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true, sensitivity: 'base' }));
}
