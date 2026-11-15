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
 * actions : { choisir(choix) (appelé par « Valider »), passer(), fermer(), renommer(titre?), supprimer() }
 */
export function feuilleTri(tri, projets, tousProjets, actions) {
  const { date, creneau } = tri.file[tri.position];
  const quand = creneau.journeeEntiere ? t('creneau.journee') : `${creneau.debut} – ${creneau.fin}`;
  const proposition = creneau.proposition && creneau.proposition !== creneau.choix ? creneau.proposition : '';
  // Un appui sur un projet (ou Pause, Congé, Ignoré) le met en surbrillance ; « Valider » l'enregistre.
  // Au départ : le choix actuel du créneau, sinon rien.
  // Le choix en cours est gardé dans `tri` : un nouvel affichage de la fenêtre ne le perd pas.
  if (tri.selection?.position !== tri.position) tri.selection = { position: tri.position, code: creneau.choix || null };
  let selection = tri.selection.code;
  const boutons = [];   // [{ code, bouton, classe }]
  const valider = h('button', { class: 'bouton-principal bouton-large bouton-collant', disabled: true,
    onclick: () => { if (selection) actions.choisir(selection); } }, t('tri.valider'));
  const montrer = () => {
    boutons.forEach(({ code, bouton, classe }) => {
      bouton.classList.toggle(classe, code === selection);
      bouton.setAttribute('aria-pressed', String(code === selection));
    });
    valider.disabled = tri.enCours || !selection;
  };
  const choisir = (code) => () => { selection = selection === code ? null : code; tri.selection.code = selection; montrer(); };
  const retenir = (code, bouton, classe) => { boutons.push({ code, bouton, classe }); return bouton; };
  const liste = h('ul', { class: 'carte liste liste-projets' },
    projets.map((p) => h('li', { 'data-recherche': normaliser(`${p.code} ${p.nom}`) },
      retenir(p.code, boutonChoix(p.code, tousProjets, choisir(p.code), tri.enCours), 'actuel'))));
  const filtrer = (evenement) => {
    const cherche = normaliser(evenement.target.value);
    liste.querySelectorAll('li').forEach((li) => { li.hidden = Boolean(cherche) && !li.dataset.recherche.includes(cherche); });
  };

  const feuille = h('div', { class: 'voile', onclick: (e) => { if (e.target === e.currentTarget) actions.fermer(); } },
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
      proposition ? retenir(proposition, h('button', { class: 'bouton-proposition', onclick: choisir(proposition), disabled: tri.enCours },
        h('span', { class: 'pastille pastille-claire' }),
        h('span', { class: 'ligne-texte' },
          h('span', { class: 'ligne-titre' }, libelleChoix(proposition, tousProjets)),
          h('span', { class: 'proposition-note' }, t('tri.propose'))),
        icone(TRACE_COCHE, 22, 2.6)), 'actif') : null,
      h('label', { class: 'recherche' },
        icone(TRACE_LOUPE, 18, 2.2),
        h('input', { type: 'search', 'aria-label': t('tri.chercher'), placeholder: t('tri.chercher'), oninput: filtrer })),
      h('div', { class: 'entete-section' }, h('h3', {}, t('tri.projets'))),
      liste,
      h('div', { class: 'choix-speciaux' },
        [CODES.PAUSE, CODES.NON_TRAVAILLE, CODES.IGNORE].map((code) => retenir(code, h('button', {
          class: 'bouton-secondaire', onclick: choisir(code), disabled: tri.enCours
        }, t(`tri.special.${code}`)), 'actif'))),
      valider,
      tri.enCours ? h('div', { class: 'feuille-attente', 'aria-hidden': 'true' }, h('div', { class: 'roue' })) : null));
  montrer();
  return feuille;
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

function boutonChoix(code, tousProjets, onclick, enCours) {
  return h('button', { class: 'ligne ligne-bouton', onclick, disabled: enCours },
    h('span', { class: 'pastille', style: { background: couleurChoix(code, tousProjets) } }),
    h('span', { class: 'ligne-texte' }, h('span', { class: 'ligne-titre' }, libelleChoix(code, tousProjets))),
    h('span', { class: 'ligne-duree coche', 'aria-hidden': 'true' }, icone(TRACE_COCHE, 18, 2.6)));
}

/**
 * Projets actifs, classés par numéro (« 2 » avant « 10 » : comparaison des nombres dans le texte).
 */
// Ordre des listes de choix : projets clients d'abord, puis les autres catégories, les lignes internes en dernier
// (Pause, Congé et Ignoré viennent après, en boutons). Dans chaque groupe, par N°.
const ORDRE_TYPES = { projet: 0, autre: 1, interne: 2 };

export function projetsPourTri(projets) {
  const rang = (p) => ORDRE_TYPES[p.type] ?? 1;
  return projets
    .filter((p) => p.statut === 'actif')
    .sort((a, b) => rang(a) - rang(b) || a.code.localeCompare(b.code, 'fr', { numeric: true, sensitivity: 'base' }));
}
