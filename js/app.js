// Démarrage et enchaînement des écrans : connexion → Sheet → Semaine (+ feuille Trier).
import { CLIENT_ID } from './config.js';
import { connecter, deconnecter } from './google.js';
import { chargerSemaine, chargerRecap, exporterSheet, enregistrerReglages, creerSheet, verifierSheet, attribuer, ajouterManuel, renommerManuel, supprimerManuel, sourceGoogle } from './donnees.js';
import { idSheetDepuisLien } from './regles.js';
import { lundiDe, ajouterJours, dateTexte, resumeSemaine } from './semaine.js';
import { sourceDemo } from './demo.js';
import { ecranSemaine } from './ecran-semaine.js';
import { feuilleTri, projetsPourTri } from './ecran-tri.js';
import { feuilleNouveau, heuresParDefaut } from './ecran-manuel.js';
import { ecranProjets } from './ecran-projets.js';
import { ecranRecap, decalerMois } from './ecran-recap.js';
import { actionsProjets } from './actions-projets.js';
import { ecranCharge } from './ecran-charge.js';
import { actionsCharge } from './actions-charge.js';
import { ecranReglages } from './ecran-reglages.js';
import { ecranConnexion, ecranSheet, ecranChargement, ecranErreur, ecranBientot, barreOnglets } from './ecrans.js';
import { h } from './dom.js';
import { t } from './textes.js';

const CLE_SHEET = 'reechhours.idSheet';   // différent de Hours : les deux applis vivent sur le même site
const JOURS_PAR_SEMAINE = 7;
const DUREE_MESSAGE_MS = 3500;

const racine = document.getElementById('appli');
const estDemo = new URLSearchParams(location.search).has('demo');
const source = estDemo ? sourceDemo() : sourceGoogle;
const aujourdhui = dateTexte(new Date());

let etat = {
  onglet: 'agenda',
  lundi: lundiDe(aujourdhui),
  jourChoisi: aujourdhui,
  donnees: null,
  connecte: estDemo,
  connexionEnCours: false,
  tri: null,
  nouveau: null,
  vueProjets: { filtre: 'actifs', feuille: null },
  vueCharge: { mois: aujourdhui.slice(0, 7), charge: null, erreur: '', feuille: null, confirmerDuplication: false, enCours: false },
  vueReglages: { enCours: false, erreur: '' },
  vueRecap: { mois: aujourdhui.slice(0, 7), affichage: 'projet', recap: null, erreur: '' },
  message: ''
};
const changer = (modifications) => { etat = { ...etat, ...modifications }; };

// Mémoire du navigateur : seulement l'identifiant du Sheet, pour ne pas le redemander à chaque visite.
function lireIdSheet() {
  if (estDemo) return 'demo';
  try { return localStorage.getItem(CLE_SHEET) || ''; } catch { return ''; }
}
function ecrireIdSheet(id) {
  try { id ? localStorage.setItem(CLE_SHEET, id) : localStorage.removeItem(CLE_SHEET); } catch { /* navigation privée : on redemandera */ }
}

// Les animations d'entrée (écran, feuille) ne se jouent qu'à l'ouverture, pas à chaque mise à jour de l'affichage ;
// la feuille ouverte garde aussi sa position de défilement.
let dernierEcran = '';

function afficher(...contenu) {
  document.body.classList.toggle('feuille-ouverte', Boolean(etat.tri || etat.nouveau
    || (etat.onglet === 'projets' && etat.vueProjets.feuille) || (etat.onglet === 'charge' && etat.vueCharge.feuille)));
  const feuillePrecedente = racine.querySelector('.feuille');
  const defilementFeuille = feuillePrecedente ? feuillePrecedente.scrollTop : 0;
  const ecran = etat.donnees ? etat.onglet : 'accueil';
  const memeEcran = ecran === dernierEcran;
  dernierEcran = ecran;
  racine.replaceChildren(...[
    estDemo ? h('p', { class: 'bandeau-demo' }, t('demo.bandeau')) : null,
    h('main', { class: 'contenu' }, ...contenu),
    etat.connecte && etat.donnees ? barreOnglets(etat.onglet, choisirOnglet) : null,
    etat.message ? h('p', { class: 'message', role: 'status' }, etat.message) : null
  ].filter(Boolean));
  racine.classList.toggle('stable', memeEcran);
  const voile = racine.querySelector('.voile');
  if (voile && feuillePrecedente) {
    voile.classList.add('stable');
    voile.querySelector('.feuille').scrollTop = defilementFeuille;
  }
}

