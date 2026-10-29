## Development

React (Vite) + PHP API + SQLite (no longer Astro). `npm run dev` starts Vite and
`php -S` together; `npm test` runs the API tests, `npm run test:i18n` the French
strings check, `npm run build && npm run test:ui` the browser check.

- Single moderator account; French only (English keys in `t()` map to `src/locales/fr.js`).
- Page texts are content blocks (`src/contentBlocks.js`): never rename a shipped key.
- Never put `data/`, `uploads/` or `app/config.php` in Git. Deployment: see DEPLOYMENT.md.
