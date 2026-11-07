// Écran Récap : un mois (flèches), tuiles Travaillé / Base / Au-delà, vue Par projet ou Global.
import { h, icone, TRACES } from './dom.js';
import { t, calendrier } from './textes.js';
import { duree, couleurChoix } from './format.js';
import { categories } from './projets.js';

const COULEURS_CATEGORIES = { projet: 'var(--projet-0)', autre: 'var(--projet-1)', interne: 'var(--projet-interne)' };

export function nomMois(mois) {
  const [annee, m] = mois.split('-').map(Number);
  const nom = calendrier.NOMS_MOIS[m - 1];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${annee}`;
}

export function decalerMois(mois, decalage) {
  const [annee, m] = mois.split('-').map(Number);
  const date = new Date(annee, m - 1 + decalage, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Minutes → « 8,9 j » (jours de travail d'après les heures par jour des Réglages).
 */
function enJours(minutes, minutesParJour) {
  const jours = Math.round(minutes / minutesParJour * 10) / 10;
  return t('recap.jours', { nombre: String(jours).replace('.', ',') });
}

/**
 * vue : { mois, affichage: 'projet' | 'global', recap, erreur }
 * vue.export : { enCours, message, lien, erreur } (mise à jour du Google Sheet)
 * actions : { changerMois(decalage), afficher(affichage), exporter() }
 */
export function ecranRecap(donnees, vue, actions) {
  const { recap } = vue;
  return h('section', { class: 'ecran', 'aria-labelledby': 'titre-recap' },
    h('div', { class: 'barre-outils' },
      h('button', { class: 'bouton-texte', onclick: () => actions.changerMois(-1), 'aria-label': t('recap.moisPrecedent') },
        icone(TRACES.precedent, 20, 2.4), nomMois(decalerMois(vue.mois, -1)).split(' ')[0]),
      h('button', { class: 'bouton-texte', onclick: () => actions.changerMois(1), 'aria-label': t('recap.moisSuivant') },
        nomMois(decalerMois(vue.mois, 1)).split(' ')[0], icone(TRACES.suivant, 20, 2.4))),
    h('header', { class: 'grand-titre' }, h('h1', { id: 'titre-recap' }, nomMois(vue.mois))),
    vue.erreur ? h('p', { class: 'erreur note', role: 'alert' }, vue.erreur) : null,
    recap ? contenu(recap, donnees, vue, actions) : h('div', { class: 'ecran-centre petit' }, h('div', { class: 'roue', 'aria-hidden': 'true' })));
}

function contenu(recap, donnees, vue, actions) {
  const mpj = recap.minutesParJour;
  const ecart = recap.totalEcartMinutes;
  const aDate = recap.dateLimite ? ` · ${t('recap.adate', { date: `${recap.dateLimite.slice(8, 10)}/${recap.dateLimite.slice(5, 7)}` })}` : '';
  return [
    h('div', { class: `tuiles${recap.avecBase ? '' : ' une-tuile'}` },
      tuile(t('recap.travaille'), duree(recap.totalTravailleMinutes), enJours(recap.totalTravailleMinutes, mpj)),
      recap.avecBase ? tuile(t('recap.base'), duree(recap.totalBaseMinutes),
        `${t('recap.base.detail', { jours: String(recap.totalBaseMinutes / mpj).replace('.', ','), duree: duree(mpj) })}${aDate}`) : null,
      recap.avecBase ? tuile(ecart >= 0 ? t('recap.audela') : t('recap.enDessous'),
        `${ecart > 0 ? '+' : ecart < 0 ? '−' : ''}${duree(Math.abs(ecart))}`, enJours(Math.abs(ecart), mpj), ecart > 0) : null),
    h('div', { class: 'segments segments-ecran', role: 'group' },
      ['projet', 'global'].map((affichage) => h('button', {
        class: `segment${vue.affichage === affichage ? ' actif' : ''}`, 'aria-pressed': String(vue.affichage === affichage),
        onclick: () => actions.afficher(affichage)
      }, t(affichage === 'projet' ? 'recap.parProjet' : 'recap.global')))),
    recap.projets.length === 0 ? h('p', { class: 'note' }, t('recap.vide'))
      : vue.affichage === 'projet' ? parProjet(recap, donnees) : global(recap, donnees),
    recap.aAttribuerMinutes ? h('p', { class: 'note signal' }, t('recap.aAttribuer', { duree: duree(recap.aAttribuerMinutes) })) : null,
    piedExport(vue.export || {}, actions)
  ];
}

function tuile(titre, valeur, detail, accent = false) {
  return h('div', { class: 'tuile' },
    h('span', { class: 'tuile-titre' }, titre),
    h('span', { class: `tuile-valeur${accent ? ' accent' : ''}` }, valeur),
    h('span', { class: 'tuile-detail' }, detail));
}

// Catégorie d'une ligne ; 3e catégorie retirée des Réglages : avec les projets.
function categorieDe(type, liste) {
  return liste.some((c) => c.type === type) ? type : 'projet';
}

function parProjet(recap, donnees) {
  const liste = categories(donnees.reglages);
  const tries = [...recap.projets].sort((a, b) => b.minutes - a.minutes);
  const maximum = tries[0]?.minutes || 1;
  return liste.map((categorie) => {
    const lignes = tries.filter((p) => categorieDe(p.type, liste) === categorie.type);
    if (!lignes.length) return null;
    const total = lignes.reduce((somme, p) => somme + p.minutes, 0);
    return h('div', {},
      h('div', { class: 'entete-section' }, h('h2', {}, categorie.nom), h('span', {}, enJours(total, recap.minutesParJour))),
      h('ul', { class: 'carte liste liste-recap' }, lignes.map((p) => h('li', { class: 'ligne-recap' },
        h('div', { class: 'ligne-recap-haut' },
          h('span', { class: 'ligne-titre' }, p.type === 'interne' ? p.nom : `${p.code} · ${p.nom}`),
          h('span', { class: 'ligne-recap-chiffres' }, h('strong', {}, duree(p.minutes)), ' ', enJours(p.minutes, recap.minutesParJour))),
        h('span', { class: 'barre' }, h('span', { class: 'barre-remplie', style: {
          width: `${Math.max(2, p.minutes / maximum * 100).toFixed(1)}%`, background: couleurChoix(p.code, donnees.projets)
        } }))))));
  });
}

function global(recap, donnees) {
  const liste = categories(donnees.reglages);
  const minutes = Object.fromEntries(liste.map((c) => [c.type, 0]));
  recap.projets.forEach((p) => { minutes[categorieDe(p.type, liste)] += p.minutes; });
  const total = Object.values(minutes).reduce((a, b) => a + b, 0) || 1;
  const moyenne = recap.joursTravailles ? Math.round(recap.totalTravailleMinutes / recap.joursTravailles) : 0;
  return h('div', { class: 'carte carte-globale' },
    h('div', { class: 'repartition', 'aria-hidden': 'true' },
      liste.map((c) => h('span', { style: { width: `${minutes[c.type] / total * 100}%`, background: COULEURS_CATEGORIES[c.type] } }))),
    liste.map((c) => h('div', { class: 'legende' },
      h('span', { class: 'legende-nom' }, h('span', { class: 'pastille', style: { background: COULEURS_CATEGORIES[c.type] } }), c.nom),
      h('span', { class: 'secondaire' }, `${enJours(minutes[c.type], recap.minutesParJour)} · ${Math.round(minutes[c.type] / total * 100)} %`))),
    h('p', { class: 'secondaire' }, t('recap.moyenne', { duree: duree(moyenne) })),
    h('p', { class: 'secondaire' }, t('recap.conges', { jours: String(Math.round(recap.nonTravailleMinutes / recap.minutesParJour * 10) / 10).replace('.', ',') })));
}

// « Mettre à jour mon Google Sheet » : bouton, attente, puis le résultat avec le lien vers le Sheet.
function piedExport(etatExport, actions) {
  return h('div', { class: 'pied-recap' },
    h('button', { class: 'bouton-principal bouton-large', onclick: actions.exporter, disabled: etatExport.enCours },
      etatExport.enCours ? t('export.encours') : t('recap.sheet')),
    etatExport.message ? h('p', { class: 'note', role: 'status' }, etatExport.message) : null,
    etatExport.erreur ? h('p', { class: 'note erreur', role: 'alert' }, etatExport.erreur) : null,
    etatExport.lien ? h('a', { class: 'lien lien-centre', href: etatExport.lien, target: '_blank', rel: 'noopener' }, t('export.ouvrir')) : null);
}
