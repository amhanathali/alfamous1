// Pages publiques des articles (docs/ARTICLES.md § 8) : fonctions pures, testées par npm test
// (tests/pages-articles.test.mjs). Le script scripts/construire.mjs --articles les appelle au déploiement.
//
// Pages écrites dans dist/ :
//   /articles/<slug>/index.html   un article (HTML assaini, canonical, Open Graph, données structurées Article)
//   /articles/index.html          la liste par famille (aussi servie à /articles/libelle/<libellé>/, filtrée)
//   /articles/flux.xml            flux Atom (remplace /feeds/posts/default de Blogger)
//   /sitemap.xml, /robots.txt
//
// Options communes (site) :
//   base      adresse des pages publiques, sans / final (prod : https://blog.alfamous.ca)
//   atelier   adresse de l'application (prod : https://atelier.alfamous.ca)
//   indexer   false sur alfamous-essai : noindex partout et robots.txt fermé (pas de contenu en double chez Google)
import { FAMILLES } from '../../src/js/articles-outils.js';

export const ORDRE_FAMILLES = ['racines', 'critiques', 'identite', 'reflexions'];
export const NB_FLUX = 50;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
// Pour un JSON placé dans <script type="application/ld+json"> : « </ » ne doit jamais fermer la balise.
const jsonDansScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

// Date (Date, Timestamp Firestore, texte ISO) → Date, ou null.
export function enDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
const iso = (v) => enDate(v)?.toISOString() ?? '';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const dateLongue = (v) => { const d = enDate(v); return d ? `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : ''; };

// Date de publication affichée (la date Blogger pour un article importé) et date de dernière modification.
export const datePublication = (a) => enDate(a.import?.publieBlogger) || enDate(a.publieLe);
export const dateModification = (a) => enDate(a.republieLe) || enDate(a.import?.modifieBlogger) || datePublication(a);

export const cheminArticle = (a) => `/articles/${a.slug}/`;
// Page d'un libellé : /articles/libelle/<libellé>/ (même page que la liste, filtrée ; règle « rewrites » de firebase.json).
export const cheminLibelle = (l) => `/articles/libelle/${encodeURIComponent(String(l))}/`;

// Texte brut d'un HTML (description, flux) sans DOM : balises retirées, entités courantes décodées.
export function texteSimple(html) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// Description courte (balise meta, Open Graph, liste) : le résumé, sinon le début du texte (≤ 160 caractères).
export function description(a, max = 160) {
  const t = texteSimple(a.resume) || texteSimple(a.corps);
  if (t.length <= max) return t;
  const coupe = t.slice(0, max - 1);
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(' '), max - 40))}…`;
}

// Image pour Open Graph : la couverture, sinon la première image du texte (adresses https seulement).
export function imagePrincipale(a) {
  if (/^https:\/\//.test(a.image || '')) return a.image;
  const m = String(a.corps || '').match(/<img\b[^>]*\ssrc="(https:\/\/[^"]+)"/i);
  return m ? m[1].replace(/&amp;/g, '&') : '';
}

// Articles publiés, valides et triés du plus récent au plus ancien.
export function articlesPublies(liste) {
  return liste
    .filter((a) => a.statut === 'publie' && /^[a-z0-9-]{3,100}$/.test(a.slug || ''))
    .sort((x, y) => (datePublication(y)?.getTime() ?? 0) - (datePublication(x)?.getTime() ?? 0));
}

const lienVerset = (site, ref) => `${site.atelier}/#/q/${encodeURIComponent(ref)}`;
const lienAtelier = (site, a) => `${site.atelier}/#/article/${encodeURIComponent(a.slug)}`;

// Liens des versets dans le corps : les blocs de verset insérés par l'éditeur (data-ref) reçoivent un lien vers
// l'application, comme dans l'onglet Articles.
export function lierVersetsHtml(html, site) {
  return String(html ?? '').replace(/(<[^>]*class="[^"]*\bverset-bloc\b[^"]*"[^>]*data-ref="(\d{1,3}:\d{1,3})"[^>]*>)/g,
    (balise, _b, ref) => `${balise}<a class="refv" href="${echapper(lienVerset(site, ref))}">${ref}</a>`);
}

