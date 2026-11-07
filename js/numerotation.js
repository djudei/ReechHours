// Numéro de projet automatique (repris de Numerotation.gs) : le prochain N° est proposé à la création (modifiable).
// Le compteur repart du plus grand N° de la même série, archives comprises : un N° ne sert jamais deux fois.
import { t } from './textes.js';

export const FORMAT_AGENCE = 'REECH';
export const FORMATS_NUMERO = [FORMAT_AGENCE, 'YYYY-001', 'YYYYMM-001', '001-YYYY-MM', '1', 'CLIENT-001', 'CATEGORY-001'];
export const FORMAT_NUMERO_PAR_DEFAUT = FORMAT_AGENCE;
// Numéros de l'agence : lignes internes 1001, 1002… ; projets clients 2001, 2002… (la base agence suit cette règle).
const SERIES_AGENCE = { interne: { prefixe: '10', chiffres: 2 }, projet: { prefixe: '2', chiffres: 3 } };
export const FORMAT_CLIENT = 'CLIENT-001';
const FORMAT_CATEGORIE = 'CATEGORY-001';
const CHIFFRE_CATEGORIE = { interne: '0', projet: '1', autre: '2' };
const COMPTEUR_MAX_CATEGORIE = 999;
const LETTRES_CLIENT_MAX = 6;
const CHIFFRES_COMPTEUR = 3;

const completerZeros = (nombre, chiffres) => String(nombre).padStart(chiffres, '0');
const compteur = (n) => completerZeros(n, CHIFFRES_COMPTEUR);

function avecPrefixe(prefixe, options = '') {
  return { motif: new RegExp(`^${prefixe}(\\d+)$`, options), ecrire: (n) => `${prefixe}${compteur(n)}` };
}

function serieNumero(format, periode, lettres, type) {
  const annee = String(periode.annee);
  const mois = completerZeros(periode.mois, 2);
  switch (format) {
    case 'YYYY-001':
      return avecPrefixe(`${annee}-`);
    case 'YYYYMM-001':
      return avecPrefixe(`${annee}${mois}-`);
    case '001-YYYY-MM':
      return { motif: new RegExp(`^(\\d+)-${annee}-${mois}$`), ecrire: (n) => `${compteur(n)}-${annee}-${mois}` };
    case '1':
      return { motif: /^(\d+)$/, ecrire: String };
    case FORMAT_AGENCE: {
      const { prefixe, chiffres } = SERIES_AGENCE[type] || SERIES_AGENCE.projet;
      const max = 10 ** chiffres - 1;
      return {
        motif: new RegExp(`^${prefixe}(\\d{${chiffres}})$`),
        ecrire: (n) => {
          if (n > max) throw new Error(t('numero.erreur.plein', { max }));
          return `${prefixe}${completerZeros(n, chiffres)}`;
        }
      };
    }
    case FORMAT_CLIENT: {
      const propres = nettoyerLettres(lettres);
      if (!propres) throw new Error(t('numero.erreur.lettres', { max: LETTRES_CLIENT_MAX }));
      return avecPrefixe(`${propres}-`, 'i');
    }
    case FORMAT_CATEGORIE: {
      const chiffre = CHIFFRE_CATEGORIE[type] ?? CHIFFRE_CATEGORIE.projet;
      return {
        motif: new RegExp(`^${chiffre}(\\d{3})$`),
        ecrire: (n) => {
          if (n > COMPTEUR_MAX_CATEGORIE) throw new Error(t('numero.erreur.plein', { max: COMPTEUR_MAX_CATEGORIE }));
          return `${chiffre}${compteur(n)}`;
        }
      };
    }
    default:
      throw new Error(t('numero.erreur.format', { format }));
  }
}

/**
 * Prochain N° pour ce format d'après les N° existants. periode : { annee, mois } ;
 * lettres : format client seulement ; type : format par catégorie seulement.
 */
export function prochainNumero(format, codes, periode, lettres = '', type = 'projet') {
  const serie = serieNumero(format, periode, lettres, type);
  const plusGrand = codes.reduce((max, code) => {
    const trouve = serie.motif.exec(String(code).trim());
    return trouve ? Math.max(max, Number(trouve[1])) : max;
  }, 0);
  return serie.ecrire(plusGrand + 1);
}

/**
 * « l'Écume » → LECUME : lettres et chiffres, sans accents, 6 au plus.
 */
export function nettoyerLettres(texte) {
  return String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LETTRES_CLIENT_MAX);
}

/**
 * Lettres proposées d'après le nom du projet : son premier mot (« Acme refonte » → ACME).
 */
export function lettresClient(nom) {
  return nettoyerLettres(String(nom ?? '').trim().split(/\s+/)[0]);
}

/**
 * N° proposé pour un nouveau projet ; format client sans lettres ni nom → "" (rien à proposer encore).
 */
export function proposerNumero({ format, codes, periode, lettres, nom, type }) {
  if (format !== FORMAT_CLIENT) return prochainNumero(format, codes, periode, '', type);
  const propres = nettoyerLettres(lettres) || lettresClient(nom);
  return propres ? prochainNumero(format, codes, periode, propres) : '';
}
