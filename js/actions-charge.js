// Actions de l'écran Charge : changer de mois, modifier / ajouter / retirer une zone, dupliquer vers le mois suivant.
// Chaque enregistrement remplace la charge du mois entier dans l'onglet Workload, puis la relit.
import { chargerCharge, enregistrerCharge, dupliquerCharge } from './donnees.js';
import { decalerMois, nomMois } from './ecran-recap.js';
import { t } from './textes.js';

export function actionsCharge(appli) {
  const vue = () => appli.lire().vueCharge;
  const changerVue = (modifications) => appli.changer({ vueCharge: { ...vue(), ...modifications } });
  const changerFeuille = (modifications) => changerVue({ feuille: { ...vue().feuille, ...modifications } });

  async function charger() {
    changerVue({ charge: null, erreur: '', feuille: null, confirmerDuplication: false });
    appli.rendre();
    try {
      const charge = await chargerCharge({ ...appli.acces(), mois: vue().mois });
      if (charge.mois === vue().mois) changerVue({ charge });
    } catch (erreur) {
      changerVue({ erreur: erreur.message });
    }
    appli.rendre();
  }

  // Enregistre toutes les zones du mois, puis relit (la feuille se ferme si tout va bien).
  async function enregistrerZones(zones, message) {
    changerFeuille({ enCours: true, erreur: '' });
    appli.rendre();
    try {
      await enregistrerCharge({ ...appli.acces(), mois: vue().mois, zones });
      await charger();
      appli.message(message);
    } catch (erreur) {
      changerFeuille({ enCours: false, erreur: erreur.message });
      appli.rendre();
    }
  }

  return {
    charger,
    changerMois: (decalage) => { changerVue({ mois: decalerMois(vue().mois, decalage) }); charger(); },
    ouvrirZone: (index) => {
      const zone = vue().charge.zones[index];
      changerVue({ feuille: { index, categorie: zone.categorie, texte: zone.elements.join('\n'), confirmerRetrait: false, enCours: false, erreur: '' } });
      appli.rendre();
    },
    ajouterZone: () => {
      const { zones, intitules } = vue().charge;
      const libre = intitules.find((c) => !zones.some((z) => z.categorie === c));
      changerVue({ feuille: { index: -1, categorie: libre, texte: '', confirmerRetrait: false, enCours: false, erreur: '' } });
      appli.rendre();
    },
    fermer: () => { changerVue({ feuille: null }); appli.rendre(); },
    choisirIntitule: (categorie, texte) => { changerFeuille({ categorie, texte }); appli.rendre(); },
    enregistrer: (texte) => {
      const { feuille, charge } = vue();
      changerFeuille({ texte });
      const zone = { categorie: feuille.categorie, elements: texte };
      const zones = feuille.index >= 0 ? charge.zones.map((z, i) => (i === feuille.index ? zone : z)) : [...charge.zones, zone];
      return enregistrerZones(zones, t('charge.enregistree', { mois: nomMois(vue().mois) }));
    },
    retirer: () => {
      const { feuille, charge } = vue();
      if (!feuille.confirmerRetrait) { changerFeuille({ confirmerRetrait: true }); return appli.rendre(); }
      return enregistrerZones(charge.zones.filter((_, i) => i !== feuille.index), t('charge.enregistree', { mois: nomMois(vue().mois) }));
    },
    dupliquer: async () => {
      changerVue({ enCours: true });
      appli.rendre();
      try {
        const r = await dupliquerCharge({ ...appli.acces(), mois: vue().mois, ecraser: vue().confirmerDuplication });
        if (!r.duplique) {
          changerVue({ enCours: false, confirmerDuplication: true });
          return appli.rendre();
        }
        changerVue({ enCours: false, confirmerDuplication: false });
        appli.message(t('charge.copiee', { mois: nomMois(r.cible) }));
      } catch (erreur) {
        changerVue({ enCours: false, erreur: erreur.message });
        appli.rendre();
      }
    }
  };
}
