// Filet de sécurité : si le site ne démarre pas (navigateur trop ancien, fichier manquant, erreur),
// la raison s'affiche à l'écran au lieu d'une page vide. Script classique, chargé avant tout le reste.
(function () {
  var DELAI_DEMARRAGE_MS = 6000;
  var erreurs = [];

  function afficherPanne() {
    var racine = document.getElementById('appli');
    if (!racine || racine.childElementCount > 0) return;
    var bloc = document.createElement('div');
    bloc.className = 'panne';
    var titre = document.createElement('h1');
    titre.textContent = 'Hours n’a pas pu démarrer';
    var texte = document.createElement('p');
    texte.textContent = 'Recharge la page. Si l’écran reste ainsi, envoie une capture de ce message.';
    var detail = document.createElement('pre');
    detail.textContent = erreurs.length ? erreurs.join('\n') : 'Aucune erreur signalée par le navigateur (' + navigator.userAgent + ').';
    bloc.append(titre, texte, detail);
    racine.append(bloc);
  }

  window.addEventListener('error', function (evenement) {
    var source = evenement.filename ? ' (' + evenement.filename.split('/').pop() + ':' + evenement.lineno + ')' : '';
    var cible = evenement.target && evenement.target.src ? 'Fichier non chargé : ' + evenement.target.src : '';
    erreurs.push(cible || (evenement.message + source));
    afficherPanne();
  }, true);
  window.addEventListener('unhandledrejection', function (evenement) {
    erreurs.push(String(evenement.reason && evenement.reason.message || evenement.reason));
    afficherPanne();
  });
  setTimeout(afficherPanne, DELAI_DEMARRAGE_MS);
})();
