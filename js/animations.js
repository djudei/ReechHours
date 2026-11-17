// Petites animations : elles confirment une action, ne font jamais attendre (moins d'une seconde).
// Coupées si l'appareil demande moins d'animations (réglage « Réduire les animations » de l'iPhone).

export function mouvementReduit() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Une animation qui ne doit jouer qu'une fois (un créneau qui vient d'être attribué, l'anneau d'une semaine).
const enAttente = new Set();

/** Le créneau `id` vient d'être attribué : son bloc rebondira au prochain affichage. */
export function signalerAttribue(id) { enAttente.add(id); }

/** true une seule fois après signalerAttribue(id). */
export function vientDEtreAttribue(id) {
  return enAttente.delete(id);
}

/**
 * Animation liée à `cle` (ex. l'anneau d'une semaine) : à la première demande, elle commence ; si l'écran est
 * redessiné pendant qu'elle joue, renvoie le temps déjà écoulé (pour la reprendre où elle en est, sans saut) ;
 * une fois finie, null : elle ne rejoue plus.
 */
const debuts = new Map();
export function enCoursDepuis(cle, dureeMs, maintenant = Date.now()) {
  if (!debuts.has(cle)) debuts.set(cle, maintenant);
  const ecoule = maintenant - debuts.get(cle);
  return ecoule < dureeMs ? ecoule : null;
}

const COULEURS = ['var(--orange)', 'var(--rose)', 'var(--bleu-nuit)', 'var(--projet-4)'];

/**
 * Pluie de confettis (une seconde environ), depuis un élément (ou le haut de l'écran), puis tout est retiré.
 */
export function confettis({ depuis = null, nombre = 36 } = {}) {
  if (mouvementReduit() || typeof document === 'undefined') return;
  const zone = depuis?.getBoundingClientRect?.();
  const x = zone ? zone.left + zone.width / 2 : window.innerWidth / 2;
  const y = zone ? zone.top + zone.height / 2 : window.innerHeight * 0.25;
  const calque = document.createElement('div');
  calque.className = 'confettis';
  calque.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < nombre; i++) {
    const morceau = document.createElement('span');
    const angle = Math.random() * Math.PI * 2;
    const elan = 60 + Math.random() * 120;
    morceau.style.left = `${x}px`;
    morceau.style.top = `${y}px`;
    morceau.style.background = COULEURS[i % COULEURS.length];
    morceau.style.setProperty('--dx', `${Math.cos(angle) * elan}px`);
    morceau.style.setProperty('--dy', `${Math.sin(angle) * elan * 0.6 - 40}px`);
    morceau.style.setProperty('--chute', `${160 + Math.random() * 140}px`);
    morceau.style.setProperty('--tour', `${Math.round(Math.random() * 720 - 360)}deg`);
    morceau.style.animationDelay = `${Math.random() * 80}ms`;
    if (i % 3 === 0) morceau.classList.add('rond');
    calque.append(morceau);
  }
  document.body.append(calque);
  setTimeout(() => calque.remove(), 1500);
}
