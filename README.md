# tourneur.ch

Le site d'un tourneur sur bois : portfolio classé par bois et par type, nouvelles,
documents, page « À propos » et formulaire de contact, avec une administration
sur le site même (un seul compte). React (Vite) + API PHP 8.1 + SQLite, construit
sur la même base que le site de l'amicale ART sur bois.

- `src/` : l'application React (textes de l'interface dans `src/locales/fr.js`,
  textes modifiables des pages dans `src/contentBlocks.js`) ;
- `php/` : l'API (`api.php`, `app/`), la page d'installation `setup.php`, le `.htaccess` ;
- `tests/` : tests de l'API (`npm test`) ; `scripts/ui-check.mjs` : contrôle dans le navigateur.

Mise en ligne et installation : voir [DEPLOYMENT.md](DEPLOYMENT.md).
