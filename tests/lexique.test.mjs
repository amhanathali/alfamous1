// Tests des fonctions pures du lexique : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliserCle, suitesDeLettres, racinesProches, grouperEntrees, filtrerEntrees, estRacine } from '../src/js/lexique-outils.js';

const racines = JSON.parse(readFileSync(new URL('../donnees/racines.json', import.meta.url), 'utf8'));

test('normaliserCle : voyelles et tatwīl retirés, hamza gardée, espaces simples', () => {
  assert.equal(normaliserCle('بَشَرٌ'), 'بشر');
  assert.equal(normaliserCle('  أَرْض  '), 'أرض');
  assert.equal(normaliserCle('ٱلرَّحْمَـٰنِ'), 'ٱلرحمن');
  assert.equal(normaliserCle('بسم   الله'), 'بسم الله');
  assert.equal(normaliserCle('Croire'), 'Croire');
});

test('suitesDeLettres : suites d\'au moins deux lettres consécutives, sens direct et inverse', () => {
  assert.deepEqual(suitesDeLettres('بشر'), ['بش', 'بشر', 'شر']);
  assert.deepEqual(suitesDeLettres('بشر', { inverse: true }), ['رش', 'رشب', 'شب']);
  assert.deepEqual(suitesDeLettres('ردد'), ['رد']); // lettre répétée gardée une fois (ancien epurerTexte)
  assert.deepEqual(suitesDeLettres('ب'), []);
});

test('racinesProches de بشر : calcul sur racines.json (14 en sens direct, 6 en sens inverse)', () => {
  const direct = racinesProches('بشر', racines);
  assert.equal(direct.length, 14);
  assert.ok(direct.every((x) => x.racine !== 'بشر'));
  assert.deepEqual(direct.find((x) => x.racine === 'شرك'), { racine: 'شرك', n: racines['شرك'].length });
  const inverse = racinesProches('بشر', racines, { inverse: true });
  assert.deepEqual(inverse.map((x) => x.racine).sort(), ['خشب', 'رشد', 'شبه', 'عرش', 'فرش', 'قرش'].sort());
});

test('estRacine', () => {
  assert.equal(estRacine('بشر', racines), true);
  assert.equal(estRacine('بسم الله', racines), false);
  assert.equal(estRacine('constructor', racines), false);
});

test('grouperEntrees et filtrerEntrees', () => {
  const defs = [
    { cle: 'بشر', texte: 'créature de terre', creeLe: 2 },
    { cle: 'بشر', texte: 'annonce', creeLe: 5 },
    { cle: 'أرض', texte: 'sol, terre', creeLe: 1 },
    { cle: 'أرض', texte: '', creeLe: 9, masque: { par: 'x' } },
  ];
  const e = grouperEntrees(defs);
  assert.deepEqual(e.map((x) => [x.cle, x.definitions]), [['أرض', 2], ['بشر', 2]]);
  assert.equal(e[1].derniere.texte, 'annonce');
  assert.equal(e[0].derniere.texte, 'sol, terre'); // la masquée n'est pas l'extrait
  assert.deepEqual(filtrerEntrees(e, defs, 'TERRE').map((x) => x.cle), ['أرض', 'بشر']);
  assert.deepEqual(filtrerEntrees(e, defs, 'بَشَر').map((x) => x.cle), ['بشر']);
  assert.deepEqual(filtrerEntrees(e, defs, 'creature').map((x) => x.cle), ['بشر']);
  assert.equal(filtrerEntrees(e, defs, '  ').length, 2);
});
