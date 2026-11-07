// Écran Semaine : anneau de la semaine, colonnes par jour, liste des créneaux du jour choisi.
import { h, s, icone, TRACES } from './dom.js';
import { t } from './textes.js';
import { ajouterJours } from './semaine.js';
import { dispositionJour } from './grille.js';
import { duree, numeroSemaine, periode, titreJour, lettreJour, couleurChoix, libelleChoix } from './format.js';

const RAYON_ANNEAU = 38;
const EPAISSEUR_ANNEAU = 12;
const HAUTEUR_COLONNE = 96;
const CIRCONFERENCE = 2 * Math.PI * RAYON_ANNEAU;
const HAUTEUR_HEURE = 52;
const MARGE_HEURES = 46;
const TRACE_TRIER = 'M4 5h16v14H4zM8 10h8M8 14h5';

/**
 * etat : { donnees, lundi, jourChoisi, aujourdhui, aTrier (nombre de créneaux à attribuer) }
 * actions : { changerSemaine(decalage), choisirJour(date), recharger(), ouvrirCreneau(date, creneau), trier(), ajouterCreneau() }
 */
export function ecranSemaine(etat, actions) {
  const { donnees, lundi, jourChoisi } = etat;
  const numero = numeroSemaine(lundi);
  const dimanche = donnees.jours[6].date;
  const prenom = donnees.reglages.prenom;
  return h('section', { class: 'ecran', 'aria-labelledby': 'titre-semaine' },
    h('div', { class: 'barre-outils' },
      h('button', { class: 'bouton-texte', onclick: () => actions.changerSemaine(-1), 'aria-label': t('semaine.precedente') },
        icone(TRACES.precedent, 20, 2.4), t('semaine.courte', { numero: numeroSemaine(ajouterJours(lundi, -7)) })),
      h('span', { class: 'groupe-boutons' },
        h('button', { class: 'bouton-rond', onclick: actions.recharger, 'aria-label': t('semaine.recharger') },
          icone(TRACES.actualiser, 20, 2.2)),
        h('button', { class: 'bouton-rond', onclick: actions.ajouterCreneau, 'aria-label': t('manuel.ajouter') },
          icone(TRACES.ajouter, 20, 2.4))),
      h('button', { class: 'bouton-texte', onclick: () => actions.changerSemaine(1), 'aria-label': t('semaine.suivante') },
        t('semaine.courte', { numero: numeroSemaine(ajouterJours(lundi, 7)) }), icone(TRACES.suivant, 20, 2.4))),
    h('header', { class: 'grand-titre' },
      h('h1', { id: 'titre-semaine' }, t('semaine.titre', { numero })),
      h('p', { class: 'secondaire' }, prenom
        ? t('semaine.sousTitre', { periode: periode(lundi, dimanche), prenom })
        : t('semaine.sousTitre.sansPrenom', { periode: periode(lundi, dimanche) }))),
    carteAnneau(donnees.resume),
    carteColonnes(donnees, jourChoisi, etat.aujourdhui, actions),
    listeDuJour(donnees, jourChoisi, actions, etat.aujourdhui),
    h('p', { class: 'note' }, t('semaine.astuce')),
    etat.aTrier ? h('button', { class: 'bouton-flottant', onclick: actions.trier },
      icone(TRACE_TRIER, 18, 2.4),
      t(etat.aTrier > 1 ? 'tri.bouton.pluriel' : 'tri.bouton', { nombre: etat.aTrier })) : null
  );
}

function arc(longueur, decalage, couleur) {
  return s('circle', { cx: 46, cy: 46, r: RAYON_ANNEAU, fill: 'none', stroke: couleur, 'stroke-width': EPAISSEUR_ANNEAU,
    'stroke-linecap': 'round', 'stroke-dasharray': `${longueur} ${CIRCONFERENCE}`, 'stroke-dashoffset': -decalage,
    transform: 'rotate(-90 46 46)', class: 'arc' });
}

function carteAnneau(resume) {
  const reference = resume.base || resume.travaille + resume.libre || 1;
  const partTravail = Math.min(resume.travaille / reference, 1) * CIRCONFERENCE;
  const partLibre = Math.min(resume.libre / reference, 1) * CIRCONFERENCE;
  const pourcent = resume.pourcent ?? Math.round(resume.travaille / reference * 100);
  return h('section', { class: 'carte carte-anneau' },
    s('svg', { width: 92, height: 92, viewBox: '0 0 92 92', role: 'img', 'aria-label': t('semaine.anneau', { pourcent }) },
      s('circle', { cx: 46, cy: 46, r: RAYON_ANNEAU, fill: 'none', stroke: 'var(--piste)', 'stroke-width': EPAISSEUR_ANNEAU }),
      partTravail > 0 ? arc(partTravail, 0, 'var(--accent)') : null,
      partLibre > 0 ? arc(Math.max(partLibre, 1), partTravail + 4, 'var(--signal)') : null,
      s('text', { x: 46, y: 52, 'text-anchor': 'middle', class: 'anneau-texte' }, `${pourcent} %`)),
    h('div', { class: 'anneau-legende' },
      h('span', { class: 'chiffre' }, duree(resume.travaille)),
      h('span', { class: 'secondaire' }, resume.base !== null ? t('semaine.base', { duree: duree(resume.base) }) : t('semaine.sansBase')),
      h('span', { class: resume.libre ? 'signal' : 'secondaire' },
        resume.libre ? t('semaine.aAttribuer', { duree: duree(resume.libre) }) : t('semaine.toutAttribue'))));
}

