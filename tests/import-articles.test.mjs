// Import des articles Blogger (étape 5) : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { creerAssainisseur } from '../src/js/articles-assainir.js';
import {
  lireFlux, signature, famillesDepuisFiche, imagesBlogger, preparerHtml, texteCommentaire, preparerImport, idArticle, idCommentaire,
} from '../scripts/lib/import-articles.mjs';

const { window } = new JSDOM('');
const assainir = creerAssainisseur(createDOMPurify(window));
const sourates = JSON.parse(readFileSync(new URL('../donnees/sourates.json', import.meta.url), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const IMG = 'https://blogger.googleusercontent.com/img/a/AVv1=w320-h179';
const GRANDE = 'https://blogger.googleusercontent.com/img/a/AVv1=s1600';

const entree = (o) => `<entry><id>tag:blogger.com,1999:blog-1.post-${o.id}</id><blogger:type>${o.type}</blogger:type><blogger:status>${o.statut || 'LIVE'}</blogger:status>
  <author><name>${o.auteur ?? 'Amha NathAli'}</name><blogger:type>${o.auteurType || 'BLOGGER'}</blogger:type></author>
  <title>${esc(o.titre || '')}</title><content type='html'>${esc(o.contenu || '')}</content>
  <blogger:created>${o.date || '2026-02-24T10:00:00Z'}</blogger:created><published>${o.date || '2026-02-24T10:00:00Z'}</published><updated>${o.date || '2026-02-24T10:00:00Z'}</updated>
  ${(o.libelles || []).map((l) => `<category scheme='tag:blogger.com,1999:blog-1' term='${l}'/>`).join('')}
  ${o.fichier ? `<blogger:filename>${o.fichier}</blogger:filename>` : ''}${o.parent ? `<blogger:parent>tag:blogger.com,1999:blog-1.post-${o.parent}</blogger:parent>` : ''}
  ${o.repond ? `<blogger:inReplyTo>tag:blogger.com,1999:blog-1.post-${o.repond}</blogger:inReplyTo>` : ''}</entry>`;
const FLUX = `<?xml version='1.0' encoding='UTF-8'?><feed xmlns='http://www.w3.org/2005/Atom' xmlns:blogger='http://schemas.google.com/blogger/2018'><id>x</id>
  ${entree({ id: '1', type: 'POST', titre: 'Aberration 1 — 19.26', fichier: '/2026/02/aberration-1-1926.html', libelles: ['Les mots du Coran'],
    contenu: `<style>body{color:red}</style><div class="separator"><a href="${GRANDE}"><img src="${IMG}" width="320" height="179"></a></div><p style="color:#000">Voir 19:26 et 2.183.</p>` })}
  ${entree({ id: '2', type: 'POST', titre: 'هل القرآن ناقص؟', fichier: '/2026/02/blog-post.html', contenu: '<p>texte</p>' })}
  ${entree({ id: '3', type: 'POST', statut: 'DRAFT', titre: '', contenu: '<p>brouillon</p>' })}
  ${entree({ id: '9', type: 'PAGE', titre: 'Zoom-Coran', statut: 'DRAFT', fichier: '/p/alfamous.html' })}
  ${entree({ id: '10', type: 'COMMENT', auteur: '', auteurType: 'ANONYMOUS', parent: '1', contenu: 'Bonne analyse<br />merci', date: '2026-03-01T12:00:00Z' })}
  ${entree({ id: '11', type: 'COMMENT', auteur: 'Amha NathAli', parent: '1', repond: '10', contenu: 'Merci à vous', date: '2026-03-02T12:00:00Z' })}
  ${entree({ id: '12', type: 'COMMENT', statut: 'GHOSTED_COMMENT', auteur: '', auteurType: 'ANONYMOUS', parent: '1', contenu: 'spam' })}
  ${entree({ id: '13', type: 'COMMENT', auteur: 'Lynda', auteurType: 'ANONYMOUS', parent: '9', contenu: 'Sur la page', date: '2023-04-01T12:00:00Z' })}
</feed>`;

test('lireFlux : articles, pages et commentaires, avec parent, réponse et libellés', () => {
  const e = lireFlux(FLUX, window.DOMParser);
  assert.equal(e.length, 8);
  assert.deepEqual(e[0].libelles, ['Les mots du Coran']);
  assert.equal(e[0].fichier, '/2026/02/aberration-1-1926.html');
  assert.equal(e[5].enReponseA, '10');
  assert.equal(e[5].parent, '1');
  assert.match(e[0].contenu, /^<style>/);
});

test('signature : Anonymous ou sans nom → Anonyme ; Amha NathAli → Amha Nathali ; autres noms gardés', () => {
  assert.equal(signature('', 'ANONYMOUS'), 'Anonyme');
  assert.equal(signature('Anonymous', 'ANONYMOUS'), 'Anonyme');
  assert.equal(signature('Amha NathAli', 'BLOGGER'), 'Amha Nathali');
  assert.equal(signature('Lynda', 'ANONYMOUS'), 'Lynda');
});

test('images : grande taille si un lien l\'entoure ; lien, cadre et largeur fixe retirés ; src remplacé', () => {
  const html = `<div class="separator"><a href="${GRANDE}"><img src="${IMG}" width="320" height="179"></a></div>`;
  assert.deepEqual(imagesBlogger(html), [{ src: IMG, url: GRANDE }]);
  const h = preparerHtml(html, new Map([[IMG, '/v0/b/x/o/a.png?alt=media&token=t']]));
  assert.equal(h, '<p><img alt="" src="/v0/b/x/o/a.png?alt=media&amp;token=t"></p>');
});

test('texteCommentaire : retours à la ligne gardés, entités décodées', () => {
  assert.equal(texteCommentaire('Un&nbsp;<b>test</b><br />ligne 2 &amp; &#39;x&#39;'), "Un test\nligne 2 & 'x'");
});

test('famillesDepuisFiche : famille choisie, sinon proposée', () => {
  const c = famillesDepuisFiche([['titre', 'famille_proposee', 'famille_choisie', 'id_blogger'], ['a', 'racines', '', '1'], ['b', 'racines', 'critiques', '2']]);
  assert.equal(c.get('1'), 'racines');
  assert.equal(c.get('2'), 'critiques');
});

test('preparerImport : statuts, adresses, familles, HTML assaini, versets, commentaires et fil de la page', () => {
  const r = preparerImport(lireFlux(FLUX, window.DOMParser), {
    familles: new Map([['1', 'critiques'], ['2', 'critiques'], ['3', 'racines']]), assainir, sourates, uidAuteur: 'uid-amha',
  });
  assert.equal(r.articles.length, 3);
  const [a1, a2, a3] = r.articles;
  assert.equal(a1.id, idArticle('1'));
  assert.equal(a1.statut, 'publie');
  assert.equal(a1.slug, 'aberration-1-1926');
  assert.equal(a1.famille, 'critiques');
  assert.deepEqual(a1.libelles, ['Les mots du Coran']);
  assert.ok(!/<style|color:/.test(a1.corps), a1.corps);
  assert.deepEqual(a1.versets, ['19:26', '2:183']);
  assert.deepEqual(a1.sourates, [2, 19]);
  assert.equal(a1.images.length, 1);
  assert.equal(a1.auteurNom, 'Amha Nathali');
  assert.equal(a1.auteurUid, 'uid-amha');
  assert.equal(a2.slug, 'article-2026-02');
  assert.equal(a3.statut, 'brouillon');
  assert.equal(a3.slug, null);
  assert.equal(a3.titre, '(sans titre)');
  assert.equal(r.commentaires.length, 2);
  const [c1, c2] = r.commentaires;
  assert.equal(c1.id, idCommentaire('10'));
  assert.equal(c1.cle, a1.id);
  assert.equal(c1.auteurNom, 'Anonyme');
  assert.equal(c1.auteurUid, null);
  assert.equal(c1.texte, 'Bonne analyse\nmerci');
  assert.equal(c2.auteurUid, 'uid-amha');
  assert.match(c2.texte, /^↪ en réponse à Anonyme \(1 mars 2026\) : Merci à vous$/);
  assert.equal(r.filPage.length, 1);
  assert.equal(r.filPage[0].auteurNom, 'Lynda');
  assert.ok(r.ecartes.some((e) => e.id === '12'));
  assert.equal(r.pages.length, 1);
});
