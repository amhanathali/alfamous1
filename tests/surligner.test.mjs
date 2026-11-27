// Surlignage du terme filtré (tous les onglets) : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  plages, surlignerDans, effacerSurlignage, plierDigrammes, extrait, avecTerme,
} from '../src/js/surligner.js';

const dom = (html) => new JSDOM(`<div id="r">${html}</div>`).window.document.querySelector('#r');
const marques = (r) => [...r.querySelectorAll('mark.surligne-filtre')].map((m) => m.textContent);

test('plages : sans majuscules ni accents', () => {
  assert.deepEqual(plages('al-Fātiḥa', 'fatiha'), [[3, 9]]);
  assert.deepEqual(plages('Éveil, éveil', 'EVEIL'), [[0, 5], [7, 12]]);
  assert.deepEqual(plages('rien', ''), []);
});

test('plages : arabe sans voyelles, formes d\'alif confondues, voyelles finales comprises', () => {
  const t = 'ٱلرَّحْمَـٰنِ';
  const [[a, b]] = plages(t, 'رحمن');
  assert.equal(t.slice(a, b), 'رَّحْمَـٰنِ');
  assert.equal(plages('الإخلاص', 'الاخلاص').length, 1);
});

test('plages : debut (numéro de sourate)', () => {
  assert.deepEqual(plages('11', '1', { debut: true }), [[0, 1]]);
  assert.deepEqual(plages('21', '1', { debut: true }), []);
});

test('plierDigrammes : « kawthar » trouve al-Kawṯar', () => {
  assert.equal(plages('al-Kawṯar', 'kawthar').length, 0);
  assert.equal(plages('al-Kawṯar', 'kawthar', { plier: plierDigrammes }).length, 1);
});

test('surlignerDans / effacerSurlignage : texte seulement, liens intacts, réversible', () => {
  const r = dom('<p>La Peur, <a href="https://peur.ca">la peur</a> &amp; moi</p>');
  surlignerDans(r, 'peur');
  assert.deepEqual(marques(r), ['Peur', 'peur']);
  assert.equal(r.querySelector('a').getAttribute('href'), 'https://peur.ca');
  effacerSurlignage(r);
  assert.equal(r.querySelectorAll('mark').length, 0);
  assert.equal(r.innerHTML, '<p>La Peur, <a href="https://peur.ca">la peur</a> &amp; moi</p>');
});

test('surlignerDans : rien si terme vide ou absent ; ne surligne pas deux fois', () => {
  const r = dom('<p>texte</p>');
  assert.equal(surlignerDans(r, ''), null);
  assert.equal(surlignerDans(r, 'x.y'), null);
  surlignerDans(r, 'tex');
  surlignerDans(r, 'tex');
  assert.equal(r.querySelectorAll('mark').length, 1);
});

test('extrait : avec accents, commence près du passage trouvé', () => {
  const e = extrait(`${'mot '.repeat(80)}Révélé ensuite`, 180, 'revele');
  assert.ok(e.startsWith('…') && e.includes('Révélé'));
  assert.equal(extrait('court', 180, 'absent'), 'court');
});

test('avecTerme', () => {
  assert.equal(avecTerme('#/fil/x', ' peur '), '#/fil/x?q=peur');
  assert.equal(avecTerme('#/fil/x', ''), '#/fil/x');
});
