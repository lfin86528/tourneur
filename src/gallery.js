// Sorting the gallery by wood, type of piece, or turner. Woods are typed freely
// ("Noyer – Buis", "Loupe d'érable", "Erable moucheté", even "Noye"), so a piece
// is listed under each wood it names, grouped by species.

// Types of piece, in display order (the server keeps the same keys).
export const PIECE_KINDS = [
  ['vase', 'Vases'],
  ['bowl', 'Bowls and cups'],
  ['plate', 'Plates and dishes'],
  ['box', 'Boxes'],
  ['mill', 'Salt and pepper mills'],
  ['pen', 'Pens'],
  ['light', 'Lamps and candlesticks'],
  ['sculpture', 'Sculptures and art pieces'],
  ['other', 'Other pieces'],
];
export const UNKNOWN_WOOD = '';

const key = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// "Noyer – Buis", "Noyer-Buis-Erable", "Aulne & Poirier", "Hêtre et érable" → one name per wood.
export function woodNames(text) {
  return String(text || '')
    .split(/\s+[–—-]\s+|\s*[,;/+]\s*|\s+&\s+|\s+et\s+/i)
    .flatMap((part) => (/\s/.test(part.trim()) ? [part] : part.split('-')))
    .map((part) => part.trim().replace(/^(loupe|ronce|broussin)\s+(de\s+|d['’]\s*)/i, ''))
    .filter((part) => part.length > 1)
    .map(capitalize);
}

// "Noye" is "Noyer" with a letter missing (and "Tlleul" is "Tilleul").
const missingLetter = (short, long) => long.length === short.length + 1 && [...long].some((_, i) => long.slice(0, i) + long.slice(i + 1) === short);

// Maps each spelling to its group: accents and case ignored, a qualified species
// joins its species ("Érable moucheté" → Érable), and a spelling missing a
// letter joins the complete one ("Noye" → Noyer). The label keeps the accented spelling.
export function woodGroups(photos) {
  const counts = new Map();
  const spellings = new Map();
  for (const photo of photos) {
    for (const name of new Set(woodNames(photo.wood))) {
      const k = key(name);
      counts.set(k, (counts.get(k) || 0) + 1);
      const variants = spellings.get(k) || new Map();
      variants.set(name, (variants.get(name) || 0) + 1);
      spellings.set(k, variants);
    }
  }
  const target = new Map();
  const ranked = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.length - b.length);
  for (const k of ranked) {
    const species = k.split(' ')[0];
    if (k !== species && counts.has(species)) {
      target.set(k, species);
      // "Érable moucheté" also votes for how "Érable" is spelt.
      for (const [name, n] of spellings.get(k)) {
        const word = name.split(' ')[0];
        spellings.get(species).set(word, (spellings.get(species).get(word) || 0) + n);
      }
    }
    else {
      const near = k.length >= 4 && ranked.find((other) => other !== k && (target.get(other) ?? other) === other && counts.get(other) >= counts.get(k) && missingLetter(k, other));
      target.set(k, near || k);
    }
  }
  const root = (k) => { let current = k; while (target.get(current) !== current) current = target.get(current); return current; };
  // A spelling with its accents first ("Érable" over "Erable"), then the most used.
  const label = (k) => [...spellings.get(k).entries()]
    .sort(([a, x], [b, y]) => Number(b.normalize('NFD') !== b) - Number(a.normalize('NFD') !== a) || y - x)[0][0];
  return (text) => [...new Set(woodNames(text).map((name) => root(key(name))))].map((k) => ({ key: k, label: label(k) }));
}

// Sections for the chosen sort: [{ key, label, photos }], fullest first for woods,
// in the usual order for types, alphabetical by surname for turners.
export function groupPhotos(photos, by, { t, unknownWood }) {
  if (by === 'kind') {
    return PIECE_KINDS.map(([kind, label]) => ({ key: kind, label: t(label), photos: photos.filter((photo) => (photo.kind || 'other') === kind) })).filter((group) => group.photos.length);
  }
  if (by === 'maker') {
    const groups = new Map();
    for (const photo of photos) {
      const k = key(photo.author || '');
      if (!groups.has(k)) groups.set(k, { key: k, label: photo.author || '—', photos: [] });
      groups.get(k).photos.push(photo);
    }
    const surname = (name) => key(name.split(' ').slice(-1)[0] + ' ' + name);
    return [...groups.values()].sort((a, b) => surname(a.label).localeCompare(surname(b.label)));
  }
  if (by === 'wood') {
    const woodsOf = woodGroups(photos);
    const groups = new Map();
    for (const photo of photos) {
      const woods = woodsOf(photo.wood);
      for (const { key: k, label } of woods.length ? woods : [{ key: UNKNOWN_WOOD, label: unknownWood }]) {
        if (!groups.has(k)) groups.set(k, { key: k, label, photos: [] });
        groups.get(k).photos.push(photo);
      }
    }
    return [...groups.values()].sort((a, b) => (a.key === UNKNOWN_WOOD) - (b.key === UNKNOWN_WOOD) || b.photos.length - a.photos.length || a.label.localeCompare(b.label));
  }
  return [{ key: 'all', label: '', photos }];
}
