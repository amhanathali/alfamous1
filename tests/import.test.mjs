// Tests de la préparation de l'import (phase 4) : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraireVersets, extraireLexique, preparerImport, harmoniserAuteur, dateMontreal, csvControle, texteRapport } from '../scripts/lib/import.mjs';

const VERSETS = [
  ['Soura', 'Aya', 'Coran', 'Trad.Lex'],
  ['1', '1', '…', 'Premier commentaire\n@Amha - 2024-09-13 23:03:51\n-----------\nAutre avis\n@Quelqu\'un - 2024-09-14 10:00:00'],
  ['2', '255', '…', 'Sans date\n@Afrukh Ifereles'],
  ['2', '300', '…', 'Verset inexistant\n@Amha'],
  ['3', '1', '…', 'Texte non signé'],
  ['3', '2', '…', '@Amha - 07/11/2026 14:17:35'],
];
const LEXIQUE = [
  ['Clé', 'Texte'],
  ['بَشَر', 'Définition A\n@amha nathali - 2024-10-06, 2:09:02 PM'],
  ['بشر', 'Définition B\n@Afrukh Ifereles - 2025-07-01 08:00:00'],
  ['أَرْض', 'Tradition\n@CSC-Tradition'],
];
const SOURATES = { 1: 7, 2: 286, 3: 200 };

const prepare = (uid = {}) => preparerImport([...extraireVersets(VERSETS), ...extraireLexique(LEXIQUE)],
  { nbVersetsParSourate: SOURATES, uidParAuteur: uid });

test('harmoniserAuteur : Amha → Amha Nathali, vide → Anonyme, espaces et casse', () => {
  assert.equal(harmoniserAuteur('Amha'), 'Amha Nathali');
  assert.equal(harmoniserAuteur('  amha   nathali '), 'Amha Nathali');
  assert.equal(harmoniserAuteur(''), 'Anonyme');
  assert.equal(harmoniserAuteur(null), 'Anonyme');
  assert.equal(harmoniserAuteur('Afrukh Ifereles'), 'Afrukh Ifereles');
});

test('dateMontreal : heure locale de Montréal, heure d\'hiver et d\'été', () => {
  assert.equal(dateMontreal('2024-01-01T12:00:00').toISOString(), '2024-01-01T17:00:00.000Z');
  assert.equal(dateMontreal('2024-07-01T12:00:00').toISOString(), '2024-07-01T16:00:00.000Z');
  assert.equal(dateMontreal('n\'importe quoi'), null);
});

test('seuls les auteurs retenus sont importés ; écarts motivés', () => {
  const { documents, ecartes } = prepare();
  assert.deepEqual(documents.map((d) => d.id).sort(), [
    'imp-v-1-1-0', 'imp-v-2-255-0',
    documents.find((d) => d.donnees.texte === 'Définition A').id,
    documents.find((d) => d.donnees.texte === 'Définition B').id,
  ].sort());
  const raisons = Object.fromEntries(ecartes.map((e) => [e.ref, e.raison]));
  assert.equal(raisons['verset 1:1 n° 2'], 'auteur non retenu');
  assert.equal(raisons['verset 2:300 n° 1'], 'référence de verset inexistante');
  assert.equal(raisons['verset 3:1 n° 1'], 'auteur non retenu'); // non signé → Anonyme, non retenu
  assert.equal(raisons['verset 3:2 n° 1'], 'signature sans texte');
  assert.equal(raisons['lexique أَرْض n° 1'], 'auteur non retenu');
});

test('documents : forme des commentaires du site, date estimée en 2024, compte relié', () => {
  const { documents } = prepare({ 'Amha Nathali': 'uid-amha' });
  const a = documents.find((d) => d.id === 'imp-v-1-1-0').donnees;
  assert.equal(a.type, 'verset'); assert.equal(a.cle, '1:1');
  assert.equal(a.auteurNom, 'Amha Nathali'); assert.equal(a.auteurUid, 'uid-amha');
  assert.equal(a.texte, 'Premier commentaire');
  assert.equal(a.creeLe.toISOString(), '2024-09-14T03:03:51.000Z');
  assert.deepEqual([a.modifieLe, a.nbVersions, a.masque], [null, 1, null]);
  assert.equal(a.import.dateEstimee, false);
  const b = documents.find((d) => d.id === 'imp-v-2-255-0').donnees;
  assert.equal(b.auteurUid, null);
  assert.equal(b.import.dateEstimee, true);
  assert.equal(b.creeLe.toISOString(), '2024-01-01T17:00:00.000Z');
});

test('lexique : clé sans voyelles, clés confondues regroupées et signalées', () => {
  const { documents, fusions } = prepare();
  const lex = documents.filter((d) => d.donnees.type === 'lexique');
  assert.deepEqual(lex.map((d) => d.donnees.cle), ['بشر', 'بشر']);
  assert.notEqual(lex[0].id, lex[1].id);
  assert.deepEqual(fusions, [{ cle: 'بشر', origines: ['بَشَر', 'بشر'] }]);
  assert.equal(lex[0].donnees.import.origine, 'بَشَر');
});

test('identifiants stables d\'un lancement à l\'autre', () => {
  assert.deepEqual(prepare().documents.map((d) => d.id), prepare().documents.map((d) => d.id));
});

test('rapport et fiche de contrôle', () => {
  const p = prepare();
  const r = texteRapport(p);
  assert.match(r, /À importer : 4 commentaires/);
  assert.match(r, /\[écarté\] {3}Anonyme/);
  const csv = csvControle(p.documents, 'https://alfamous-essai.web.app');
  assert.match(csv, /https:\/\/alfamous-essai\.web\.app\/#\/q\/2%3A255/);
  assert.equal(csv.trim().split('\r\n').length, 5);
});
