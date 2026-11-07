# ReechHours

**ReechHours transforme ton Google Agenda en feuille de temps**, avec les règles de l'agence. C'est la version web de Timesheets+ : elle lit et écrit **le même Google Sheet**, les deux applis peuvent donc servir en même temps.

Construite à partir de [Hours](https://github.com/djudei/Hours).

## Ce que fait ReechHours

- **Agenda** : ta semaine en grille horaire. Touche une réunion pour l'attribuer à un projet, la marquer en Non travaillé, Pause ou Ignoré. Les titres `CLIENT | sujet` sont attribués automatiquement quand il n'y a aucun doute.
- **Charge** : tes missions du mois, par zones (AO & Reco, Projets en cours, Projets à venir, Projets en clôture, Développement commercial).
- **Projets** : numéros de l'agence (10XX lignes internes, 2XXX projets clients).
- **Récap** : temps travaillé, base 35h, au-delà ; mise à jour des onglets du mois et du récap annuel dans ton Sheet.

**Règle d'or : dans le doute, on n'écrit pas, on signale.**

## Tes données

- Tout se passe **dans ton navigateur**, qui parle directement à Google. Aucun serveur intermédiaire.
- Accès demandés : **lecture de ton Agenda** (jamais modifié) et **Google Sheets** (ton Sheet Timesheets+).
- Connexion réservée aux comptes Google de l'agence.

## Pour les curieux du code

- HTML, CSS et JavaScript, sans outil de construction : les fichiers sont servis tels quels par GitHub Pages.
- Tous les mots du Sheet (onglets, en-têtes, valeurs) sont dans `js/schema.js`.
- Tests : `npm test` (Node 20 ou plus récent). Démo avec des données inventées : `index.html?demo`.
- L'identifiant client OAuth de `js/config.js` n'est pas un secret : Google le prévoit visible dans la page.

## Licence

[MIT](LICENSE)