// Changer d'onglet ; le Récap relit le Sheet à chaque ouverture (les attributions ont pu changer).
function choisirOnglet(onglet) {
  changer({ onglet });
  if (onglet === 'recap') chargerMoisRecap();
  else if (onglet === 'charge') actionsEcranCharge.charger();
  else rendre();
}

function montrerMessage(message) {
  changer({ message });
  rendre();
  setTimeout(() => { if (etat.message === message) { changer({ message: '' }); rendre(); } }, DUREE_MESSAGE_MS);
}

// ---------- Semaine ----------

function aTrier() {
  return etat.donnees.jours
    .filter(({ date }) => date <= aujourdhui && (!etat.donnees.reglages.debutSuivi || date >= etat.donnees.reglages.debutSuivi))
    .flatMap(({ date, creneaux }) => creneaux.filter((c) => !c.choix).map((creneau) => ({ date, creneau })));
}

function rendre() {
  if (etat.onglet === 'projets') return afficher(ecranProjets(etat.donnees, etat.vueProjets, actionsEcranProjets));
  if (etat.onglet === 'reglages') return afficher(ecranReglages(etat.donnees.reglages, etat.vueReglages, actionsReglages, { demo: estDemo }));
  if (etat.onglet === 'charge') return afficher(ecranCharge(etat.vueCharge, actionsEcranCharge));
  if (etat.onglet === 'recap') return afficher(ecranRecap(etat.donnees, etat.vueRecap, actionsRecap));
  if (etat.onglet !== 'agenda') return afficher(ecranBientot(etat.onglet));
  const semaine = ecranSemaine({ ...etat, aujourdhui, aTrier: aTrier().length }, {
    changerSemaine: (decalage) => {
      const lundi = ajouterJours(etat.lundi, decalage * JOURS_PAR_SEMAINE);
      const contientAujourdhui = lundi <= aujourdhui && aujourdhui < ajouterJours(lundi, JOURS_PAR_SEMAINE);
      changer({ lundi, jourChoisi: contientAujourdhui ? aujourdhui : lundi });
      charger();
    },
    choisirJour: (date) => { changer({ jourChoisi: date }); rendre(); },
    recharger: charger,
    ouvrirCreneau: (date, creneau) => ouvrirTri([{ date, creneau }]),
    trier: () => ouvrirTri(aTrier()),
    ajouterCreneau: ouvrirNouveau
  });
  const projets = projetsPourTri(etat.donnees.projets);
  afficher(semaine,
    etat.tri ? feuilleTri(etat.tri, projets, etat.donnees.projets, { choisir, passer, fermer: fermerTri, renommer, supprimer }) : null,
    etat.nouveau ? feuilleNouveau(etat.nouveau, projets, etat.donnees.projets, { creer: creerManuel, fermer: fermerNouveau }) : null);
}

const outilsAppli = {
  lire: () => etat,
  changer,
  rendre: () => rendre(),
  message: (texte) => montrerMessage(texte),
  relire: () => rafraichir(),
  acces: () => ({ idSheet: lireIdSheet(), source })
};
const actionsEcranProjets = actionsProjets(outilsAppli);
const actionsEcranCharge = actionsCharge(outilsAppli);

// ---------- Récap ----------

async function chargerMoisRecap() {
  changer({ vueRecap: { ...etat.vueRecap, recap: null, erreur: '' } });
  rendre();
  try {
    const recap = await chargerRecap({ idSheet: lireIdSheet(), mois: etat.vueRecap.mois, aujourdhui, source });
    if (recap.mois === etat.vueRecap.mois) changer({ vueRecap: { ...etat.vueRecap, recap } });
  } catch (erreur) {
    changer({ vueRecap: { ...etat.vueRecap, erreur: erreur.message } });
  }
  rendre();
}

const actionsRecap = {
  changerMois: (decalage) => {
    changer({ vueRecap: { ...etat.vueRecap, mois: decalerMois(etat.vueRecap.mois, decalage), export: null } });
    chargerMoisRecap();
  },
  afficher: (affichage) => { changer({ vueRecap: { ...etat.vueRecap, affichage } }); rendre(); },
  exporter: async () => {
    const changerExport = (valeur) => { changer({ vueRecap: { ...etat.vueRecap, export: valeur } }); rendre(); };
    changerExport({ enCours: true });
    try {
      const r = await exporterSheet({ idSheet: lireIdSheet(), moisAffiche: etat.vueRecap.mois, aujourdhui, source });
      const message = (r.nomAnnuel ? t('export.fait', { nombre: r.nombreMois, annuel: r.nomAnnuel }) : t('export.fait.sansAnnuel', { onglet: r.nomOnglet }));
      changerExport({ message, lien: estDemo ? '' : r.lien, erreur: '' });
    } catch (erreur) {
      changerExport({ erreur: t('erreur.ecriture', { detail: erreur.message }) });
    }
  }
};

