// Pages publiques des articles (docs/ARTICLES.md § 8) : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { creerAssainisseur } from '../src/js/articles-assainir.js';
import {
  pagesArticles, pageArticle, articlesPublies, description, imagePrincipale, redirectionsBlogger, robots,
  lierVersetsHtml, fluxAtom,
} from '../scripts/lib/pages-articles.mjs';

const assainir = creerAssainisseur(createDOMPurify(new JSDOM('').window));
const PROD = { base: 'https://blog.alfamous.ca', atelier: 'https://atelier.alfamous.ca', indexer: true };
const ESSAI = { base: 'https://alfamous-essai.web.app', atelier: 'https://alfamous-essai.web.app', indexer: false };

const art = (o = {}) => ({
  id: 'a1', statut: 'publie', slug: 'nushuz-et-couple', titre: 'Nushūz et couple', famille: 'racines',
  libelles: ['Les mots du Coran'], resume: '', auteurNom: 'Amha Nathali', versets: ['4:34'], sources: [],
  corps: '<p>Le mot <b>nushūz</b> apparaît en 4:34.</p>', publieLe: new Date('2026-11-24T10:00:00Z'),
  import: { url: 'https://blog.alfamous.ca/2024/05/nushuz.html', publieBlogger: '2024-05-02T08:00:00Z' }, ...o,
});

test('seuls les articles publiés avec une adresse valide ont une page, du plus récent au plus ancien', () => {
  const l = articlesPublies([
    art({ id: 'b', slug: 'brouillon-x', statut: 'brouillon' }),
    art({ id: 'r', slug: 'retire-x', statut: 'retire' }),
    art({ id: 's', slug: null }),
    art({ id: 'vieux', slug: 'vieux', import: { publieBlogger: '2022-11-24T00:00:00Z' } }),
    art({ id: 'neuf', slug: 'neuf' }),
  ]);
  assert.deepEqual(l.map((a) => a.id), ['neuf', 'vieux']);
});

test('page d\'un article : titre, canonical, date Blogger, versets liés vers l\'atelier, commentaire dans l\'atelier', () => {
  const h = pageArticle(art(), PROD, { assainir });
  assert.match(h, /<title>Nushūz et couple — Alfamous<\/title>/);
  assert.match(h, /<link rel="canonical" href="https:\/\/blog\.alfamous\.ca\/articles\/nushuz-et-couple\/">/);
  assert.match(h, /2 mai 2024/);
  assert.match(h, /href="https:\/\/atelier\.alfamous\.ca\/#\/q\/4%3A34">4:34<\/a>/);
  assert.match(h, /href="https:\/\/atelier\.alfamous\.ca\/#\/article\/nushuz-et-couple">Lire et commenter/);
  assert.match(h, /"@type":"Article"/);
  assert.ok(!/noindex/.test(h));
});

test('alfamous-essai : noindex et robots.txt fermé', () => {
  assert.match(pageArticle(art(), ESSAI, { assainir }), /<meta name="robots" content="noindex, nofollow">/);
  assert.equal(robots(ESSAI), 'User-agent: *\nDisallow: /\n');
  assert.match(robots(PROD), /Sitemap: https:\/\/blog\.alfamous\.ca\/sitemap\.xml/);
});

test('le corps est assaini de nouveau et le titre échappé (rien d\'exécutable ne passe)', () => {
  const h = pageArticle(art({ titre: 'A <script>x</script>', corps: '<p onclick="x()">t</p><script>alert(1)</script><style>p{}</style>' }), PROD, { assainir });
  assert.ok(!/<script>x|alert\(1\)|onclick|<style>p/.test(h), h);
  assert.match(h, /A &lt;script&gt;x&lt;\/script&gt;/);
  // Les données structurées ne peuvent pas fermer leur balise.
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.ok(!ld.includes('</'));
});

test('description : le résumé, sinon le début du texte coupé à un mot', () => {
  assert.equal(description(art({ resume: 'Court résumé.' })), 'Court résumé.');
  const d = description(art({ corps: `<p>${'mot '.repeat(80)}</p>` }));
  assert.ok(d.length <= 160 && d.endsWith('…'), d);
});

test('image principale : la couverture, sinon la première image https du texte', () => {
  assert.equal(imagePrincipale(art({ image: 'https://x/c.png' })), 'https://x/c.png');
  assert.equal(imagePrincipale(art({ corps: '<p><img src="https://s/i.png?alt=media&amp;token=1" alt=""></p>' })), 'https://s/i.png?alt=media&token=1');
  assert.equal(imagePrincipale(art({ corps: '<img src="/v0/b/x.png">' })), '');
});

