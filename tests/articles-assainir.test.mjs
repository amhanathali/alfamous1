// Assainissement du HTML des articles (docs/ARTICLES.md § 5) : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { creerAssainisseur, videoYoutube, filtrerStyle, texteBrut } from '../src/js/articles-assainir.js';

const assainir = creerAssainisseur(createDOMPurify(new JSDOM('').window));

test('retire <style>, <script>, formulaires, attributs on… et liens javascript:', () => {
  const s = assainir('<style>body{color:red}</style><p onclick="x()">Texte<script>alert(1)</script></p><form><input></form><a href="javascript:alert(1)">lien</a>');
  assert.ok(!/<style|<script|<form|<input|onclick|javascript:/i.test(s), s);
  assert.match(s, /<p>Texte<\/p>/);
});

test('style="" : seules text-align et direction gardées', () => {
  assert.equal(filtrerStyle('color: #000; background:#fff; text-align:center; direction: rtl'), 'text-align: center; direction: rtl');
  assert.equal(filtrerStyle('text-align: expression(alert(1))'), '');
  const s = assainir('<p style="color:white;background:#fff">a</p><p style="text-align:center;font-size:30px">b</p>');
  assert.equal(s, '<p>a</p><p style="text-align: center">b</p>');
});

test('iframe : seulement YouTube, réécrite vers youtube-nocookie.com', () => {
  assert.equal(videoYoutube('https://www.youtube.com/embed/dQw4w9WgXcQ?si=x'), 'dQw4w9WgXcQ');
  assert.equal(videoYoutube('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoYoutube('https://evil.example/embed/dQw4w9WgXcQ'), '');
  const s = assainir('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" onload="x()"></iframe><iframe src="https://evil.example/x"></iframe>');
  assert.match(s, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/);
  assert.equal((s.match(/<iframe/g) || []).length, 1);
  assert.ok(!/onload|evil/.test(s));
});

test('liens externes : nouvel onglet et rel noopener ; arabe, tableaux et dir gardés', () => {
  const s = assainir('<a href="https://blog.alfamous.ca/x">x</a><p dir="rtl" lang="ar">صَوْمًا</p><table><tr><td>1</td></tr></table>');
  assert.match(s, /<a href="https:\/\/blog\.alfamous\.ca\/x" target="_blank" rel="noopener noreferrer">x<\/a>/);
  assert.match(s, /<p dir="rtl" lang="ar">صَوْمًا<\/p>/);
  assert.match(s, /<table>/);
});

test('texteBrut : sans balises ni styles, entités décodées', () => {
  assert.equal(texteBrut('<style>p{}</style><h2>Titre</h2><p>L&#39;éveil &amp; la&nbsp;raison</p>'), 'Titre L\'éveil & la raison');
});
