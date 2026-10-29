// Page texts the turner can edit from "Textes des pages". Each block shows its
// built-in French text (`fallback`) until a text is saved. Keys are stored in
// SQLite: never rename a key once it has shipped. `untranslated` is kept from the
// ART sur bois code base (any saved text is used as written).
export const contentPages = [
  { id: 'home', label: 'Accueil', path: '/', blocks: [
    { key: 'home.eyebrow', label: 'Petit titre', fallback: 'Tournage sur bois' },
    { key: 'home.title', label: 'Titre principal', fallback: 'Pour donner vie au bois' },
    { key: 'home.intro', label: 'Introduction', fallback: 'Passionné de tournage sur bois, je façonne bols, vases et plateaux à partir de pièces brutes, une création à la fois.', multiline: true },
    { key: 'home.fact1Value', label: 'Chiffre clé 1', fallback: '21+' },
    { key: 'home.fact1Label', label: 'Chiffre clé 1, texte', fallback: 'clients satisfaits' },
    { key: 'home.fact2Value', label: 'Chiffre clé 2', fallback: '2+' },
    { key: 'home.fact2Label', label: 'Chiffre clé 2, texte', fallback: 'ans d’expérience' },
    { key: 'home.fact3Value', label: 'Chiffre clé 3', fallback: '50+' },
    { key: 'home.fact3Label', label: 'Chiffre clé 3, texte', fallback: 'collègues passionnés' },
    { key: 'home.photoCaption', label: 'Légende des photos tournantes', fallback: 'Sorti de l’atelier' },
    { key: 'home.contactTitle', label: 'Bandeau de contact, titre', fallback: 'Une question, une pièce sur mesure ?' },
    { key: 'home.contactText', label: 'Bandeau de contact, petit titre', fallback: 'Écrivez-moi' },
  ] },
  { id: 'portfolio', label: 'Portfolio', path: '/portfolio', blocks: [
    { key: 'gallery.eyebrow', label: 'Petit titre', fallback: 'Portfolio' },
    { key: 'gallery.title', label: 'Titre principal', fallback: 'Les pièces sorties de l’atelier' },
    { key: 'gallery.description', label: 'Introduction', fallback: 'Un aperçu des pièces réalisées jusqu’ici, à classer par bois ou par type.', multiline: true },
  ] },
  { id: 'news', label: 'Nouvelles', path: '/news', blocks: [
    { key: 'news.eyebrow', label: 'Petit titre', fallback: 'Nouvelles' },
    { key: 'news.title', label: 'Titre principal', fallback: 'Du côté de l’atelier' },
    { key: 'news.description', label: 'Introduction', fallback: 'Commandes, marchés, essais et nouvelles techniques.', multiline: true },
  ] },
  { id: 'documents', label: 'Documents', path: '/documents', blocks: [
    { key: 'resources.eyebrow', label: 'Petit titre', fallback: 'Documents' },
    { key: 'resources.title', label: 'Titre principal', fallback: 'À télécharger' },
    { key: 'resources.description', label: 'Introduction', fallback: 'Conseils d’entretien, informations pratiques et fiches à télécharger.', multiline: true },
  ] },
  { id: 'about', label: 'À propos', path: '/a-propos', blocks: [
    { key: 'about.eyebrow', label: 'Petit titre', fallback: 'À propos' },
    { key: 'about.title', label: 'Titre principal', fallback: 'Un type tourne du bois' },
    { key: 'about.text', label: 'Texte', fallback: 'Le tournage sur bois est avant tout une passion, pas une activité commerciale. Chaque pièce est façonnée à la main, du choix du bois brut jusqu’à la finition.', multiline: true },
    { key: 'about.signature', label: 'Signature (nom sous le texte)', fallback: 'Lino Finini' },
  ] },
  { id: 'contact', label: 'Contact', path: '/contact', blocks: [
    { key: 'contact.eyebrow', label: 'Petit titre', fallback: 'Contact' },
    { key: 'contact.title', label: 'Titre principal', fallback: 'Écrivez-moi' },
    { key: 'contact.description', label: 'Introduction', fallback: 'Pour toute question, une commande ou une pièce sur mesure : je vous réponds dès que possible.', multiline: true },
    { key: 'contact.email', label: 'Adresse affichée', fallback: 'info@tourneur.ch' },
    { key: 'contact.thanksTitle', label: 'Remerciement, titre', fallback: 'Merci, votre message est envoyé.' },
    { key: 'contact.thanksText', label: 'Remerciement, texte', fallback: 'Je vous réponds dès que possible. Une copie de votre message vous a été envoyée par e-mail.', multiline: true },
  ] },
  { id: 'footer', label: 'Pied de page', path: '/', blocks: [
    { key: 'footer.tagline', label: 'Phrase', fallback: 'Pour donner vie au bois.' },
    { key: 'footer.location', label: 'Lieu', fallback: 'Suisse romande' },
    { key: 'footer.owner', label: 'Nom après le ©', fallback: 'Lino Finini' },
  ] },
];

export const contentFallbacks = Object.fromEntries(contentPages.flatMap((page) => page.blocks.map((block) => [block.key, block.fallback])));
export const untranslatedKeys = new Set(contentPages.flatMap((page) => page.blocks.filter((block) => block.untranslated).map((block) => block.key)));
