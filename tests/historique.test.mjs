// Tests de la fusion de l'historique des recherches : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionnerHistoriques, HISTORIQUE_MAX } from '../src/js/historique-outils.js';

test('fusion : doublons retirés (plus récent gardé), ordre du plus récent au plus ancien', () => {
  const pc = [{ q: 'r:بشر', t: 30 }, { q: '2:255', t: 10 }];
  const portable = [{ q: '2:255', t: 40 }, { q: 'sabr', t: 20 }];
  assert.deepEqual(fusionnerHistoriques(pc, portable), [{ q: '2:255', t: 40 }, { q: 'r:بشر', t: 30 }, { q: 'sabr', t: 20 }]);
});

test('fusion : 50 au plus, éléments mal formés ignorés', () => {
  const longue = Array.from({ length: 70 }, (_, i) => ({ q: `q${i}`, t: i }));
  const r = fusionnerHistoriques(longue, [null, { q: 3, t: 1 }, { q: 'x' }, { q: '  ', t: 99 }], 'pas une liste');
  assert.equal(r.length, HISTORIQUE_MAX);
  assert.equal(r[0].q, 'q69');
  assert.ok(r.every((x) => /^q\d+$/.test(x.q)));
});

test('fusion : recherche coupée à 200 caractères et espaces retirés', () => {
  const r = fusionnerHistoriques([{ q: `  ${'a'.repeat(300)}  `, t: 1 }]);
  assert.equal(r[0].q.length, 200);
});
