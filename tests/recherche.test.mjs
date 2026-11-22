// Tests du moteur de recherche (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  analyserRequete, correspondre, chercherMots, chercherRacines, amisRacine, trierAmis,
  declinaisons, statistiquesRacines, repartitionParSourate,
} from '../src/js/recherche.js';
import { normaliserArabe, normaliserLatin, calculerAwy } from '../src/js/arabe.js';

const lire = (f) => JSON.parse(readFileSync(new URL(`../donnees/${f}`, import.meta.url)));
const texte = new Map();
for (let s = 1; s <= 114; s++) texte.set(s, lire(`texte/${String(s).padStart(3, '0')}.json`));
const R = new Set(Object.keys(lire('racines.json')));
const refs = (l) => l.map((x) => `${x.s}:${x.v}`);

test('analyse des requêtes', () => {
  assert.deepEqual(analyserRequete('2:255'), { type: 'versets', sourate: 2, de: 255, a: 255 });
  assert.deepEqual(analyserRequete('2.1-5'), { type: 'versets', sourate: 2, de: 1, a: 5 });
  assert.deepEqual(analyserRequete('36'), { type: 'sourate', sourate: 36 });
  assert.deepEqual(analyserRequete('p 50'), { type: 'page', page: 50 });
  assert.deepEqual(analyserRequete('رحم علم', R), { type: 'racines', termes: ['رحم', 'علم'] });
  assert.deepEqual(analyserRequete('رحم+غفر', R).termes, ['رحم', 'غفر']);
  assert.equal(analyserRequete('m:رحم', R).type, 'mots');
  assert.equal(analyserRequete('رحم زززز', R).type, 'mots');
  assert.equal(analyserRequete('رَحْمَة', R).type, 'mots');
  assert.deepEqual(analyserRequete('sabr jamil'), { type: 'mots', termes: ['sabr', 'jamil'], langue: 'latin' });
});

test('normalisation AWY (comme l’ancienne application)', () => {
  assert.equal(normaliserArabe('ٱلرَّحْمَـٰنِ'), 'الرحمن');
  assert.equal(normaliserArabe('ٱلْكِتَـٰبُ', calculerAwy('كتب')), 'لكتب');
  assert.equal(normaliserArabe('صَلَوٰة', calculerAwy('صلت')), 'صلت');
  assert.equal(normaliserLatin('ar-raḥmāni'), 'arrahmani');
  assert.equal(normaliserLatin('Miséricordieux,'), 'misericordieux');
});

test('correspondance : tous les termes, contigus', () => {
  const egal = (w, t) => w === t;
  assert.deepEqual(correspondre(['a', 'b', 'c', 'a'], ['a', 'c'], egal), [0, 2, 3]);
  assert.equal(correspondre(['a', 'b'], ['a', 'z'], egal), null);
  assert.deepEqual(correspondre(['x', 'a', 'b', 'y'], ['b', 'a'], egal, { contigus: true }), [1, 2]);
  assert.equal(correspondre(['a', 'x', 'b'], ['a', 'b'], egal, { contigus: true }), null);
});

test('recherche de plusieurs mots arabes', () => {
  const un = chercherMots(texte, ['رحمن'], 'ar');
  assert.ok(refs(un).includes('1:3'));
  const deux = chercherMots(texte, ['رحمن', 'رحيم'], 'ar');
  assert.ok(deux.length > 0 && deux.length < un.length);
  assert.ok(refs(deux).includes('1:3'));
  const contigus = chercherMots(texte, ['رحمن', 'رحيم'], 'ar', { contigus: true });
  assert.ok(refs(contigus).includes('1:3'));
  assert.ok(contigus.length <= deux.length);
});

test('recherche translittérée et mot entier', () => {
  assert.ok(refs(chercherMots(texte, ['rahman'], 'latin')).includes('1:3'));
  assert.ok(refs(chercherMots(texte, ['arrahmani'], 'latin', { motEntier: true })).includes('1:3'));
});

test('recherche dans une traduction', () => {
  const trad = new Map([['1:1', 'Au nom de Dieu, le Clément'], ['2:2', 'Ce Livre, nul doute']]);
  assert.deepEqual(refs(chercherMots(texte, ['clement', 'dieu'], 'latin', { source: trad })), ['1:1']);
});

test('recherche de plusieurs racines', () => {
  const r = chercherRacines(texte, ['رحم']);
  assert.equal(r.reduce((t, x) => t + x.positions.length, 0), 339);
  const deux = chercherRacines(texte, ['رحم', 'غفر']);
  assert.ok(deux.length > 50 && deux.length < r.length);
  const c = chercherRacines(texte, ['غفر', 'رحم'], { contigus: true });
  assert.ok(c.length > 0 && c.length < deux.length);
});

test('amis, déclinaisons, statistiques', () => {
  const { liste } = amisRacine(texte, 'رحم');
  const a = liste.find((x) => x.racine === 'غفر');
  assert.ok(a && a.n > 0 && a.lien === a.n / a.moyenne);
  assert.ok(!liste.some((x) => x.racine === 'رحم'));
  const d1 = amisRacine(texte, 'رحم', { distanceMax: 1 }).liste;
  assert.ok(d1.every((x) => x.moyenne === 1 && x.min === 1));
  assert.equal(trierAmis(liste, 'n')[0].n, Math.max(...liste.map((x) => x.n)));
  const dec = declinaisons(texte, 'رحم');
  assert.equal(dec.total, 339);
  assert.ok(dec.formes.length > 10);
  const st = statistiquesRacines(texte);
  assert.equal(st.racines.reduce((t, x) => t + x.n, 0), st.total);
  assert.equal(repartitionParSourate(chercherRacines(texte, ['رحم'])).reduce((t, x) => t + x.n, 0), 339);
});
