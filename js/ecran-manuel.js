// Feuille « Nouveau créneau » : intitulé, début, fin, puis un appui sur le projet l'enregistre.
import { h } from './dom.js';
import { t } from './textes.js';
import { titreJour, couleurChoix, libelleChoix } from './format.js';
import { LONGUEUR_MAX_TITRE } from './manuels.js';

const PAS_MINUTES = 15;
const DUREE_PAR_DEFAUT = 60;
const DEBUT_PAR_DEFAUT = 9 * 60;
const MINUTES_DANS_JOURNEE = 24 * 60;

const enHeure = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Heures proposées : aujourd'hui, le quart d'heure qui vient ; un autre jour, 9 h. Durée 1 h.
 */
export function heuresParDefaut(date, aujourdhui, maintenant = new Date()) {
  let debut = DEBUT_PAR_DEFAUT;
  if (date === aujourdhui) {
    const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
    debut = Math.min(Math.ceil(minutes / PAS_MINUTES) * PAS_MINUTES, MINUTES_DANS_JOURNEE - DUREE_PAR_DEFAUT);
  }
  return { debut: enHeure(debut), fin: enHeure(debut + DUREE_PAR_DEFAUT) };
}

/**
 * nouveau : { date, debut, fin, titre, enCours, erreur }
 * actions : { creer(choix, { titre, debut, fin }), fermer() }
 */
export function feuilleNouveau(nouveau, projets, tousProjets, actions) {
  const titre = h('input', { id: 'manuel-titre', type: 'text', value: nouveau.titre, maxlength: LONGUEUR_MAX_TITRE,
    placeholder: t('manuel.intitule.exemple') });
  const debut = h('input', { id: 'manuel-debut', type: 'time', step: PAS_MINUTES * 60, value: nouveau.debut });
  const fin = h('input', { id: 'manuel-fin', type: 'time', step: PAS_MINUTES * 60, value: nouveau.fin });
  const creer = (choix) => actions.creer(choix, { titre: titre.value, debut: debut.value, fin: fin.value });

  return h('div', { class: 'voile', onclick: (e) => { if (e.target === e.currentTarget) actions.fermer(); } },
    h('section', { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'titre-nouveau', 'aria-busy': String(nouveau.enCours) },
      h('span', { class: 'poignee', 'aria-hidden': 'true' }),
      h('div', { class: 'feuille-barre' },
        h('button', { class: 'bouton-texte', onclick: actions.fermer }, t('tri.fermer')),
        h('span', { class: 'feuille-compteur', id: 'titre-nouveau' }, t('manuel.titre')),
        h('span')),
      h('div', { class: 'feuille-entete' }, h('span', { class: 'surtitre' }, titreJour(nouveau.date))),
      h('div', { class: 'carte liste formulaire-manuel' },
        h('label', { class: 'champ-ligne', for: 'manuel-titre' }, h('span', {}, t('manuel.intitule')), titre),
        h('label', { class: 'champ-ligne', for: 'manuel-debut' }, h('span', {}, t('manuel.debut')), debut),
        h('label', { class: 'champ-ligne', for: 'manuel-fin' }, h('span', {}, t('manuel.fin')), fin)),
      nouveau.erreur ? h('p', { class: 'erreur feuille-erreur', role: 'alert' }, nouveau.erreur) : null,
      h('div', { class: 'entete-section' }, h('h3', {}, t('manuel.projet'))),
      h('ul', { class: 'carte liste liste-projets' },
        projets.map((p) => h('li', {}, h('button', { class: 'ligne ligne-bouton', onclick: () => creer(p.code), disabled: nouveau.enCours },
          h('span', { class: 'pastille', style: { background: couleurChoix(p.code, tousProjets) } }),
          h('span', { class: 'ligne-texte' }, h('span', { class: 'ligne-titre' }, libelleChoix(p.code, tousProjets))))))),
      h('button', { class: 'bouton-secondaire', onclick: () => creer(''), disabled: nouveau.enCours }, t('manuel.sansProjet')),
      nouveau.enCours ? h('div', { class: 'feuille-attente', 'aria-hidden': 'true' }, h('div', { class: 'roue' })) : null));
}
