// Import de fichiers dans l'éditeur d'articles (Markdown, texte) : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texteVersHtml, markdownVersHtml, ajouterDirAuto } from '../src/js/articles-import.js';

test('texteVersHtml : paragraphes séparés par une ligne vide, texte échappé', () => {
  assert.equal(texteVersHtml('Un <b>\nsuite\n\nDeux'), '<p dir="auto">Un &lt;b&gt;<br>suite</p>\n<p dir="auto">Deux</p>');
});

test('markdownVersHtml : titres décalés (pas de h1), listes, citation, gras, italique, liens https', () => {
  const h = markdownVersHtml('# Titre\n\nTexte **fort** et *penché* [lien](https://a.ca)\n\n- un\n- deux\n\n1. a\n2. b\n\n> cité\n\n[mauvais](javascript:x)');
  assert.match(h, /<h2>Titre<\/h2>/);
  assert.match(h, /<strong>fort<\/strong> et <em>penché<\/em> <a href="https:\/\/a\.ca">lien<\/a>/);
  assert.match(h, /<ul><li>un<\/li><li>deux<\/li><\/ul>/);
  assert.match(h, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  assert.match(h, /<blockquote><p>cité<\/p><\/blockquote>/);
  assert.ok(!h.includes('href="javascript'));
});

test('ajouterDirAuto : dir="auto" sur paragraphes et titres, sans écraser un dir existant', () => {
  assert.equal(ajouterDirAuto('<p>a</p><h2 id="x">b</h2><p dir="rtl">ج</p>'), '<p dir="auto">a</p><h2 dir="auto" id="x">b</h2><p dir="rtl">ج</p>');
});
