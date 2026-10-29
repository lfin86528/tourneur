# Mise en ligne de tourneur.ch (Plesk)

Le site est une application React servie par une petite API PHP avec une base
SQLite. Il remplace l'ancien site Astro et son administration Sveltia/GitHub.
Le contenu (pièces, nouvelles, documents, textes, messages) se gère
désormais **sur le site**, une fois connecté via « Administration » en bas de page.

## Ce qu'il faut côté serveur

- PHP 8.1 ou plus récent, avec les extensions **pdo_sqlite**, **gd** et **fileinfo**
  (exif conseillée, pour l'orientation des photos de téléphone) ;
- Apache avec **mod_rewrite** (le fichier `.htaccess` fait le routage) ;
- `upload_max_filesize` ≥ 20M et `post_max_size` ≥ 21M (le fichier `.user.ini`
  les règle ; sinon, dans Plesk : domaine → Paramètres PHP).

## Déploiement

Comme avant : un `git push` sur `main` déclenche GitHub Actions, qui construit le
site (`npm run build`) et publie le dossier `site/` sur la branche **deploy**.
Plesk récupère cette branche dans `httpdocs`.

La base de données et les photos ne sont **jamais** dans Git :

| Dossier | Contenu | Remarque |
|---|---|---|
| `data/` | `tourneur.db`, `secret.key`, journaux | créé à la première visite, protégé par `.htaccess` |
| `uploads/` | photos et documents envoyés | idem |

Si le déploiement Plesk est configuré pour **vider** `httpdocs` avant de copier,
placez ces dossiers hors du site : créez `tourneur-config.php` **à côté** de
`httpdocs` (même niveau, jamais touché par un déploiement) :

```php
<?php
return [
    'data_dir' => __DIR__ . '/tourneur-data',
    'uploads_dir' => __DIR__ . '/tourneur-uploads',
    // 'smtp' => ['host' => 'mail.example.ch', 'port' => 465, 'encryption' => 'ssl',
    //            'username' => 'noreply@tourneur.ch', 'password' => '…'],
];
```

Les autres réglages possibles sont décrits dans `app/config.example.php`.

## Première installation

1. Après le premier déploiement, ouvrez **https://tourneur.ch/setup.php**.
   La page vérifie PHP et crée la clé d'installation dans `data/setup-key.txt`.
2. Ouvrez ce fichier avec le Gestionnaire de fichiers de Plesk, recopiez la clé,
   puis choisissez votre nom, votre e-mail et votre mot de passe.
3. Les 4 pièces de l'ancien site sont importées automatiquement (une seule fois)
   avec leur date, leur bois et leur type. « Toto » (fiche de test) n'est pas reprise.
4. Vérifiez que https://tourneur.ch/data/tourneur.db répond « Forbidden ».

Il n'y a qu'**un seul compte** : le vôtre. `setup.php` devient inactif dès qu'il existe.

## E-mails du formulaire de contact

Les messages arrivent dans « Messages » et par e-mail à `info@tourneur.ch`
(réglage `contact_email`). L'expéditeur reçoit un accusé de réception. Le plus
fiable est un envoi SMTP authentifié (réglage `smtp`, voir ci-dessus) ; sans lui,
la fonction `mail()` de PHP est utilisée. Chaque envoi est noté dans `data/mail.log`.

## Référencement (Google et autres)

Le serveur complète chaque page pour les moteurs de recherche et les aperçus de
partage (WhatsApp, Facebook…) : titre et description propres à la page, adresse
canonique, image d'aperçu (la photo de la pièce ou de la nouvelle, sinon
`images/partage.jpg`), données schema.org (artisan, œuvres, articles) et le texte
principal lisible sans JavaScript. Chaque pièce a sa page (`/portfolio/grand-bol-en-noyer`),
dont l'adresse ne change plus même si le titre est corrigé.

- `https://tourneur.ch/sitemap.xml` et `robots.txt` sont générés à partir de la base ;
- les adresses inconnues répondent « 404 », l'administration n'est jamais indexée ;
- `http://` et `www.` sont redirigés vers `https://tourneur.ch` (réglage `site_url`).
  Le certificat SSL doit être actif dans Plesk (Let's Encrypt).

Après la mise en ligne : ajoutez le site dans **Google Search Console**
(https://search.google.com/search-console, propriété « Domaine » ou « Préfixe d'URL »),
puis envoyez-y `https://tourneur.ch/sitemap.xml`. Même chose, si vous le souhaitez,
dans **Bing Webmaster Tools** (qui alimente aussi DuckDuckGo et Ecosia).

## Mot de passe oublié

En SSH, dans `httpdocs` :

```
php app/cli/create-moderator.php --name "Lino Finini" --email info@tourneur.ch
```

Le compte existant est mis à jour (jamais doublé) et un mot de passe provisoire s'affiche une fois.

## Fichiers de l'ancien site

Si Plesk laisse les anciens fichiers en place, ils sont sans effet (le `.htaccess`
renvoie `/a-propos`, `/portfolio`, `/contact` et `/admin` vers le nouveau site),
mais vous pouvez les supprimer : `a-propos/`, `contact/`, `portfolio/`, `admin/index.html`,
`admin/config.yml`, `admin/manifest.json`, `pwa-icons/`, `images/pieces/`,
`global.css`, `logo.png`, `favicon.png`, `favicon.svg`.
Gardez `admin/sw.js` : il retire l'ancienne application d'administration des téléphones.

## Développement

```
npm install
npm run dev        # Vite + PHP (php doit être dans le PATH), données dans data/ et uploads/
npm test           # API PHP
npm run test:i18n  # textes français
npm run build && npm run test:ui   # contrôle dans le navigateur (Playwright)
npm run sync:wamp  # copie site/ vers C:/wamp64/www/tourneur.ch et liste les changements
```

En développement, un compte de démonstration est créé : `admin@tourneur.test` / `Demo2026!`.
