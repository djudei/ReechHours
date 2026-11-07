// Écran Projets : liste par catégorie (actifs / archivés), recherche, et deux feuilles :
// « Nouveau projet » (N° proposé automatiquement) et la fiche d'un projet (renommer, archiver, supprimer).
import { h, icone, TRACES } from './dom.js';
import { t } from './textes.js';
import { normaliser } from './regles.js';
import { couleurChoix } from './format.js';
import { categories, LONGUEUR_MAX_NOM } from './projets.js';
import { proposerNumero, FORMAT_CLIENT } from './numerotation.js';

const TRACE_LOUPE = 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2';

/**
 * vue : { filtre: 'actifs' | 'archives', feuille }
 * actions : { filtrer(filtre), ouvrirProjet(code), nouveau(), fermer(), creer(champs), renommer(nom?), basculerStatut(), supprimer() }
 */
export function ecranProjets(donnees, vue, actions) {
  const { projets, reglages } = donnees;
  const statut = vue.filtre === 'archives' ? 'archivé' : 'actif';
  const visibles = projets.filter((p) => p.statut === statut);
  const nombre = (s) => projets.filter((p) => p.statut === s).length;
  const filtrerTexte = (evenement) => {
    const cherche = normaliser(evenement.target.value);
    document.querySelectorAll('.liste-projets-ecran li').forEach((li) => {
      li.hidden = Boolean(cherche) && !li.dataset.recherche.includes(cherche);
    });
  };

  return h('section', { class: 'ecran', 'aria-labelledby': 'titre-projets' },
    h('div', { class: 'barre-outils barre-droite' },
      h('button', { class: 'bouton-rond', onclick: actions.nouveau, 'aria-label': t('projets.nouveau') }, icone(TRACES.ajouter, 20, 2.4))),
    h('header', { class: 'grand-titre' }, h('h1', { id: 'titre-projets' }, t('projets.titre'))),
    h('div', { class: 'outils-liste' },
      h('label', { class: 'recherche recherche-ecran' }, icone(TRACE_LOUPE, 18, 2.2),
        h('input', { type: 'search', placeholder: t('projets.chercher'), 'aria-label': t('projets.chercher'), oninput: filtrerTexte })),
      h('div', { class: 'segments', role: 'group' },
        ['actifs', 'archives'].map((filtre) => h('button', {
          class: `segment${vue.filtre === filtre ? ' actif' : ''}`, 'aria-pressed': String(vue.filtre === filtre),
          onclick: () => actions.filtrer(filtre)
        }, t(`projets.${filtre}`, { nombre: nombre(filtre === 'actifs' ? 'actif' : 'archivé') }))))),
    visibles.length === 0 ? h('p', { class: 'note' }, t('projets.vide')) : null,
    categories(reglages).map((categorie) => {
      const liste = visibles.filter((p) => p.type === categorie.type);
      if (!liste.length) return null;
      return h('div', {},
        h('div', { class: 'entete-section' }, h('h2', {}, `${categorie.nom} · ${liste.length}`)),
        h('ul', { class: 'carte liste liste-projets-ecran' }, liste.map((p) => h('li', { 'data-recherche': normaliser(`${p.code} ${p.nom}`) },
          h('button', { class: 'ligne ligne-bouton', onclick: () => actions.ouvrirProjet(p.code) },
            h('span', { class: 'pastille', style: { background: p.statut === 'actif' ? couleurChoix(p.code, projets) : 'var(--neutre)' } }),
            h('span', { class: 'ligne-texte' },
              h('span', { class: 'ligne-titre ligne-titre-badge' }, p.nom, p.equipe ? h('span', { class: 'badge' }, t('projets.equipe')) : null),
              h('span', { class: 'ligne-sous-titre' }, p.code)),
            h('span', { class: 'ligne-duree' }, icone(TRACES.suivant, 14, 3)))))));
    }),
    vue.feuille?.mode === 'nouveau' ? feuilleNouveauProjet(donnees, vue.feuille, actions) : null,
    vue.feuille?.mode === 'projet' ? feuilleProjet(donnees, vue.feuille, actions) : null);
}

function enveloppe(titre, contenu, feuille, actions) {
  return h('div', { class: 'voile', onclick: (e) => { if (e.target === e.currentTarget) actions.fermer(); } },
    h('section', { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre, 'aria-busy': String(feuille.enCours) },
      h('span', { class: 'poignee', 'aria-hidden': 'true' }),
      h('div', { class: 'feuille-barre' },
        h('button', { class: 'bouton-texte', onclick: actions.fermer }, t('tri.fermer')),
        h('span', { class: 'feuille-compteur' }, titre),
        h('span')),
      ...contenu,
      feuille.erreur ? h('p', { class: 'erreur feuille-erreur', role: 'alert' }, feuille.erreur) : null,
      feuille.enCours ? h('div', { class: 'feuille-attente', 'aria-hidden': 'true' }, h('div', { class: 'roue' })) : null));
}

