// Recherche en lettres latines dans trois sources, icônes des boutons (npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chercherLatin, chercherMots } from '../src/js/recherche.js';
import { iconePour } from '../src/js/champs.js';

const lire = (f) => JSON.parse(readFileSync(new URL(`../donnees/${f}`, import.meta.url)));
const texte = new Map();
for (let s = 1; s <= 114; s++) texte.set(s, lire(`texte/${String(s).padStart(3, '0')}.json`));

test('latin : la translittération seule donne les mêmes versets que l\'ancienne recherche', () => {
  const ancien = chercherMots(texte, ['sabr'], 'latin');
  const nouveau = chercherLatin(texte, ['sabr']);
  assert.ok(ancien.length > 0);
  assert.deepEqual(nouveau.map((r) => `${r.s}:${r.v}`), ancien.map((r) => `${r.s}:${r.v}`));
  assert.deepEqual(nouveau[0].positions, ancien[0].positions);
});

test('latin : un mot absent de la translittération est trouvé dans la traduction et les commentaires', () => {
  const traduction = new Map([['2:255', 'Allah ! Point de divinité à part Lui, le Vivant, Celui qui subsiste'], ['3:14', 'On a enjolivé aux gens']]);
  const commentaires = new Map([['2:255', ['Le Vivant : lire aussi 3:2', 'autre remarque']], ['112:1', ['vivant et unique']]]);
  const r = chercherLatin(texte, ['vivant'], { traduction, commentaires });
  assert.deepEqual(r.map((x) => `${x.s}:${x.v}`), ['2:255', '112:1'], 'dans l\'ordre du texte');
  const a = r[0];
  assert.deepEqual(a.positions, []);
  assert.ok(a.positionsTrad.length === 1);
  assert.equal(a.nbCommentaires, 1);
  assert.equal(r[1].nbCommentaires, 1);
  assert.deepEqual(r[1].positionsTrad, []);
});

test('latin : mot entier, accents ignorés, plusieurs termes', () => {
  const commentaires = new Map([['1:1', ['Clémence et miséricorde']], ['1:2', ['clemente']]]);
  assert.deepEqual(chercherLatin(texte, ['clemence'], { commentaires }).filter((x) => x.nbCommentaires).map((x) => `${x.s}:${x.v}`), ['1:1']);
  assert.deepEqual(chercherLatin(texte, ['clem'], { commentaires, motEntier: true }).filter((x) => x.nbCommentaires).length, 0);
  assert.deepEqual(chercherLatin(texte, ['clemence', 'misericorde'], { commentaires }).filter((x) => x.nbCommentaires).map((x) => `${x.s}:${x.v}`), ['1:1']);
  assert.deepEqual(chercherLatin(texte, ['']), []);
});

test('icônes : Modifier, Supprimer…, Enregistrer… ; rien pour les autres boutons', () => {
  assert.equal(iconePour(' Modifier '), 'modifier');
  assert.equal(iconePour('Supprimer définitivement'), 'supprimer');
  assert.equal(iconePour('Enregistrer le brouillon'), 'enregistrer');
  assert.equal(iconePour('Publier'), null);
  assert.equal(iconePour('Modifications'), null);
});
