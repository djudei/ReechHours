// Construction des écrans sans jamais injecter de HTML : les titres d'Agenda et noms de projets
// viennent de l'extérieur, ils sont toujours posés comme du texte (pas de risque d'injection).

const NS_SVG = 'http://www.w3.org/2000/svg';

/**
 * h('button', { class: 'x', onclick: f, 'aria-label': '…' }, enfant1, 'texte', …) → élément.
 */
export function h(balise, attributs = {}, ...enfants) {
  const element = document.createElement(balise);
  poser(element, attributs);
  ajouter(element, enfants);
  return element;
}

/**
 * Même chose pour les dessins (anneau, icônes).
 */
export function s(balise, attributs = {}, ...enfants) {
  const element = document.createElementNS(NS_SVG, balise);
  poser(element, attributs);
  ajouter(element, enfants);
  return element;
}

function poser(element, attributs) {
  Object.entries(attributs || {}).forEach(([nom, valeur]) => {
    if (valeur === null || valeur === undefined || valeur === false) return;
    if (nom.startsWith('on') && typeof valeur === 'function') {
      element.addEventListener(nom.slice(2), valeur);
    } else if (nom === 'style' && typeof valeur === 'object') {
      Object.entries(valeur).forEach(([propriete, v]) => element.style.setProperty(propriete, v));
    } else {
      element.setAttribute(nom, valeur === true ? '' : String(valeur));
    }
  });
}

function ajouter(element, enfants) {
  enfants.flat(Infinity).forEach((enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    element.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  });
}

/**
 * Icône au trait (24 × 24), décorative : cachée aux lecteurs d'écran.
 */
export function icone(trace, taille = 22, epaisseur = 2) {
  return s('svg', { width: taille, height: taille, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': epaisseur, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
  s('path', { d: trace }));
}

export const TRACES = {
  agenda: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  charge: 'M4 6h16M4 12h16M4 18h10',
  projets: 'M3.5 8.5h17v11h-17zM8.5 8.5v-3h7v3',
  recap: 'M5 20v-8M10 20V5M15 20v-5M20 20V9',
  reglages: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  precedent: 'M15 5l-7 7 7 7',
  suivant: 'M9 5l7 7-7 7',
  actualiser: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  ajouter: 'M12 5v14M5 12h14'
};