function periodeDuJour() {
  const maintenant = new Date();
  return { annee: maintenant.getFullYear(), mois: maintenant.getMonth() + 1 };
}

function feuilleNouveauProjet(donnees, feuille, actions) {
  const { reglages, projets } = donnees;
  const format = reglages.formatNumero;
  const codes = projets.map((p) => p.code);
  const champNom = h('input', { id: 'projet-nom', type: 'text', value: feuille.nom, maxlength: LONGUEUR_MAX_NOM, placeholder: t('projets.nom.exemple') });
  const champLettres = h('input', { id: 'projet-lettres', type: 'text', value: feuille.lettres, maxlength: 6, placeholder: t('projets.lettres.exemple'), autocapitalize: 'characters' });
  const champCode = h('input', { id: 'projet-code', type: 'text', value: feuille.code, maxlength: 20, autocapitalize: 'characters' });
  let codeTouche = feuille.codeTouche;
  // Le N° proposé suit le nom et les lettres, tant que la personne ne l'a pas changé à la main.
  const proposer = () => {
    if (codeTouche) return;
    try {
      champCode.value = proposerNumero({ format, codes, periode: periodeDuJour(), lettres: champLettres.value, nom: champNom.value, type: feuille.type });
    } catch {
      champCode.value = '';
    }
  };
  champNom.addEventListener('input', proposer);
  champLettres.addEventListener('input', proposer);
  champCode.addEventListener('input', () => { codeTouche = true; });
  if (!feuille.code) proposer();
  const champs = () => ({ nom: champNom.value, lettres: champLettres.value, code: champCode.value, codeTouche });
  const valider = (evenement) => { evenement.preventDefault(); actions.creer(champs()); };

  const liste = categories(reglages);
  return enveloppe(t('projets.nouveau'), [
    liste.length > 1 ? h('div', { class: 'segments', role: 'group', 'aria-label': t('projets.categorie') },
      liste.map((c) => h('button', {
        class: `segment${feuille.type === c.type ? ' actif' : ''}`, 'aria-pressed': String(feuille.type === c.type),
        onclick: () => actions.choisirType(c.type, champs())
      }, c.nom))) : null,
    h('form', { class: 'formulaire-feuille', onsubmit: valider },
      h('div', { class: 'carte liste formulaire-manuel' },
        h('label', { class: 'champ-ligne', for: 'projet-nom' }, h('span', {}, t('projets.nom')), champNom),
        format === FORMAT_CLIENT ? h('label', { class: 'champ-ligne', for: 'projet-lettres' }, h('span', {}, t('projets.lettres')), champLettres) : null,
        h('label', { class: 'champ-ligne', for: 'projet-code' }, h('span', {}, t('projets.numero')), champCode)),
      h('p', { class: 'note note-feuille' }, t('projets.numero.aide')),
      h('button', { class: 'bouton-principal', type: 'submit', disabled: feuille.enCours }, t('projets.creer')))
  ], feuille, actions);
}

function feuilleProjet(donnees, feuille, actions) {
  const projet = donnees.projets.find((p) => p.code === feuille.code);
  if (!projet) return null;
  const actif = projet.statut === 'actif';
  let corps;
  if (projet.equipe) {
    corps = [h('p', { class: 'note note-feuille' }, t('projets.equipe.aide'))];
  } else if (feuille.renommer) {
    const champ = h('input', { type: 'text', value: projet.nom, maxlength: LONGUEUR_MAX_NOM, 'aria-label': t('projets.nom') });
    setTimeout(() => champ.select(), 0);
    corps = [h('form', { class: 'renommage', onsubmit: (e) => { e.preventDefault(); actions.renommer(champ.value); } },
      champ, h('button', { class: 'bouton-principal bouton-petit', type: 'submit', disabled: feuille.enCours }, t('manuel.renommer.ok')))];
  } else {
    corps = [h('div', { class: 'actions-projet' },
      h('button', { class: 'bouton-secondaire', onclick: () => actions.renommer(), disabled: feuille.enCours }, t('projets.renommer')),
      h('button', { class: 'bouton-secondaire', onclick: actions.basculerStatut, disabled: feuille.enCours },
        actif ? t('projets.archiver') : t('projets.reactiver')),
      h('button', { class: `bouton-secondaire bouton-danger${feuille.confirmer ? ' confirmer' : ''}`, onclick: actions.supprimer, disabled: feuille.enCours },
        feuille.confirmer ? t('projets.supprimer.confirmer') : t('projets.supprimer')))];
  }
  return enveloppe(projet.code, [
    h('div', { class: 'feuille-entete' },
      h('h2', {}, projet.nom),
      h('span', { class: 'secondaire ligne-titre-badge' }, projet.code,
        projet.equipe ? h('span', { class: 'badge' }, t('projets.equipe')) : null,
        actif ? null : h('span', { class: 'badge badge-gris' }, t('projets.archive.statut')))),
    ...corps
  ], feuille, actions);
}
