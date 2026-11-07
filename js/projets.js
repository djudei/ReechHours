// Projets : ce qu'il faut écrire dans l'onglet Projets (repris de Projets.gs). Calculs purs.
// Le N° relie un projet à ses créneaux : il ne change jamais ; un projet de l'équipe se gère chez son responsable.
import { t } from './textes.js';
import { ONGLETS, MOTS_PROJETS } from './schema.js';

const ONGLET_PROJETS = ONGLETS.PROJETS;
const FORMAT_CODE_PROJET = /^[A-Za-z0-9-]{1,20}$/;
export const LONGUEUR_MAX_NOM = 80;
const MOTS_SHEET = MOTS_PROJETS;

/**
 * Catégories, dans l'ordre d'affichage : projets (nom des Réglages), 3e catégorie si elle a un nom, lignes internes.
 */
export function categories(reglages) {
  return [
    { type: 'projet', nom: reglages.nomCategorieProjet || t('categorie.projet') },
    { type: 'interne', nom: t('categorie.interne') }
  ];
}

const nomPropre = (nom) => String(nom ?? '').trim().replace(/\s+/g, ' ');

function verifierNom(nom) {
  const propre = nomPropre(nom);
  if (!propre || propre.length > LONGUEUR_MAX_NOM) throw new Error(t('projet.erreur.nom', { max: LONGUEUR_MAX_NOM }));
  return propre;
}

/**
 * Nouvelle ligne de l'onglet Projets : [N°, nom, type, statut, lien doc] (lien vide : il se complète plus tard).
 */
export function planCreation({ code, nom, type, projets, categories: liste, aujourdhui }) {
  const codePropre = String(code ?? '').trim();
  if (!FORMAT_CODE_PROJET.test(codePropre)) throw new Error(t('projet.erreur.numero'));
  const nomVerifie = verifierNom(nom);
  if (!liste.some((c) => c.type === type)) throw new Error(t('projet.erreur.categorie'));
  if (projets.some((p) => p.code.toLowerCase() === codePropre.toLowerCase())) {
    throw new Error(t('projet.erreur.existe', { code: codePropre }));
  }
  return [codePropre, nomVerifie, MOTS_SHEET.type[type], MOTS_SHEET.statut.actif, ''];
}

/**
 * Le projet de ce N°, s'il peut être modifié ici. Dans le doute (absent, en double, de l'équipe) : erreur.
 */
function projetModifiable(code, projets) {
  const trouves = projets.filter((p) => p.code === code);
  if (trouves.length === 0) throw new Error(t('projet.erreur.introuvable', { code }));
  if (trouves.length > 1) throw new Error(t('projet.erreur.double', { code }));
  if (trouves[0].equipe) throw new Error(t('projet.erreur.equipe', { nom: trouves[0].nom }));
  return trouves[0];
}

export function planStatut({ code, statut, projets }) {
  if (!(statut in MOTS_SHEET.statut)) throw new Error(t('projet.erreur.statut', { statut }));
  const projet = projetModifiable(code, projets);
  return { plage: `'${ONGLET_PROJETS}'!D${projet.numeroLigne}`, valeur: MOTS_SHEET.statut[statut] };
}

export function planRenommageProjet({ code, nom, projets }) {
  const nomVerifie = verifierNom(nom);
  const projet = projetModifiable(code, projets);
  return { plage: `'${ONGLET_PROJETS}'!B${projet.numeroLigne}`, valeur: nomVerifie };
}

/**
 * Supprimer (ex. doublon créé par erreur) : seulement si aucun créneau ne lui est attribué. Renvoie la ligne à retirer.
 */
export function planSuppressionProjet({ code, projets, saisies }) {
  const projet = projetModifiable(code, projets);
  const utilises = saisies.filter((s) => s.code === projet.code).length;
  if (utilises > 0) {
    throw new Error(t(utilises === 1 ? 'projet.erreur.utilise1' : 'projet.erreur.utilises', { nombre: utilises, nom: projet.nom }));
  }
  return projet.numeroLigne;
}
