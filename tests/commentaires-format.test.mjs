// Mise en forme des commentaires (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrichir, dateCourte, initiale } from '../src/js/commentaires-format.js';

const lien = (q) => `#/q/${encodeURIComponent(q)}`;

test('le texte est échappé (pas de HTML injecté)', () => {
  assert.equal(enrichir('<b>gras</b> & "x"', lien), '&lt;b&gt;gras&lt;/b&gt; &amp; &quot;x&quot;');
});

test('renvois de versets et de racines transformés en liens', () => {
  assert.equal(enrichir('voir 2:255.', lien), 'voir <a href="#/q/2%3A255">2:255</a>.');
  assert.equal(enrichir('(2:255-257)', lien), '(<a href="#/q/2%3A255-257">2:255-257</a>)');
  assert.match(enrichir('racine r:رحم ici', lien), /<a href="#\/q\/r%3A%D8%B1%D8%AD%D9%85" class="ar" lang="ar">رحم<\/a> ici/);
});

test('une heure ou un nombre ordinaire ne devient pas un lien', () => {
  assert.equal(enrichir('à 10:30:15', lien), 'à 10:30:15');
  assert.equal(enrichir('1234:5', lien), '1234:5');
});

test('date et initiale', () => {
  assert.match(dateCourte(new Date('2026-11-23T12:00:00')), /23 nov\.? 2026/);
  assert.equal(dateCourte(null), 'à l\'instant');
  assert.equal(initiale(' amha'), 'A');
});

test('renvois enrichis : r:3.14, r:1, p50, m:…', () => {
  assert.equal(enrichir('voir r:3.14.', lien), 'voir <a href="#/q/3%3A14">r:3.14</a>.');
  assert.equal(enrichir('voir r:3:14-20', lien), 'voir <a href="#/q/3%3A14-20">r:3:14-20</a>');
  assert.equal(enrichir('(r:1)', lien), '(<a href="#/q/1">r:1</a>)');
  assert.equal(enrichir('page p50, et p 3.', lien), 'page <a href="#/q/p%2050">p50</a>, et <a href="#/q/p%203">p 3</a>.');
  assert.equal(enrichir('m:abc+xyz ici', lien), '<a href="#/q/m%3Aabc%2Bxyz">m:abc+xyz</a> ici');
  assert.equal(enrichir('cf. m: رحم+سلم', lien), `cf. <a href="#/q/${encodeURIComponent('m:رحم+سلم')}" dir="auto">m: رحم+سلم</a>`);
  // Un nombre seul, un mot contenant « p » ou une décimale ne deviennent pas des liens.
  assert.equal(enrichir('5 versets, top 5, 3.14, up50', lien), '5 versets, top 5, 3.14, up50');
  assert.equal(enrichir('r:3.1415', lien), 'r:3.1415');
});
