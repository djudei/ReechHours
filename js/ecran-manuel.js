// Feuille « Nouveau créneau » : intitulé, début, fin, puis un appui sur le projet l'enregistre.
import { h, icone } from './dom.js';
import { t } from './textes.js';
import { titreJour, couleurChoix, libelleChoix } from './format.js';
import { LONGUEUR_MAX_TITRE } from './manuels.js';
import { CODES } from './regles.js';

const PAS_MINUTES = 15;
const DUREE_PAR_DEFAUT = 60;
const DEBUT_PAR_DEFAUT = 9 * 60;
const MINUTES_DANS_JOURNEE = 24 * 60;

const enHeure = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Appui sur une zone vide de la grille, à `minutes` depuis minuit : le créneau commence au quart d'heure touché
 * (arrondi en dessous) et dure 1 h, sans dépasser minuit.
 */
export function heuresDepuisAppui(minutes) {
  const dernier = MINUTES_DANS_JOURNEE - 2 * PAS_MINUTES;   // 23:30 au plus tard
  const debut = Math.max(0, Math.min(Math.floor(minutes / PAS_MINUTES) * PAS_MINUTES, dernier));
  // Le champ heure de l'iPhone n'affiche pas « 24:00 » : fin à 23:45 au plus tard.
  const fin = Math.min(debut + DUREE_PAR_DEFAUT, MINUTES_DANS_JOURNEE - PAS_MINUTES);
  return { debut: enHeure(debut), fin: enHeure(fin) };
}

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
 * nouveau.choix : projet déjà choisi (après une erreur, pour le garder en surbrillance)
 * actions : { creer(choix, { titre, debut, fin, choix }), fermer() }
 */
export function feuilleNouveau(nouveau, projets, tousProjets, actions) {
  const titre = h('input', { id: 'manuel-titre', type: 'text', value: nouveau.titre, maxlength: LONGUEUR_MAX_TITRE,
    placeholder: t('manuel.intitule.exemple') });
  const debut = h('input', { id: 'manuel-debut', type: 'time', step: PAS_MINUTES * 60, value: nouveau.debut });
  const fin = h('input', { id: 'manuel-fin', type: 'time', step: PAS_MINUTES * 60, value: nouveau.fin });
  // Ce qui est tapé est gardé dans `nouveau` : un nouvel affichage de la fenêtre ne l'efface pas.
  [[titre, 'titre'], [debut, 'debut'], [fin, 'fin']].forEach(([champ, cle]) => champ.addEventListener('input', () => { nouveau[cle] = champ.value; }));
  // Un appui sur un projet (ou Pause, Congé, Ignoré) le met en surbrillance ; rien n'est enregistré
  // avant « Enregistrer ». Un deuxième appui sur le même choix le retire.
  let choix = nouveau.choix ?? null;
  const lignes = new Map();
  const speciaux = new Map();
  const enregistrer = h('button', { class: 'bouton-principal bouton-large bouton-collant', disabled: nouveau.enCours,
    onclick: () => actions.creer(choix ?? '', { titre: titre.value, debut: debut.value, fin: fin.value, choix: choix ?? '' }) });
  const montrer = () => {
    lignes.forEach((ligne, code) => {
      const actif = code === choix;
      ligne.classList.toggle('actuel', actif);
      ligne.setAttribute('aria-pressed', String(actif));
    });
    speciaux.forEach((bouton, code) => {
      bouton.classList.toggle('actif', code === choix);
      bouton.setAttribute('aria-pressed', String(code === choix));
    });
    enregistrer.textContent = choix ? t('manuel.enregistrer') : t('manuel.sansProjet');
  };
  const choisir = (code) => () => { choix = choix === code ? null : code; nouveau.choix = choix; montrer(); };
  const coche = () => h('span', { class: 'ligne-duree coche', 'aria-hidden': 'true' }, icone('M5 12.5l4.5 4.5L19 7.5', 18, 2.6));

  const contenu = h('div', { class: 'voile', onclick: (e) => { if (e.target === e.currentTarget) actions.fermer(); } },
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
        projets.map((p) => {
          const ligne = h('button', { class: 'ligne ligne-bouton', onclick: choisir(p.code), disabled: nouveau.enCours },
            h('span', { class: 'pastille', style: { background: couleurChoix(p.code, tousProjets) } }),
            h('span', { class: 'ligne-texte' }, h('span', { class: 'ligne-titre' }, libelleChoix(p.code, tousProjets))),
            coche());
          lignes.set(p.code, ligne);
          return h('li', {}, ligne);
        })),
      // Mêmes choix spéciaux que la fenêtre « Trier » : Pause, Congé, Ignoré.
      h('div', { class: 'choix-speciaux' },
        [CODES.PAUSE, CODES.NON_TRAVAILLE, CODES.IGNORE].map((code) => {
          const bouton = h('button', { class: 'bouton-secondaire', onclick: choisir(code), disabled: nouveau.enCours }, t(`tri.special.${code}`));
          speciaux.set(code, bouton);
          return bouton;
        })),
      enregistrer,
      nouveau.enCours ? h('div', { class: 'feuille-attente', 'aria-hidden': 'true' }, h('div', { class: 'roue' })) : null));
  montrer();
  return contenu;
}
