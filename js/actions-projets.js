// Actions de l'écran Projets : ouvrir / fermer les feuilles, créer, renommer, archiver, supprimer.
// « appli » donne accès à l'état et aux outils communs de app.js (lire, changer, rendre, message, relire).
import { creerProjet, changerStatutProjet, renommerProjet, supprimerProjet } from './donnees.js';
import { t } from './textes.js';

export function actionsProjets(appli) {
  const vue = () => appli.lire().vueProjets;
  const changerVue = (modifications) => appli.changer({ vueProjets: { ...vue(), ...modifications } });
  const changerFeuille = (modifications) => changerVue({ feuille: { ...vue().feuille, ...modifications } });
  const fermer = () => { changerVue({ feuille: null }); appli.rendre(); };
  const projet = () => appli.lire().donnees.projets.find((p) => p.code === vue().feuille.code);

  // Écriture : feuille en attente, puis relecture de la semaine et message ; en cas d'échec, la raison dans la feuille.
  async function ecrire(action, message, garderOuverte = false) {
    changerFeuille({ enCours: true, erreur: '' });
    appli.rendre();
    try {
      const texte = message(await action());
      await appli.relire();
      changerVue({ feuille: garderOuverte ? { ...vue().feuille, enCours: false, renommer: false, confirmer: false } : null });
      appli.message(texte);
    } catch (erreur) {
      changerFeuille({ enCours: false, erreur: erreur.message });
      appli.rendre();
    }
  }

  return {
    filtrer: (filtre) => { changerVue({ filtre }); appli.rendre(); },
    nouveau: () => {
      changerVue({ feuille: { mode: 'nouveau', type: 'projet', nom: '', lettres: '', code: '', codeTouche: false, enCours: false, erreur: '' } });
      appli.rendre();
      document.getElementById('projet-nom')?.focus({ preventScroll: true });
    },
    choisirType: (type, champs) => {
      changerFeuille({ ...champs, type, code: champs.codeTouche ? champs.code : '' });
      appli.rendre();
    },
    creer: (champs) => {
      changerFeuille(champs);
      return ecrire(() => creerProjet({ ...appli.acces(), code: champs.code, nom: champs.nom, type: vue().feuille.type }),
        (code) => t('projets.cree', { code }));
    },
    ouvrirProjet: (code) => {
      changerVue({ feuille: { mode: 'projet', code, renommer: false, confirmer: false, enCours: false, erreur: '' } });
      appli.rendre();
    },
    fermer,
    renommer: (nom) => {
      if (nom === undefined) {
        changerFeuille({ renommer: true, confirmer: false, erreur: '' });
        return appli.rendre();
      }
      return ecrire(() => renommerProjet({ ...appli.acces(), code: vue().feuille.code, nom }), () => t('projets.renomme'), true);
    },
    basculerStatut: () => {
      const { nom, statut } = projet();
      const nouveau = statut === 'actif' ? 'archivé' : 'actif';
      return ecrire(() => changerStatutProjet({ ...appli.acces(), code: vue().feuille.code, statut: nouveau }),
        () => t(nouveau === 'archivé' ? 'projets.archive' : 'projets.reactive', { nom }));
    },
    supprimer: () => {
      if (!vue().feuille.confirmer) {
        changerFeuille({ confirmer: true, renommer: false, erreur: '' });
        return appli.rendre();
      }
      const { nom } = projet();
      return ecrire(() => supprimerProjet({ ...appli.acces(), code: vue().feuille.code }), () => t('projets.supprime', { nom }));
    }
  };
}
