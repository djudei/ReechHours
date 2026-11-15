// Brouillon d'email du récap mensuel : texte du message (calcul pur), puis mise en forme pour Gmail.
// Le message n'est JAMAIS envoyé par l'appli : il attend dans les brouillons Gmail de la personne.
import { t } from './textes.js';
import { duree } from './format.js';
import { calendrier } from './textes.js';

const jours = (minutes, minutesParJour) => (minutes / minutesParJour).toFixed(2).replace('.', ',');
const nomMois = (cle) => {
  const [annee, mois] = cle.split('-').map(Number);
  return `${calendrier.NOMS_MOIS[mois - 1]} ${annee}`;
};
const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * recap : construireRecap() du mois ; reglages : interpreterReglages() ;
 * charge : { mois, zones: [{ categorie, elements }], aVenir } (zones vides ignorées) ou null.
 * → { a, sujet, corps } (texte brut).
 */
export function construireEmail({ recap, reglages, charge }) {
  const mpj = recap.minutesParJour;
  const ligneTemps = (minutes) => `${duree(minutes)} (${jours(minutes, mpj)} j)`;
  const arrete = recap.dateLimite ? t('email.arrete', { date: `${recap.dateLimite.slice(8, 10)}/${recap.dateLimite.slice(5, 7)}` }) : '';
  const nom = reglages.nomDocs || '';
  const lignes = [];

  lignes.push(reglages.prenomDestinataire ? t('email.bonjourPrenom', { prenom: reglages.prenomDestinataire }) : t('email.bonjour'), '');
  const mois = nomMois(recap.mois);
  const de = /^[aeiouyàâéèêîôû]/i.test(mois) ? `d'${mois}` : `de ${mois}`;   // « d'octobre », « de novembre »
  lignes.push(t('email.intro', { deMois: de, arrete }), '');

  // Synthèse du mois
  lignes.push(`${t('recap.travaille')} : ${ligneTemps(recap.totalTravailleMinutes)}`);
  if (recap.avecBase) {
    const ecart = recap.totalEcartMinutes;
    lignes.push(`${t('recap.base')} : ${ligneTemps(recap.totalBaseMinutes)}`);
    lignes.push(`${ecart >= 0 ? t('recap.audela') : t('recap.enDessous')} : ${ecart > 0 ? '+' : ecart < 0 ? '−' : ''}${ligneTemps(Math.abs(ecart))}`);
  }
  if (recap.nonTravailleMinutes) lignes.push(`${t('email.conges')} : ${jours(recap.nonTravailleMinutes, mpj)} j`);
  if (recap.aAttribuerMinutes) lignes.push(t('email.aAttribuer', { duree: duree(recap.aAttribuerMinutes) }));

  // Temps par projet : clients puis lignes internes, chacun par N°
  const groupes = [
    { titre: t('categorie.projet'), liste: recap.projets.filter((p) => p.type !== 'interne') },
    { titre: t('categorie.interne'), liste: recap.projets.filter((p) => p.type === 'interne') }
  ];
  groupes.forEach(({ titre, liste }) => {
    if (!liste.length) return;
    const total = liste.reduce((somme, p) => somme + p.minutes, 0);
    lignes.push('', `${titre} : ${ligneTemps(total)}`);
    [...liste].sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true }))
      .forEach((p) => lignes.push(`- ${p.code} · ${p.nom} : ${ligneTemps(p.minutes)}`));
  });

  // Charge du mois suivant (à défaut, celle du mois)
  const zones = (charge?.zones || []).filter((z) => z.elements.length);
  if (zones.length) {
    lignes.push('', `${charge.aVenir ? t('email.chargeAVenir') : t('email.charge')} – ${majuscule(nomMois(charge.mois))}`);
    zones.forEach((z) => {
      lignes.push('', z.categorie);
      z.elements.forEach((e) => lignes.push(`- ${e.replace(/^[-•]\s*/, '')}`));
    });
  }

  lignes.push('', reglages.signature || nom);
  return {
    a: reglages.emailDestinataire || '',
    sujet: t('email.sujet', { mois: majuscule(nomMois(recap.mois)), nom }).trim().replace(/\s+–\s*$/, ''),
    corps: lignes.join('\n')
  };
}

// UTF-8 → base64 (navigateur et Node).
function base64(texte) {
  let binaire = '';
  new TextEncoder().encode(texte).forEach((octet) => { binaire += String.fromCharCode(octet); });
  return btoa(binaire);
}

/**
 * { a, sujet, corps } → le message au format attendu par Gmail (« raw », base64 « url »).
 * Sujet encodé pour garder les accents ; corps en texte brut UTF-8.
 */
export function messageBrut({ a, sujet, corps }) {
  const entetes = [
    ...(a ? [`To: ${a}`] : []),
    `Subject: =?UTF-8?B?${base64(sujet)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64'
  ];
  const corps76 = base64(corps.replace(/\n/g, '\r\n')).replace(/.{76}/g, '$&\r\n');
  const message = `${entetes.join('\r\n')}\r\n\r\n${corps76}`;
  return base64(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