function carteColonnes(donnees, jourChoisi, aujourdhui, actions) {
  const { resume, projets, reglages } = donnees;
  const plusLongue = Math.max(reglages.tempsDeTravail.minutesParJour, ...resume.jours.map((j) => j.travaille + j.libre));
  const hauteur = (minutes) => `${Math.max(Math.round(minutes / plusLongue * HAUTEUR_COLONNE), 3)}px`;
  return h('section', { class: 'carte colonnes', 'aria-label': t('semaine.jours') },
    resume.jours.map((jour) => {
      const vide = jour.travaille + jour.libre === 0;
      return h('button', {
        class: `colonne${jour.date === jourChoisi ? ' choisie' : ''}${jour.date === aujourdhui ? ' aujourdhui' : ''}`,
        onclick: () => actions.choisirJour(jour.date),
        'aria-pressed': String(jour.date === jourChoisi),
        'aria-label': `${titreJour(jour.date)} : ${duree(jour.travaille)}`
      },
      h('span', { class: 'pile' },
        vide ? h('span', { class: 'part vide' }) : null,
        jour.parts.map((part) => h('span', { class: 'part', style: { height: hauteur(part.minutes), background: couleurChoix(part.code, projets) } })),
        jour.libre ? h('span', { class: 'part libre', style: { height: hauteur(jour.libre) } }) : null),
      h('span', { class: 'lettre' }, lettreJour(jour.date)));
    }));
}

function listeDuJour(donnees, jourChoisi, actions, aujourdhui) {
  const jour = donnees.jours.find((j) => j.date === jourChoisi) || donnees.jours[0];
  const resumeJour = donnees.resume.jours.find((j) => j.date === jour.date);
  const entete = h('div', { class: 'entete-section' },
    h('h2', {}, titreJour(jour.date)),
    h('span', {}, duree(resumeJour.travaille)));
  const ouvrir = (c) => () => actions.ouvrirCreneau(jour.date, c);
  const { plage, journee, blocs } = dispositionJour(jour.creneaux);
  const heures = Array.from({ length: plage.fin - plage.debut + 1 }, (_, i) => plage.debut + i);
  const position = (minutes) => `${(minutes / 60 - plage.debut) * HAUTEUR_HEURE}px`;
  const maintenant = new Date();
  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();
  const afficherMaintenant = jour.date === aujourdhui && minutesMaintenant >= plage.debut * 60 && minutesMaintenant <= plage.fin * 60;

  return h('div', {}, entete,
    journee.length ? h('div', { class: 'journees' }, journee.map((c) => blocCreneau(c, donnees.projets, ouvrir(c), 'journee'))) : null,
    h('div', { class: 'carte grille-jour', style: { height: `${(plage.fin - plage.debut) * HAUTEUR_HEURE + 16}px` } },
      heures.map((heure) => h('div', { class: 'grille-heure', style: { top: position(heure * 60) } },
        h('span', {}, `${heure}:00`))),
      afficherMaintenant ? h('div', { class: 'grille-maintenant', style: { top: position(minutesMaintenant) }, 'aria-hidden': 'true' }) : null,
      blocs.map((b) => {
        const hauteur = (b.minutes.fin - b.minutes.debut) / 60 * HAUTEUR_HEURE - 2;
        return blocCreneau(b.creneau, donnees.projets, ouvrir(b.creneau), hauteur < 34 ? 'court' : '', {
          top: position(b.minutes.debut),
          height: `${Math.max(hauteur, 18)}px`,
          left: `calc(${MARGE_HEURES}px + (100% - ${MARGE_HEURES + 8}px) * ${b.colonne / b.colonnes})`,
          width: `calc((100% - ${MARGE_HEURES + 8}px) / ${b.colonnes} - 3px)`
        });
      })),
    jour.creneaux.length === 0 ? h('p', { class: 'note' }, t('semaine.vide')) : null);
}

// Un créneau de la grille : couleur du projet, pointillés jaunes s'il est à attribuer, gris pour Pause / Ignoré.
function blocCreneau(creneau, projets, ouvrir, variante, position = null) {
  const libre = !creneau.choix;
  const couleur = couleurChoix(creneau.choix, projets);
  const quand = creneau.journeeEntiere ? t('creneau.journee') : `${creneau.debut} – ${creneau.fin}`;
  return h('button', {
    class: `bloc${libre ? ' libre' : ''}${variante ? ` ${variante}` : ''}`,
    style: { ...(position || {}), '--couleur': couleur },
    onclick: ouvrir,
    'aria-label': `${creneau.titre || '—'}, ${quand}, ${libelleChoix(creneau.choix, projets)}`
  },
  h('span', { class: 'bloc-titre' }, creneau.titre || '—'),
  h('span', { class: 'bloc-detail' }, `${creneau.journeeEntiere ? '' : `${creneau.debut} · `}${libelleChoix(creneau.choix, projets)}`));
}