function gabarit(site, { titre, desc, canonique, type = 'website', image = '', jsonLd = null, alternates = '', corps }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${echapper(titre)}</title>
  <meta name="description" content="${echapper(desc)}">
  ${site.indexer ? '' : '<meta name="robots" content="noindex, nofollow">\n  '}<link rel="canonical" href="${echapper(canonique)}">
  <link rel="alternate" type="application/atom+xml" title="Alfamous — articles" href="${echapper(site.base)}/articles/flux.xml">${alternates}
  <meta property="og:site_name" content="Alfamous">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${echapper(titre)}">
  <meta property="og:description" content="${echapper(desc)}">
  <meta property="og:url" content="${echapper(canonique)}">${image ? `\n  <meta property="og:image" content="${echapper(image)}">` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%238a4b16'/%3E%3Ctext x='16' y='23' font-size='20' text-anchor='middle' fill='white' font-family='serif'%3EA%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap">
  <link rel="stylesheet" href="/css/app.css">
  <link rel="stylesheet" href="/css/articles-public.css">
  <script>try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}</script>${jsonLd ? `\n  <script type="application/ld+json">${jsonDansScript(jsonLd)}</script>` : ''}
</head>
<body class="page-publique">
  <header class="pub-entete">
    <a class="logo" href="/articles/">Alfamous<span class="logo-sous">articles · le sens des mots du Coran</span></a>
    <nav class="pub-menu" aria-label="Sections"><a href="/articles/">Articles</a><a href="${echapper(site.atelier)}/">L'atelier du codex</a><a href="/articles/flux.xml">Flux</a></nav>
  </header>
  <main class="pub-contenu">
${corps}
  </main>
  <footer class="pub-pied">Amha Nathali · <a href="${echapper(site.atelier)}/">Alfamous — l'atelier du codex</a> · <a href="/articles/flux.xml">flux Atom</a></footer>
</body>
</html>
`;
}

const puceFamille = (f) => `<a class="famille f-${echapper(f)}" href="/articles/#${echapper(f)}">${echapper(FAMILLES[f] || f)}</a>`;
const puceLibelle = (l) => `<a class="libelle" href="${echapper(cheminLibelle(l))}">${echapper(l)}</a>`;

// Page d'un article. `assainir` : la même fonction que l'application (articles-assainir.js), appliquée de nouveau.
export function pageArticle(a, site, { assainir }) {
  const canonique = `${site.base}${cheminArticle(a)}`;
  const desc = description(a);
  const image = imagePrincipale(a);
  const pub = datePublication(a);
  const mod = dateModification(a);
  const corpsHtml = lierVersetsHtml(assainir(a.corps || ''), site);
  const couverture = /^https:\/\//.test(a.image || '') && !String(a.corps || '').includes(echapper(a.image))
    ? `<img class="couverture" src="${echapper(a.image)}" alt="">` : '';
  const versets = (a.versets || []).filter((r) => /^\d{1,3}:\d{1,3}$/.test(r));
  const sources = (a.sources || []).filter((s) => s && (s.titre || s.url));
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article', headline: String(a.titre || '').slice(0, 110),
    description: desc, inLanguage: 'fr', mainEntityOfPage: canonique,
    author: { '@type': 'Person', name: a.auteurNom || 'Amha Nathali' },
    publisher: { '@type': 'Organization', name: 'Alfamous' },
    ...(pub ? { datePublished: pub.toISOString() } : {}), ...(mod ? { dateModified: mod.toISOString() } : {}),
    ...(image ? { image: [image] } : {}),
    ...((a.libelles || []).length ? { keywords: a.libelles.join(', ') } : {}),
  };
  const corps = `    <article class="art-page">
      <div class="art-meta">${puceFamille(a.famille)}${(a.libelles || []).map(puceLibelle).join('')}</div>
      <h1>${echapper(a.titre || 'Sans titre')}</h1>
      <p class="pub-signature">${echapper(a.auteurNom || 'Amha Nathali')}${pub ? ` · <time datetime="${pub.toISOString()}">${dateLongue(pub)}</time>` : ''}${mod && pub && mod.getTime() - pub.getTime() > 86400000 ? ` · mis à jour le <time datetime="${mod.toISOString()}">${dateLongue(mod)}</time>` : ''}</p>
      ${a.resume ? `<p class="chapeau">${echapper(a.resume)}</p>` : ''}
      ${couverture}
      <div class="corps-art">${corpsHtml}</div>
${sources.length ? `      <section class="pub-sources"><h2>Sources</h2><ul>${sources.map((s) => `<li>${/^https?:\/\//.test(s.url || '') ? `<a href="${echapper(s.url)}" target="_blank" rel="noopener noreferrer">${echapper(s.titre || s.url)}</a>` : echapper(s.titre)}${s.note ? ` — ${echapper(s.note)}` : ''}</li>`).join('')}</ul></section>\n` : ''}${versets.length ? `      <section class="pub-versets"><h2>Versets cités</h2><p>${versets.map((r) => `<a href="${echapper(lienVerset(site, r))}">${r}</a>`).join(' · ')}</p></section>\n` : ''}      <p class="pub-atelier"><a class="bouton-lien" href="${echapper(lienAtelier(site, a))}">Lire et commenter dans l'atelier</a></p>
    </article>`;
  return gabarit(site, { titre: `${a.titre} — Alfamous`, desc, canonique, type: 'article', image, jsonLd, corps });
}

// Liste des articles par famille. Servie aussi à /articles/libelle/<libellé>/ (anciens liens /search/label/… de
// Blogger) : la liste est alors filtrée sur ce libellé.
export function pageListe(articles, site) {
  const libelles = [...new Set(articles.flatMap((a) => a.libelles || []))].sort((x, y) => x.localeCompare(y, 'fr'));
  const ligne = (a) => `<li class="pub-ligne" data-libelles="${echapper(JSON.stringify(a.libelles || []))}"><a href="${cheminArticle(a)}"><span class="art-titre">${echapper(a.titre)}</span><span class="art-resume">${echapper(description(a))}</span></a><span class="art-droite">${dateLongue(datePublication(a))}</span></li>`;
  const sections = ORDRE_FAMILLES.map((f) => {
    const l = articles.filter((a) => a.famille === f);
    return l.length ? `    <section class="pub-famille" id="${f}"><h2>${echapper(FAMILLES[f])} <span class="pub-nb">${l.length}</span></h2><ul class="pub-liste">${l.map(ligne).join('')}</ul></section>` : '';
  }).filter(Boolean).join('\n');
  const autres = articles.filter((a) => !ORDRE_FAMILLES.includes(a.famille));
  const corps = `    <h1>Articles</h1>
    <p class="pub-intro">${articles.length} articles d'Amha Nathali sur le sens des mots du Coran, établi par leurs occurrences dans le texte. Pour chercher un verset, un mot ou une racine : <a href="${echapper(site.atelier)}/">l'atelier du codex</a>.</p>
    <nav class="pub-familles" aria-label="Familles">${ORDRE_FAMILLES.filter((f) => articles.some((a) => a.famille === f)).map((f) => `<a href="#${f}">${echapper(FAMILLES[f])}</a>`).join('')}</nav>
    <p class="pub-filtre" hidden>Libellé : <strong data-libelle></strong> · <a href="/articles/">tout afficher</a></p>
    <details class="pub-libelles"><summary>Libellés</summary><p>${libelles.map(puceLibelle).join(' ')}</p></details>
${sections}${autres.length ? `\n    <section class="pub-famille"><h2>Autres</h2><ul class="pub-liste">${autres.map(ligne).join('')}</ul></section>` : ''}
    <script>
      // /articles/libelle/<libellé>/ : masque les articles sans ce libellé et les familles vides.
      (function () {
        var p = location.pathname, debut = '/articles/libelle/', l = null;
        if (p.indexOf(debut) === 0) { try { l = decodeURIComponent(p.slice(debut.length).split('/')[0]); } catch (e) {} }
        if (!l) return;
        var f = document.querySelector('.pub-filtre'); f.hidden = false; f.querySelector('[data-libelle]').textContent = l;
        document.querySelectorAll('.pub-ligne').forEach(function (li) {
          var ok = false; try { ok = JSON.parse(li.dataset.libelles).indexOf(l) >= 0; } catch (e) {}
          li.hidden = !ok;
        });
        document.querySelectorAll('.pub-famille').forEach(function (s) { s.hidden = !s.querySelector('.pub-ligne:not([hidden])'); });
      })();
    </script>`;
  return gabarit(site, {
    titre: 'Articles — Alfamous',
    desc: 'Articles d\'Amha Nathali : analyses de racines, articles critiques, identité amazighe & kabyle, réflexions — le sens des mots du Coran par le Coran.',
    canonique: `${site.base}/articles/`, corps,
  });
}

// Flux Atom des derniers articles (texte complet, comme le flux Blogger).
export function fluxAtom(articles, site, { assainir, maintenant = new Date() }) {
  const liste = articles.slice(0, NB_FLUX);
  const maj = liste.length ? dateModification(liste[0]) || maintenant : maintenant;
  const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
  const entrees = liste.map((a) => {
    const url = `${site.base}${cheminArticle(a)}`;
    return `  <entry>
    <id>${echapper(url)}</id>
    <title>${echapper(a.titre)}</title>
    <link rel="alternate" type="text/html" href="${echapper(url)}"/>
    <published>${iso(datePublication(a))}</published>
    <updated>${iso(dateModification(a))}</updated>
    <author><name>${echapper(a.auteurNom || 'Amha Nathali')}</name></author>
    <category term="${echapper(FAMILLES[a.famille] || a.famille || '')}"/>
${(a.libelles || []).map((l) => `    <category term="${echapper(l)}"/>`).join('\n')}${(a.libelles || []).length ? '\n' : ''}    <summary>${echapper(description(a, 300))}</summary>
    <content type="html">${cdata(lierVersetsHtml(assainir(a.corps || ''), site))}</content>
  </entry>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <id>${echapper(site.base)}/articles/</id>
  <title>Alfamous — articles</title>
  <subtitle>Le sens des mots du Coran, établi par le Coran</subtitle>
  <link rel="self" type="application/atom+xml" href="${echapper(site.base)}/articles/flux.xml"/>
  <link rel="alternate" type="text/html" href="${echapper(site.base)}/articles/"/>
  <updated>${iso(maj)}</updated>
  <author><name>Amha Nathali</name></author>
${entrees}
</feed>
`;
}

export function planDuSite(articles, site) {
  const url = (loc, lastmod) => `  <url><loc>${echapper(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
  const plusRecent = articles.length ? iso(dateModification(articles[0])) : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[url(`${site.base}/articles/`, plusRecent), ...articles.map((a) => url(`${site.base}${cheminArticle(a)}`, iso(dateModification(a))))].join('\n')}
</urlset>
`;
}

export function robots(site) {
  return site.indexer
    ? `User-agent: *\nAllow: /\n\nSitemap: ${site.base}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}

// Toutes les pages, sous forme { chemin relatif à dist/ : contenu }.
export function pagesArticles(liste, site, { assainir, maintenant = new Date() }) {
  const articles = articlesPublies(liste);
  const fichiers = {
    'articles/index.html': pageListe(articles, site),
    'articles/flux.xml': fluxAtom(articles, site, { assainir, maintenant }),
    'sitemap.xml': planDuSite(articles, site),
    'robots.txt': robots(site),
  };
  for (const a of articles) fichiers[`articles/${a.slug}/index.html`] = pageArticle(a, site, { assainir });
  return { fichiers, nb: articles.length };
}

// ---------- Redirections de blog.alfamous.ca (Blogger → pages publiques) ----------
// Une redirection 301 par article importé (ancienne adresse /AAAA/MM/<nom>.html → /articles/<slug>/), puis les
// règles générales. Firebase Hosting applique la première règle qui correspond : l'ordre compte.
export function redirectionsBlogger(articles) {
  const vues = new Set();
  const precises = [];
  for (const a of [...articles].sort((x, y) => String(x.import?.url).localeCompare(String(y.import?.url)))) {
    let chemin;
    try { chemin = new URL(a.import?.url || '').pathname; } catch { continue; }
    if (!/^\/\d{4}\/\d{2}\/[^/]+\.html$/.test(chemin) || !a.slug || vues.has(chemin)) continue;
    vues.add(chemin);
    precises.push({ source: chemin, destination: `/articles/${a.slug}/`, type: 301 });
  }
  const generales = [
    { regex: '^/search/label/(?P<libelle>[^/?]+)$', destination: '/articles/libelle/:libelle', type: 301 },
    { source: '/search', destination: '/articles/', type: 301 },
    { source: '/search/**', destination: '/articles/', type: 301 },
    { source: '/feeds/**', destination: '/articles/flux.xml', type: 301 },
    { source: '/p/**', destination: '/articles/', type: 301 },
    { regex: '^/\\d{4}(/.*)?$', destination: '/articles/', type: 301 },
  ];
  return [...precises, ...generales];
}
