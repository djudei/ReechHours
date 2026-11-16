// Mise à jour des docs projets (onglet TIMESHEET du Google Sheet de chaque projet) : calculs purs.
// Règles (les mêmes que Timesheets+) :
// - chercher par étiquette, jamais par position : la ligne dont la colonne A vaut le « Nom dans les docs »,
//   la colonne dont l'en-tête vaut « T4 2026 » (trimestre civil) ;
// - écrire le total du trimestre en jours (2 décimales) en REMPLAÇANT la valeur (relancer ne double rien) ;
// - nom absent : une ligne au nom proche (prénom seul) → anomalie ; sinon la première ligne « Prénom - à compléter »
//   sous le poste de la personne est renommée ; sinon anomalie ;
// - valeur du doc plus grande que le calcul → conflit, la personne choisit (par défaut : garder) ;
// - jamais d'insertion de ligne ou de colonne, jamais toucher aux totaux.
// Règle d'or : dans le doute, on n'écrit pas, on signale.
import { normaliser } from './regles.js';

export const NOM_ONGLET_TIMESHEET = 'TIMESHEET';
// Sections du modèle TIMESHEET d'origine : repères de fin de section, même retirés des Réglages de la personne.
export const POSTES_MODELE = ['Directeur', 'Directeur conseil', 'Directeur de clientèle', 'Account manager',
  'Chef de projet', 'Influence campaign manager', 'Production Manager', 'Creative strategist'];
const LIGNE_LIBRE = /^prenom ?- ?a completer$/;
const FIN_DE_TABLEAU = /^(global|total)\b/;
const ECART_TOLERE = 0.005;   // moins d'un centième de jour : identique

export const STATUTS = { ECRIRE: 'ecrire', A_JOUR: 'a_jour', CONFLIT: 'conflit', ANOMALIE: 'anomalie', IGNORE: 'ignore' };

/** Lien d'un Google Sheet → son identifiant ; '' si ce n'est pas un lien de Sheet. */
export function idDepuisLien(lien) {
  return /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(String(lien || ''))?.[1] || '';
}

/** "2026-11" → { nom: 'T4 2026', mois: ['2026-10', '2026-11', '2026-12'] } (trimestre civil). */
export function trimestreDe(mois) {
  const [annee, numero] = mois.split('-').map(Number);
  const trimestre = Math.ceil(numero / 3);
  const premier = (trimestre - 1) * 3 + 1;
  return {
    nom: `T${trimestre} ${annee}`,
    mois: [0, 1, 2].map((i) => `${annee}-${String(premier + i).padStart(2, '0')}`)
  };
}

/** Lettre(s) de colonne : 0 → A, 26 → AA. */
export function lettre(index) {
  let n = index + 1;
  let texte = '';
  while (n > 0) {
    const reste = (n - 1) % 26;
    texte = String.fromCharCode(65 + reste) + texte;
    n = Math.floor((n - 1) / 26);
  }
  return texte;
}

/** Valeur affichée d'une case (« 1,5 », « 2 », « ») → nombre ; vide → 0 ; illisible → null. */
export function nombreDe(valeur) {
  const texte = String(valeur ?? '').replace(/\s/g, '').replace(',', '.');
  if (!texte) return 0;
  const n = Number(texte);
  return Number.isFinite(n) ? n : null;
}

/**
 * grille : valeurs de l'onglet TIMESHEET (ligne 1 = grille[0]) ;
 * personne : { nomDocs, posteDocs, postes: [] } ; trimestre : 'T4 2026' ; jours : total calculé (nombre).
 * → { statut, raison?, ligne?, colonne?, valeurDoc?, valeur, renommer?, modifications: [{ plage, valeurs }] }
 * (plage sans nom d'onglet : « B12 »).
 */
export function planDoc({ grille, personne, trimestre, jours }) {
  const valeur = Math.round(jours * 100) / 100;
  const anomalie = (raison) => ({ statut: STATUTS.ANOMALIE, raison, valeur, modifications: [] });
  const colonneA = (i) => normaliser(grille[i]?.[0]);

  // 1. La colonne du trimestre, par son en-tête (n'importe quelle ligne). Deux fois → doute.
  const cible = normaliser(trimestre);
  const enTetes = [];
  grille.forEach((ligne, i) => (ligne || []).forEach((caseTexte, j) => {
    if (normaliser(caseTexte) === cible) enTetes.push({ ligne: i, colonne: j });
  }));
  if (!enTetes.length) return anomalie('colonne');
  if (new Set(enTetes.map((e) => e.colonne)).size > 1) return anomalie('colonneDouble');
  const { ligne: ligneEnTete, colonne } = enTetes[0];

  // 2. La ligne de la personne, par son nom (colonne A). Deux fois → doute.
  const nom = normaliser(personne.nomDocs);
  if (!nom) return anomalie('nomVide');
  const lignesNom = grille.map((_, i) => i).filter((i) => i > ligneEnTete && colonneA(i) === nom);
  if (lignesNom.length > 1) return anomalie('nomDouble');
  let ligne = lignesNom[0];
  let renommer = false;

  if (ligne === undefined) {
    // Nom proche (« Julien » au lieu de « Julien M ») : peut-être la même personne → on n'écrit pas.
    const prenom = normaliser(personne.nomDocs.trim().split(/\s+/).slice(0, -1).join(' '));
    if (prenom && grille.some((_, i) => i > ligneEnTete && colonneA(i) === prenom)) return anomalie('nomProche');
    // Première ligne « Prénom - à compléter » sous le poste de la personne, avant la section suivante.
    const poste = normaliser(personne.posteDocs);
    if (!poste) return anomalie('posteVide');
    const reperes = new Set([...(personne.postes || []), ...POSTES_MODELE].map(normaliser).filter(Boolean));
    const debutSection = grille.findIndex((_, i) => i > ligneEnTete && colonneA(i) === poste);
    if (debutSection === -1) return anomalie('posteAbsent');
    for (let i = debutSection + 1; i < grille.length; i++) {
      const texte = colonneA(i);
      if (reperes.has(texte) || FIN_DE_TABLEAU.test(texte)) break;
      if (LIGNE_LIBRE.test(texte)) { ligne = i; break; }
    }
    if (ligne === undefined) return anomalie('pasDeLigneLibre');
    renommer = true;
  }

  // 3. Valeur déjà dans le doc.
  const valeurDoc = nombreDe(grille[ligne]?.[colonne]);
  if (valeurDoc === null) return anomalie('caseIllisible');
  const base = { ligne: ligne + 1, colonne: lettre(colonne), valeurDoc, valeur, renommer };
  const caseValeur = { plage: `${lettre(colonne)}${ligne + 1}`, valeurs: [[valeur]] };
  const caseNom = { plage: `A${ligne + 1}`, valeurs: [[personne.nomDocs.trim()]] };
  if (!renommer && Math.abs(valeurDoc - valeur) < ECART_TOLERE) return { ...base, statut: STATUTS.A_JOUR, modifications: [] };
  if (valeurDoc > valeur + ECART_TOLERE) return { ...base, statut: STATUTS.CONFLIT, modifications: [...(renommer ? [caseNom] : []), caseValeur] };
  return { ...base, statut: STATUTS.ECRIRE, modifications: [...(renommer ? [caseNom] : []), caseValeur] };
}

/**
 * Seuls les docs dont le nom commence par « TEST » sont écrits tant que l'interrupteur « Écriture docs réels »
 * n'est pas sur « oui ».
 */
export function ecritureAutorisee(titreDoc, ecritureDocsReels) {
  return ecritureDocsReels || /^test/i.test(String(titreDoc || '').trim());
}
