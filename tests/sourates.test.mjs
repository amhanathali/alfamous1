// Tests du champ de recherche des sourates (accueil) : numéro, nom latin, nom arabe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrerSourates, NOMS_SOURATES } from '../src/js/sourates.js';

test('vide : les 114 sourates', () => {
  assert.equal(NOMS_SOURATES.length, 114);
  assert.equal(filtrerSourates('').length, 114);
  assert.equal(filtrerSourates('   ').length, 114);
});

test('numéro : les sourates dont le numéro commence ainsi', () => {
  assert.deepEqual(filtrerSourates('18'), [18]);
  assert.deepEqual(filtrerSourates('11'), [11, 110, 111, 112, 113, 114]);
  assert.deepEqual(filtrerSourates('115'), []);
});

test('latin : sans accents, tirets, ʿ ni ʾ ; th, kh, sh, dh, gh acceptés', () => {
  assert.deepEqual(filtrerSourates('kahf'), [18]);
  assert.deepEqual(filtrerSourates('Fatiha'), [1]);
  assert.deepEqual(filtrerSourates('al imran'), [3]);
  assert.deepEqual(filtrerSourates('an-Nisa'), [4]);
  assert.deepEqual(filtrerSourates('kawthar'), [108]);
  assert.deepEqual(filtrerSourates('ikhlas'), [112]);
  assert.deepEqual(filtrerSourates('iḫlāṣ'), [112]);
  assert.deepEqual(filtrerSourates('quraysh'), [106]);
  assert.deepEqual(filtrerSourates('zzz'), []);
});

test('arabe : sans voyelles, formes d\'alif confondues, avec ou sans l\'article', () => {
  assert.deepEqual(filtrerSourates('الكهف'), [18]);
  assert.deepEqual(filtrerSourates('كهف'), [18]);
  assert.deepEqual(filtrerSourates('ٱلْكَهْف'), [18]);
  assert.deepEqual(filtrerSourates('اخلاص'), [112]);
  assert.deepEqual(filtrerSourates('ال عمران'), [3]);
});
