import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPhotos, woodNames } from '../src/gallery.js';

const t = (text, values = {}) => text.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name]);
const labels = (groups) => groups.map((group) => `${group.label} ${group.photos.length}`);

test('woods are split, grouped by species, and slips joined to the right spelling', () => {
  assert.deepEqual(woodNames('Noyer – Buis'), ['Noyer', 'Buis']);
  assert.deepEqual(woodNames('Noyer-Buis-Erable'), ['Noyer', 'Buis', 'Erable']);
  assert.deepEqual(woodNames('Aulne & Poirier, hêtre et érable'), ['Aulne', 'Poirier', 'Hêtre', 'Érable']);
  assert.deepEqual(woodNames('Loupe d’érable'), ['Érable']);
  assert.deepEqual(woodNames('Contre-plaqué de bouleau'), ['Contre-plaqué de bouleau']);
  const photos = ['Noyer', 'Noyer américain', 'Noye', 'Erable', 'Érable moucheté – Padauk', 'Merisier', 'Merisier', 'Cerisier', 'Merisie', ''].map((wood, i) => ({ id: String(i), wood }));
  assert.deepEqual(labels(groupPhotos(photos, 'wood', { t, unknownWood: '?' })), ['Merisier 3', 'Noyer 3', 'Érable 2', 'Cerisier 1', 'Padauk 1', '? 1'],
    'Merisier and Cerisier stay apart (a different letter is a different wood); accents win in labels; unknown last');
});

test('types keep their order; makers are sorted by surname', () => {
  const photos = [{ kind: 'box', author: 'Paolo Rigo' }, { kind: 'vase', author: 'François Delay' }, { kind: 'box', author: 'Jérôme Blanc' }, { author: 'Paolo Rigo' }];
  assert.deepEqual(labels(groupPhotos(photos, 'kind', { t })), ['Vases 1', 'Boxes 2', 'Other pieces 1']);
  assert.deepEqual(labels(groupPhotos(photos, 'maker', { t })), ['Jérôme Blanc 1', 'François Delay 1', 'Paolo Rigo 2']);
});
