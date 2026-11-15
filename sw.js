// Toujours la dernière version de l'appli : chaque fichier du site est revérifié auprès de GitHub à chaque ouverture
// (s'il n'a pas changé, la réponse « inchangé » est minuscule). Sans réseau, la copie en mémoire du navigateur sert.
// Les appels à Google (Agenda, Sheets, connexion) ne passent jamais par ici.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evenement) => evenement.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (evenement) => {
  const demande = evenement.request;
  if (demande.method !== 'GET' || new URL(demande.url).origin !== self.location.origin) return;
  evenement.respondWith(fetch(new Request(demande.url, { cache: 'no-cache', credentials: 'same-origin' }))
    .catch(() => fetch(demande)));
});