test('blocs de verset de l\'éditeur : lien vers l\'atelier ajouté', () => {
  const h = lierVersetsHtml('<div class="verset-bloc" data-ref="19:26"><p class="ar">…</p></div>', PROD);
  assert.match(h, /<div class="verset-bloc" data-ref="19:26"><a class="refv" href="https:\/\/atelier\.alfamous\.ca\/#\/q\/19%3A26">19:26<\/a>/);
});

test('ensemble des pages : liste, flux, plan du site, une page par article', () => {
  const { fichiers, nb } = pagesArticles([art(), art({ id: 'a2', slug: 'autre', titre: 'Autre', famille: 'critiques', libelles: [] }), art({ id: 'b', statut: 'brouillon', slug: 'b-x' })], PROD, { assainir, maintenant: new Date('2026-11-24T00:00:00Z') });
  assert.equal(nb, 2);
  assert.deepEqual(Object.keys(fichiers).sort(), ['articles/autre/index.html', 'articles/flux.xml', 'articles/index.html', 'articles/nushuz-et-couple/index.html', 'robots.txt', 'sitemap.xml']);
  assert.match(fichiers['articles/index.html'], /id="racines"[\s\S]*Nushūz[\s\S]*id="critiques"[\s\S]*Autre/);
  assert.match(fichiers['sitemap.xml'], /<loc>https:\/\/blog\.alfamous\.ca\/articles\/nushuz-et-couple\/<\/loc><lastmod>2024-05-02<\/lastmod>/);
  const flux = fichiers['articles/flux.xml'];
  assert.equal((flux.match(/<entry>/g) || []).length, 2);
  assert.match(flux, /<content type="html"><!\[CDATA\[<p>Le mot/);
  assert.ok(new JSDOM(flux, { contentType: 'application/xml' }).window.document.querySelector('parsererror') === null);
});

test('flux : « ]]> » dans un texte ne casse pas le CDATA', () => {
  const f = fluxAtom([art({ corps: '<p>a ]]> b</p>' })], PROD, { assainir });
  assert.ok(new JSDOM(f, { contentType: 'application/xml' }).window.document.querySelector('parsererror') === null);
});

test('redirections Blogger : une par article, puis les règles générales, dans cet ordre', () => {
  const r = redirectionsBlogger([
    art({ slug: 'b-art', import: { url: 'https://blog.alfamous.ca/2023/01/b.html' } }),
    art({ slug: 'a-art', import: { url: 'https://blog.alfamous.ca/2022/12/a.html' } }),
    art({ slug: 'page', import: { url: 'https://blog.alfamous.ca/p/lexique.html' } }), // une page : règle générale
    art({ slug: 'sans', import: undefined }),
  ]);
  assert.deepEqual(r.slice(0, 2), [
    { source: '/2022/12/a.html', destination: '/articles/a-art/', type: 301 },
    { source: '/2023/01/b.html', destination: '/articles/b-art/', type: 301 },
  ]);
  assert.equal(r.length, 2 + 6);
  assert.equal(r.at(-1).regex, '^/\\d{4}(/.*)?$');
  assert.equal(r[2].destination, '/articles/libelle/:libelle');
  assert.ok(!new RegExp(r.at(-1).regex).test('/articles/'));
});

test('firebase.json : les redirections de l\'ancien blog sont présentes, règles générales en dernier', async () => {
  const { readFileSync } = await import('node:fs');
  const h = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).hosting;
  const generales = redirectionsBlogger([]);
  assert.deepEqual(h.redirects.slice(-generales.length), generales);
  assert.ok(h.redirects.length > 200, 'une redirection par article publié sur Blogger');
  assert.deepEqual(h.rewrites, [{ source: '/articles/libelle/**', destination: '/articles/index.html' }]);
  for (const r of h.redirects.slice(0, -generales.length)) assert.match(r.destination, /^\/articles\/[a-z0-9-]{3,100}\/$/);
});

test('liste : liens des libellés vers /articles/libelle/…/', () => {
  const { fichiers } = pagesArticles([art()], PROD, { assainir });
  assert.match(fichiers['articles/index.html'], /href="\/articles\/libelle\/Les%20mots%20du%20Coran\/"/);
});

test('liste servie à /articles/libelle/<libellé>/ : seuls les articles de ce libellé restent visibles', () => {
  const { fichiers } = pagesArticles([art(), art({ id: 'a2', slug: 'autre', famille: 'critiques', libelles: ['Politique'] })], PROD, { assainir });
  const voir = (url) => {
    const d = new JSDOM(fichiers['articles/index.html'], { url, runScripts: 'dangerously' }).window.document;
    return [...d.querySelectorAll('.pub-ligne')].filter((x) => !x.hidden).length;
  };
  assert.equal(voir('https://blog.alfamous.ca/articles/'), 2);
  assert.equal(voir('https://blog.alfamous.ca/articles/libelle/Politique/'), 1);
  assert.equal(voir('https://blog.alfamous.ca/articles/libelle/Les%20mots%20du%20Coran'), 1);
});