// ---------- Réglages ----------

const actionsReglages = {
  enregistrer: async (saisie) => {
    changer({ vueReglages: { enCours: true, erreur: '', saisie } });
    rendre();
    try {
      await enregistrerReglages({ idSheet: lireIdSheet(), saisie, source });
      await rafraichir();
      changer({ vueReglages: { enCours: false, erreur: '' } });
      montrerMessage(t('reglages.enregistres'));
    } catch (erreur) {
      changer({ vueReglages: { enCours: false, saisie, erreur: erreur.message } });
      rendre();
    }
  },
  ouvrirSheet: () => window.open(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(lireIdSheet())}/edit`, '_blank', 'noopener'),
  changerSheet: () => { ecrireIdSheet(''); changer({ donnees: null, onglet: 'agenda' }); demanderSheet(); },
  deconnecter: () => { deconnecter(); changer({ donnees: null, connecte: false, onglet: 'agenda', connexionEnCours: false }); demanderConnexion(); }
};

const creneauxDuJour = (date) => etat.donnees.jours.find((j) => j.date === date)?.creneaux || [];

// Relit la semaine sans écran de chargement (après un ajout, un renommage ou une suppression).
async function rafraichir() {
  const donnees = await chargerSemaine({ lundi: etat.lundi, idSheet: lireIdSheet(), aujourdhui, source });
  changer({ donnees });
}

async function charger() {
  const idSheet = lireIdSheet();
  if (!idSheet) return demanderSheet();
  changer({ tri: null });
  afficher(ecranChargement());
  try {
    const donnees = await chargerSemaine({ lundi: etat.lundi, idSheet, aujourdhui, source });
    changer({ donnees });
    rendre();
    if (donnees.synchro.ajoutes) montrerMessage(t('semaine.synchro', { nombre: donnees.synchro.ajoutes }));
  } catch (erreur) {
    afficher(ecranErreur({
      message: erreur.message,
      onReessayer: charger,
      onChangerSheet: estDemo ? null : () => { ecrireIdSheet(''); demanderSheet(); }
    }));
  }
}

// ---------- Trier ----------

function ouvrirTri(file) {
  if (!file.length) return;
  changer({ tri: { file, position: 0, enCours: false, erreur: '', mode: '' } });
  rendre();
  // Pas de focus sur la recherche : le clavier ne s'ouvre qu'en touchant le champ (plus de place pour la liste).
}

function fermerTri() {
  changer({ tri: null });
  rendre();
}

function passer() {
  const { tri } = etat;
  if (tri.position + 1 >= tri.file.length) return fermerTri();
  changer({ tri: { ...tri, position: tri.position + 1, erreur: '', mode: '' } });
  rendre();
}

// Après l'écriture : le créneau prend son nouveau choix dans la semaine affichée (sans tout relire).
function appliquerChoixLocal(date, idCreneau, choix) {
  const jours = etat.donnees.jours.map((jour) => (jour.date !== date ? jour : {
    ...jour, creneaux: jour.creneaux.map((c) => (c.id === idCreneau ? { ...c, choix, enregistre: true } : c))
  }));
  changer({ donnees: { ...etat.donnees, jours, resume: resumeSemaine(jours, etat.donnees.reglages.tempsDeTravail) } });
}

async function choisir(choix) {
  const { tri } = etat;
  const { date, creneau } = tri.file[tri.position];
  changer({ tri: { ...tri, enCours: true, erreur: '' } });
  rendre();
  try {
    await attribuer({ idSheet: lireIdSheet(), date, creneau, choix, creneauxDuJour: creneauxDuJour(date), source });
    appliquerChoixLocal(date, creneau.id, choix);
    const fini = tri.position + 1 >= tri.file.length;
    changer({ tri: fini ? null : { ...tri, position: tri.position + 1, enCours: false, mode: '' } });
    if (fini) montrerMessage(tri.file.length > 1 ? t('tri.fini') : t('tri.enregistre'));
    else rendre();
  } catch (erreur) {
    changer({ tri: { ...etat.tri, enCours: false, erreur: t('erreur.ecriture', { detail: erreur.message }) } });
    rendre();
  }
}

// Créneau ajouté à la main : renommer (1er appel = champ, 2e = enregistrer), supprimer (2e appui = confirmer).
async function renommer(titre) {
  const { tri } = etat;
  if (titre === undefined) {
    changer({ tri: { ...tri, mode: 'renommer', erreur: '' } });
    return rendre();
  }
  const { date, creneau } = tri.file[tri.position];
  await executerSurCreneau(async () => {
    const nouveauTitre = await renommerManuel({ idSheet: lireIdSheet(), date, id: creneau.id, titre, source });
    const file = tri.file.map((element, i) => (i !== tri.position ? element
      : { ...element, creneau: { ...element.creneau, titre: nouveauTitre } }));
    await rafraichir();
    changer({ tri: { ...etat.tri, file, enCours: false, mode: '' } });
    montrerMessage(t('manuel.renomme'));
  });
}

async function supprimer() {
  const { tri } = etat;
  if (tri.mode !== 'supprimer') {
    changer({ tri: { ...tri, mode: 'supprimer', erreur: '' } });
    return rendre();
  }
  const { date, creneau } = tri.file[tri.position];
  await executerSurCreneau(async () => {
    await supprimerManuel({ idSheet: lireIdSheet(), date, id: creneau.id, source });
    await rafraichir();
    changer({ tri: null });
    montrerMessage(t('manuel.supprime'));
  });
}

async function executerSurCreneau(action) {
  changer({ tri: { ...etat.tri, enCours: true, erreur: '' } });
  rendre();
  try {
    await action();
  } catch (erreur) {
    changer({ tri: { ...etat.tri, enCours: false, erreur: t('erreur.ecriture', { detail: erreur.message }) } });
    rendre();
  }
}

// ---------- Nouveau créneau ----------

function ouvrirNouveau() {
  const date = etat.jourChoisi;
  changer({ nouveau: { date, titre: '', ...heuresParDefaut(date, aujourdhui), enCours: false, erreur: '' } });
  rendre();
  document.getElementById('manuel-titre')?.focus({ preventScroll: true });
}

function fermerNouveau() {
  changer({ nouveau: null });
  rendre();
}

async function creerManuel(choix, champs) {
  const { nouveau } = etat;
  changer({ nouveau: { ...nouveau, ...champs, enCours: true, erreur: '' } });
  rendre();
  try {
    await ajouterManuel({ idSheet: lireIdSheet(), date: nouveau.date, ...champs, choix, creneauxDuJour: creneauxDuJour(nouveau.date), source });
    await rafraichir();
    changer({ nouveau: null });
    montrerMessage(t('manuel.ajoute'));
  } catch (erreur) {
    changer({ nouveau: { ...etat.nouveau, enCours: false, erreur: erreur.message } });
    rendre();
  }
}

document.addEventListener('keydown', (evenement) => {
  if (evenement.key !== 'Escape') return;
  if (etat.tri && !etat.tri.enCours) fermerTri();
  else if (etat.nouveau && !etat.nouveau.enCours) fermerNouveau();
  else if (etat.onglet === 'projets' && etat.vueProjets.feuille && !etat.vueProjets.feuille.enCours) actionsEcranProjets.fermer();
  else if (etat.onglet === 'charge' && etat.vueCharge.feuille && !etat.vueCharge.feuille.enCours) actionsEcranCharge.fermer();
});

// ---------- Connexion et Sheet ----------

// Premier passage : créer son Sheet Hours (recommandé), ou relier un Sheet Hours existant (vérifié avant usage).
function demanderSheet(erreur = '', formulaireOuvert = false, enCours = false) {
  afficher(ecranSheet({
    erreur, enCours, formulaireOuvert,
    onOuvrirFormulaire: () => demanderSheet('', true),
    onCreer: async () => {
      demanderSheet('', formulaireOuvert, true);
      try {
        const id = await creerSheet({ aujourdhui, source });
        ecrireIdSheet(id);
        changer({ onglet: 'reglages', vueReglages: { enCours: false, erreur: '', bienvenue: true } });
        await charger();
        montrerMessage(t('sheet.cree'));
      } catch (e) {
        demanderSheet(e.message, formulaireOuvert);
      }
    },
    onValider: async (lien) => {
      const id = idSheetDepuisLien(lien);
      if (!id) return demanderSheet(t('sheet.invalide'), true);
      demanderSheet('', true, true);
      try {
        await verifierSheet({ idSheet: id, source });
        ecrireIdSheet(id);
        charger();
      } catch (e) {
        demanderSheet(e.message, true);
      }
    }
  }));
}

function demanderConnexion() {
  afficher(ecranConnexion({
    configure: Boolean(CLIENT_ID),
    enCours: etat.connexionEnCours,
    onConnecter: async () => {
      changer({ connexionEnCours: true });
      demanderConnexion();
      try {
        await connecter({ invite: false });
        changer({ connecte: true });
        charger();
      } catch (erreur) {
        changer({ connexionEnCours: false });
        afficher(ecranErreur({ message: erreur.message, onReessayer: demanderConnexion }));
      }
    }
  }));
}

if (estDemo) {
  charger();
} else {
  demanderConnexion();
}
