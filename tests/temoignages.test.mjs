// Tests des fonctions pures des témoignages et de la préparation de l'import : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signature, identite, verifierTemoignage, texteEnParagraphes, extrait, ancienContenuEnTexte, surlignerDans,
} from '../src/js/temoignages-outils.js';
import { lireRest, preparerTemoignages, idImporte } from '../scripts/lib/import-temoignages.mjs';

test('signature : « Anonyme » si le nom est masqué', () => {
  assert.equal(signature({ anonyme: true, auteurNom: '' }), 'Anonyme');
  assert.equal(signature({ anonyme: false, auteurNom: 'Sadia' }), 'Sadia');
});

test('identite : un témoignage anonyme ne porte ni compte ni nom', () => {
  assert.deepEqual(identite(true, 'u1', 'Nom'), { anonyme: true, auteurUid: null, auteurNom: '' });
  assert.deepEqual(identite(false, 'u1', 'Nom'), { anonyme: false, auteurUid: 'u1', auteurNom: 'Nom' });
});

test('verifierTemoignage : titre requis, 40 caractères au moins', () => {
  assert.match(verifierTemoignage({ titre: '', texte: 'x'.repeat(50) }), /titre/);
  assert.match(verifierTemoignage({ titre: 'T', texte: 'court' }), /court/);
  assert.equal(verifierTemoignage({ titre: 'T', texte: 'x'.repeat(40) }), '');
});

test('texteEnParagraphes : échappé, paragraphes, sauts de ligne, liens https', () => {
  assert.equal(texteEnParagraphes('a <b>\nc\n\nd'), '<p>a &lt;b&gt;<br>c</p><p>d</p>');
  assert.equal(texteEnParagraphes('voir https://exemple.ca/x.'), '<p>voir <a href="https://exemple.ca/x" target="_blank" rel="noopener noreferrer">https://exemple.ca/x</a>.</p>');
  assert.ok(!texteEnParagraphes('"><script>').includes('<script>'));
});

test('extrait : coupé à un mot, avec points de suspension', () => {
  assert.equal(extrait('un deux trois', 8), 'un deux…');
  assert.equal(extrait('court'), 'court');
});

test('ancienContenuEnTexte : <br>, liens, entités', () => {
  assert.equal(ancienContenuEnTexte('Ligne 1 <br>Ligne 2<br><br>Para &amp; fin&nbsp;!'), 'Ligne 1\nLigne 2\n\nPara & fin !');
  assert.equal(ancienContenuEnTexte('<a href="https://x.ca" target="_blank">https://x.ca</a>'), 'https://x.ca');
  assert.equal(ancienContenuEnTexte('<a href="https://x.ca">site</a>'), 'site (https://x.ca)');
  assert.equal(ancienContenuEnTexte('Texte brut\n\nsuite'), 'Texte brut\n\nsuite');
});

const REST = [{ documents: [
  { name: 'p/temoignages/A1', fields: { status: { stringValue: 'approved' }, authorAlias: { stringValue: 'anonyme' }, mailUser: { stringValue: 'x@y.z' }, title: { stringValue: 'Titre A' }, content: { stringValue: `Début<br>${'texte '.repeat(10)}` }, createdAt: { timestampValue: '2026-01-03T00:50:30Z' } } },
  { name: 'p/temoignages/B2', fields: { status: { stringValue: 'approved' }, authorAlias: { stringValue: 'Amha' }, mailUser: { stringValue: 'x@y.z' }, title: { stringValue: 'Titre B' }, content: { stringValue: 'b'.repeat(60) }, createdAt: { timestampValue: '2026-04-22T12:53:07Z' } } },
  { name: 'p/temoignages/C3', fields: { status: { stringValue: 'approved' }, authorAlias: { stringValue: 'moi' }, mailUser: { stringValue: 'x@y.z' }, title: { stringValue: 'Titre C' }, content: { stringValue: 'c'.repeat(60) }, createdAt: { timestampValue: '2026-01-04T00:00:00Z' } } },
  { name: 'p/temoignages/D4', fields: { status: { stringValue: 'approved' }, authorAlias: { stringValue: 'Sadia' }, mailUser: { stringValue: 'x@y.z' }, title: { stringValue: 'Titre D' }, content: { stringValue: 'd'.repeat(60) }, createdAt: { timestampValue: '2026-02-20T00:00:00Z' } } },
  { name: 'p/temoignages/E5', fields: { status: { stringValue: 'pending' }, authorAlias: { stringValue: 'X' }, title: { stringValue: 'En attente' }, content: { stringValue: 'e'.repeat(60) } } },
] }];

test('import : approuvés seulement, anonymat, signature de l\'auteur, aucun courriel', () => {
  const p = preparerTemoignages(lireRest(REST), { uidAuteur: 'uid-amha' });
  assert.equal(p.temoignages.length, 4);
  assert.equal(p.ecartes.length, 1);
  const par = Object.fromEntries(p.temoignages.map((t) => [t.import.ancienId, t]));
  assert.deepEqual([par.A1.public.anonyme, par.A1.public.auteurUid, par.A1.public.auteurNom], [true, null, '']);
  assert.equal(par.A1.public.texte.startsWith('Début\ntexte'), true);
  assert.deepEqual([par.B2.public.auteurNom, par.B2.public.auteurUid, par.B2.prive.auteurUid], ['Amha Nathali', 'uid-amha', 'uid-amha']);
  assert.equal(par.C3.public.anonyme, true);
  assert.deepEqual([par.D4.public.anonyme, par.D4.public.auteurNom, par.D4.public.auteurUid], [false, 'Sadia', null]);
  assert.equal(par.A1.id, idImporte('A1'));
  assert.ok(!JSON.stringify(p.temoignages).includes('@'));
  assert.equal(p.temoignages[0].import.ancienId, 'B2', 'plus récent d\'abord');
});

test('extrait : commence près du terme filtré trouvé loin dans le texte', () => {
  const t = `${'mot '.repeat(80)}cible et la suite`;
  const e = extrait(t, 180, 'CIBLE');
  assert.ok(e.startsWith('…') && e.includes('cible'));
  assert.equal(extrait('cible au début', 180, 'cible'), 'cible au début');
});

test('surlignerDans : <mark> sur chaque occurrence, sans majuscules, balises et liens intacts', async () => {
  const { JSDOM } = await import('jsdom');
  const { document } = new JSDOM('<div id="r"><p>La Peur, <a href="https://peur.ca">la peur</a> &amp; moi</p></div>').window;
  const r = document.querySelector('#r');
  const premier = surlignerDans(r, 'peur');
  assert.equal(r.querySelectorAll('mark.surligne-filtre').length, 2);
  assert.equal(premier.textContent, 'Peur');
  assert.equal(r.querySelector('a').getAttribute('href'), 'https://peur.ca');
  assert.equal(r.textContent, 'La Peur, la peur & moi');
  assert.equal(surlignerDans(r, ''), null);
  assert.equal(surlignerDans(r, 'a.b'), null, 'caractères spéciaux pris à la lettre');
});
