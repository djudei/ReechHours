// Synchronisation des projets avec la base agence : message de résultat et rythme de la synchronisation automatique
// (au démarrage, au plus toutes les 6 heures, sans bruit si rien ne change).
import { t } from './textes.js';
import { DELAI_SYNCHRO_AUTO_MS } from './agence.js';

const CLE_DERNIERE_SYNCHRO = 'reechhours.synchroAgence';

/** { ajoutes, archives, liens } → une phrase ; rien de changé → « déjà à jour ». */
export function messageSynchroAgence({ ajoutes, archives, liens }) {
  const morceaux = [
    ajoutes.length ? t('agence.projets.ajoutes', { nombre: ajoutes.length, liste: ajoutes.join(', ') }) : '',
    archives.length ? t('agence.projets.archives', { nombre: archives.length, liste: archives.join(', ') }) : '',
    liens.length ? t('agence.projets.liens', { nombre: liens.length }) : ''
  ].filter(Boolean);
  return morceaux.length ? morceaux.join(' ') : t('agence.projets.aJour');
}

export function synchroAgenceDue(maintenant = Date.now()) {
  try {
    return maintenant - Number(localStorage.getItem(CLE_DERNIERE_SYNCHRO) || 0) >= DELAI_SYNCHRO_AUTO_MS;
  } catch {
    return false;
  }
}

export function noterSynchroAgence(maintenant = Date.now()) {
  try { localStorage.setItem(CLE_DERNIERE_SYNCHRO, String(maintenant)); } catch { /* navigation privée */ }
}
