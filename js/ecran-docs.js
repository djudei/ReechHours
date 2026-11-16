// Fenêtre « Mettre à jour les docs projets » : d'abord une simulation (rien n'est écrit), ligne par ligne,
// puis l'écriture, seulement sur demande. Les conflits se tranchent ligne par ligne (par défaut : garder le doc).
import { h } from './dom.js';
import { t } from './textes.js';
import { STATUTS } from './docs-projets.js';

const jours = (n) => `${Number(n).toFixed(2).replace('.', ',')} j`;

/**
 * docs : { enCours, simulation, remplacer: [codes], ecrit, erreur } ; actions : { ecrire(), basculer(code), fermer() }
 */
export function feuilleDocs(docs, actions) {
  const lignes = docs.simulation?.lignes || [];
  const remplacer = new Set(docs.remplacer || []);
  const aEcrire = lignes.filter((l) => l.statut === STATUTS.ECRIRE || (l.statut === STATUTS.CONFLIT && remplacer.has(l.code))).length;

  const detail = (l) => {
    switch (l.statut) {
      case STATUTS.ECRIRE: return [
        t('docs.ecrire', { valeur: jours(l.valeur), avant: jours(l.valeurDoc), ligne: l.ligne, colonne: l.colonne }),
        l.renommer ? t('docs.renommer') : ''];
      case 'ecrit': return [t('docs.ecrit', { valeur: jours(l.valeur), ligne: l.ligne, colonne: l.colonne })];
      case STATUTS.A_JOUR: return [t('docs.aJour', { valeur: jours(l.valeur) })];
      case STATUTS.CONFLIT: return [t('docs.conflit', { doc: jours(l.valeurDoc), valeur: jours(l.valeur), ligne: l.ligne, colonne: l.colonne })];
      case STATUTS.IGNORE: return [t(`docs.ignore.${l.raison}`)];
      default: return [t(`docs.anomalie.${l.raison}`, { detail: l.detail || '' })];
    }
  };
  const classe = (statut) => ({ [STATUTS.ANOMALIE]: 'docs-anomalie', [STATUTS.CONFLIT]: 'docs-conflit', ecrit: 'docs-ecrit', [STATUTS.ECRIRE]: 'docs-ecrire' }[statut] || '');

  return h('div', { class: 'voile', onclick: (e) => { if (e.target === e.currentTarget && !docs.enCours) actions.fermer(); } },
    h('section', { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'titre-docs', 'aria-busy': String(Boolean(docs.enCours)) },
      h('span', { class: 'poignee', 'aria-hidden': 'true' }),
      h('div', { class: 'feuille-barre' },
        h('button', { class: 'bouton-texte', onclick: actions.fermer, disabled: docs.enCours }, t('tri.fermer')),
        h('span', { class: 'feuille-compteur', id: 'titre-docs' }, t('docs.titre', { trimestre: docs.simulation?.trimestre || '' })),
        h('span')),
      h('p', { class: 'note' }, docs.ecrit ? t('docs.compteRendu', {
        ecrits: lignes.filter((l) => l.statut === 'ecrit').length,
        anomalies: lignes.filter((l) => l.statut === STATUTS.ANOMALIE).length
      }) : t('docs.intro')),
      docs.simulation && !docs.simulation.ecritureDocsReels ? h('p', { class: 'note signal' }, t('docs.interrupteur')) : null,
      docs.erreur ? h('p', { class: 'note erreur', role: 'alert' }, docs.erreur) : null,
      docs.enCours && !lignes.length ? h('p', { class: 'note' }, t('docs.lecture')) : null,
      docs.simulation && !lignes.length ? h('p', { class: 'note' }, t('docs.rien')) : null,
      lignes.length ? h('ul', { class: 'carte liste liste-docs' }, lignes.map((l) => h('li', { class: `ligne-doc ${classe(l.statut)}` },
        h('div', { class: 'ligne-doc-haut' },
          l.lien ? h('a', { class: 'ligne-titre lien', href: l.lien, target: '_blank', rel: 'noopener' }, `${l.code} · ${l.nom}`)
            : h('span', { class: 'ligne-titre' }, `${l.code} · ${l.nom}`)),
        ...detail(l).filter(Boolean).map((texte) => h('span', { class: 'ligne-doc-detail' }, texte)),
        l.statut === STATUTS.CONFLIT && !docs.ecrit ? h('div', { class: 'choix-speciaux' },
          h('button', { class: `bouton-secondaire${remplacer.has(l.code) ? ' actif' : ''}`, 'aria-pressed': String(remplacer.has(l.code)),
            onclick: () => { if (!remplacer.has(l.code)) actions.basculer(l.code); }, disabled: docs.enCours }, t('docs.remplacer', { valeur: jours(l.valeur) })),
          h('button', { class: `bouton-secondaire${remplacer.has(l.code) ? '' : ' actif'}`, 'aria-pressed': String(!remplacer.has(l.code)),
            onclick: () => { if (remplacer.has(l.code)) actions.basculer(l.code); }, disabled: docs.enCours }, t('docs.garder', { valeur: jours(l.valeurDoc) }))) : null))) : null,
      docs.ecrit ? h('button', { class: 'bouton-principal bouton-large bouton-collant', onclick: actions.fermer }, t('docs.terminer'))
        : h('button', { class: 'bouton-principal bouton-large bouton-collant', onclick: actions.ecrire, disabled: docs.enCours || !aEcrire },
          docs.enCours && lignes.length ? t('docs.ecritureEnCours') : t('docs.bouton.ecrire', { nombre: aEcrire })),
      docs.enCours ? h('div', { class: 'feuille-attente', 'aria-hidden': 'true' }, h('div', { class: 'roue' })) : null));
}
