// Tests de la copie de versets : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trierReferences, composerCopie } from '../src/js/selection-outils.js';

test('références triées dans l\'ordre du Coran', () => {
  assert.deepEqual(trierReferences(['3:39', '2:155', '2:97', '112:1', '2:9']), ['2:9', '2:97', '2:155', '3:39', '112:1']);
});

const V = [{ ref: '2:97', ar: 'وَبُشْرَىٰ', tr: 'wabušrā', trad: 'bonne nouvelle' }, { ref: '3:39', ar: 'يُبَشِّرُكَ', tr: 'yubašširuka', trad: null }];

test('copie par défaut : référence, arabe, translittération', () => {
  const { texte, html } = composerCopie(V);
  assert.equal(texte, '[2:97]\nوَبُشْرَىٰ\nwabušrā\n\n[3:39]\nيُبَشِّرُكَ\nyubašširuka');
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<i>wabušrā<\/i>/);
});

test('options : sans translittération, avec commentaire traditionnel et lien', () => {
  const { texte, html } = composerCopie(V, { tr: false, trad: true, lien: true, nomTrad: 'Hamidullah', base: 'https://x/' });
  assert.equal(texte, '[2:97]\nوَبُشْرَىٰ\nHamidullah (commentaire traditionnel) : bonne nouvelle\nhttps://x/#/q/2%3A97\n\n[3:39]\nيُبَشِّرُكَ\nhttps://x/#/q/3%3A39');
  assert.doesNotMatch(html, /wabušrā/);
  assert.match(html, /<a href="https:\/\/x\/#\/q\/2%3A97">/);
});

test('HTML échappé', () => {
  const { html } = composerCopie([{ ref: '1:1', ar: '<b>', tr: 'a&b', trad: null }]);
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /a&amp;b/);
});
