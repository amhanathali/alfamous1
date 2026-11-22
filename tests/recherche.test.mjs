// Tests du moteur de recherche (node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyserRequete, chercherMot, occurrencesRacine, amisRacine, repartitionParSourate } from '../src/js/recherche.js';
import { normaliserArabe, normaliserLatin } from '../src/js/arabe.js';

const lire = (f) => JSON.parse(readFileSync(new URL(`../donnees/${f}`, import.meta.url)));
const num = (s) => String(s).padStart(3, '0');
const texte = new Map(); const mots = new Map();
for (let s = 1; s <= 114; s++) { texte.set(s, lire(`texte/${num(s)}.json`)); mots.set(s, lire(`mots/${num(s)}.json`)); }
const racines = lire('racines.json');

test('analyse des requêtes', () => {
  const R = new Set(Object.keys(racines));
  assert.deepEqual(analyserRequete('2:255'), { type: 'versets', sourate: 2, de: 255, a: 255 });
  assert.deepEqual(analyserRequete('2.1-5'), { type: 'versets', sourate: 2, de: 1, a: 5 });
  assert.deepEqual(analyserRequete('36'), { type: 'sourate', sourate: 36 });
  assert.deepEqual(analyserRequete('p 50'), { type: 'page', page: 50 });
  assert.equal(analyserRequete('رحم', R).type, 'racine');
  assert.equal(analyserRequete('r:رحم').racine, 'رحم');
  assert.equal(analyserRequete('رَحْمَة', R).type, 'mot');
  assert.equal(analyserRequete('rahma').langue, 'latin');
});

test('normalisation', () => {
  assert.equal(normaliserArabe('ٱلرَّحْمَـٰنِ'), 'الرحمن');
  assert.equal(normaliserLatin('ar-raḥmāni'), 'arrahmani');
});

test('recherche d’un mot arabe et translittéré', () => {
  const ar = chercherMot(texte, 'الرحمن', 'ar', { motEntier: true });
  assert.ok(ar.length > 40, `${ar.length} versets`);
  assert.ok(ar.some((r) => r.s === 1 && r.v === 3));
  const lat = chercherMot(texte, 'rahman', 'latin', { motEntier: false });
  assert.ok(lat.some((r) => r.s === 1 && r.v === 3));
  const entier = chercherMot(texte, 'rahmani', 'latin', { motEntier: true });
  assert.ok(entier.some((r) => r.s === 1 && r.v === 3), 'l’article ar- est ignoré en mot entier');
});

test('racine, amis et répartition', () => {
  const occ = occurrencesRacine(racines, 'رحم');
  assert.equal(occ.total, 338);
  assert.ok(occ.versets.find((x) => x.s === 1 && x.v === 1).positions.includes(2));
  const { amis, contigus } = amisRacine(occ, mots, 'رحم');
  assert.ok(amis.length > 0 && contigus.length > 0);
  assert.ok(!amis.some((a) => a.racine === 'رحم'));
  const rep = repartitionParSourate(occ);
  assert.equal(rep.reduce((t, x) => t + x.n, 0), 338);
});
