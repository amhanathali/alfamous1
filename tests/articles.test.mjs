// Tests des fonctions pures des articles : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  slugifier, slugValide, slugDepuisBlogger, versetsDansTexte, souratesDe, nettoyerLibelles, champsCites,
} from '../src/js/articles-outils.js';

const sourates = JSON.parse(readFileSync(new URL('../donnees/sourates.json', import.meta.url), 'utf8'));

test('slugifier : minuscules, sans accents ni points souscrits, arabe retiré', () => {
  assert.equal(slugifier("L'Éveil des consciences : De la méthode"), 'l-eveil-des-consciences-de-la-methode');
  assert.equal(slugifier('Le ṣawm (صوم) n’est pas la faim'), 'le-sawm-n-est-pas-la-faim');
  assert.equal(slugifier('ʿAbd (عبد) : le chercheur'), 'abd-le-chercheur');
  assert.equal(slugifier('هل القرآن ناقص؟'), '');
  assert.equal(slugifier('Cœur & âme'), 'coeur-ame');
});

test('slugifier : coupé à un tiret sous la longueur maximale', () => {
  const s = slugifier('mot '.repeat(60));
  assert.ok(s.length <= 100 && !s.endsWith('-') && slugValide(s));
});

test('slugValide', () => {
  assert.ok(slugValide('aberration-1-1926-et-le-sawm-fige-en'));
  for (const x of ['ab', '-abc', 'abc-', 'a--b', 'Abc', 'é-a', 'a b', null]) assert.equal(slugValide(x), false, String(x));
});

test('slugDepuisBlogger : chemin Blogger → slug ; génériques complétés par la date', () => {
  assert.equal(slugDepuisBlogger('/2026/02/aberration-1-1926-et-le-sawm-fige-en.html'), 'aberration-1-1926-et-le-sawm-fige-en');
  assert.equal(slugDepuisBlogger('/2026/02/blog-post.html'), 'article-2026-02');
  assert.equal(slugDepuisBlogger('/2026/06/le-sens-des-declinaisons-de-la-racine_0106756503.html'), 'le-sens-des-declinaisons-de-la-racine');
  assert.equal(slugDepuisBlogger('/2026/02/dignedefoi.html'), 'dignedefoi');
  assert.equal(slugDepuisBlogger('/2026/02/ab.html'), 'ab-2026-02');
  assert.equal(slugDepuisBlogger('/p/contact.html'), '');
});

test('versetsDansTexte : références existantes seulement, sans doublon, dans l\'ordre', () => {
  assert.deepEqual(versetsDansTexte('Voir 19.26, puis (2:183) et 2 : 184 ; encore 19:26.', sourates), ['19:26', '2:183', '2:184']);
  assert.deepEqual(versetsDansTexte('1:8 et 115:1 et 112:5 et 112:4', sourates), ['112:4']); // 1:8, 115:1, 112:5 n'existent pas
  assert.deepEqual(versetsDansTexte('le 10.11.2024 à 3.5 km, 1.2.3', sourates), ['3:5']); // limite connue : « 3.5 » repéré
});

test('versetsDansTexte prudent : « 2.1 » numéro de section écarté, sauf « verset » avant ; 4.34 et 19:26 gardés', () => {
  const t = '1.1 Introduction. 2.2 Méthode. Voir 4.34, le verset 1.5, (2.7) et 3:3.';
  assert.deepEqual(versetsDansTexte(t, sourates, { prudent: true }), ['4:34', '1:5', '2:7', '3:3']);
  assert.deepEqual(versetsDansTexte(t, sourates).slice(0, 2), ['1:1', '2:2']);
});

test('souratesDe : sourates triées sans doublon', () => {
  assert.deepEqual(souratesDe(['19:26', '2:183', '2:184', '112:1']), [2, 19, 112]);
  assert.deepEqual(souratesDe([]), []);
});

test('nettoyerLibelles : espaces, doublons (casse ignorée), 40 caractères, 10 au plus', () => {
  assert.deepEqual(nettoyerLibelles([' Les  mots du Coran ', 'les mots du coran', '', 'Société']), ['Les mots du Coran', 'Société']);
  assert.equal(nettoyerLibelles(['x'.repeat(60)])[0].length, 40);
  assert.equal(nettoyerLibelles(Array.from({ length: 15 }, (_, i) => `l${i}`)).length, 10);
});

test('champsCites : seuls les versets « cités » deviennent publics', () => {
  const contexte = { versets: [{ ref: '19:26', cite: true }, { ref: '2:187', cite: false }, { ref: '2:183', cite: true }, { ref: '19:26', cite: true }] };
  assert.deepEqual(champsCites(contexte), { versets: ['19:26', '2:183'], sourates: [2, 19] });
  assert.deepEqual(champsCites({}), { versets: [], sourates: [] });
});
