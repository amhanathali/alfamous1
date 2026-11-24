// Étape 5 : import des articles et commentaires du blog Blogger « Zoom-Coran » (docs/ARTICLES.md § 6).
// Fonctions pures (testées par tests/import-articles.test.mjs) ; le script est scripts/importer-articles.mjs.
//
// Source : sauvegarde Google Takeout du blog, Takeout/Blogger/Blogs/Zoom-Coran/feed.atom (posée dans
// import/articles/, jamais dans Git). Décisions (24 nov. 2026, docs/DECISIONS.md) :
// - tous les articles (publiés → « publie », brouillons → « brouillon »), signés Amha Nathali et reliés à son compte ;
// - adresse reprise de l'URL Blogger ; famille d'après import/articles/controle-familles.csv (colonne famille_choisie,
//   sinon famille_proposee) ;
// - HTML assaini (src/js/articles-assainir.js) ; images copiées dans Storage par le script ;
// - commentaires : « Anonymous » ou sans nom → « Anonyme », « Amha NathAli » → « Amha Nathali » (relié à son compte) ;
//   supprimés (GHOSTED_COMMENT) écartés ; réponses précédées de « ↪ en réponse à <nom> (<date>) : » ;
// - commentaires de la page brouillon « Zoom-Coran » → un fil du forum « Commentaires de l'ancienne page Zoom-Coran ».
import { slugDepuisBlogger, slugifier, slugValide, versetsDansTexte, souratesDe, nettoyerLibelles, FAMILLES, LIMITES } from '../../src/js/articles-outils.js';
import { texteBrut } from '../../src/js/articles-assainir.js';

export const SOURCE = 'Blogger';
export const AUTEUR = 'Amha Nathali';
export const COURRIEL_AUTEUR = 'gmpcdz@gmail.com';
export const TEXTE_COMMENTAIRE_MAX = 4000;
export const ID_FIL_PAGE = 'imp-b-page-zoom-coran';
const SIGNATURES = { 'amha nathali': AUTEUR, 'amha': AUTEUR, 'anonymous': 'Anonyme', 'anonyme': 'Anonyme', '': 'Anonyme' };

export const idArticle = (bloggerId) => `imp-b-${bloggerId}`;
export const idCommentaire = (bloggerId) => `imp-bc-${bloggerId}`;
const idCourt = (tag) => String(tag ?? '').split('post-').pop();

// ---------- Lecture du flux Atom (DOMParser de jsdom ou du navigateur) ----------
export function lireFlux(xml, DOMParser) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const enfant = (e, nom) => [...e.children].find((c) => c.localName === nom);
  const texte = (e, nom) => enfant(e, nom)?.textContent ?? '';
  return [...doc.documentElement.children].filter((e) => e.localName === 'entry').map((e) => {
    const auteur = enfant(e, 'author');
    return {
      id: idCourt(texte(e, 'id')),
      type: texte(e, 'type'),
      statut: texte(e, 'status'),
      titre: texte(e, 'title').trim(),
      contenu: texte(e, 'content'),
      resume: texte(e, 'metaDescription').trim(),
      cree: texte(e, 'created'), publie: texte(e, 'published'), modifie: texte(e, 'updated'),
      fichier: texte(e, 'filename'),
      libelles: [...e.children].filter((c) => c.localName === 'category').map((c) => c.getAttribute('term')).filter(Boolean),
      auteurNom: auteur ? texte(auteur, 'name').trim() : '',
      auteurType: auteur ? texte(auteur, 'type') : '',
      parent: idCourt(texte(e, 'parent')),
      enReponseA: idCourt(texte(e, 'inReplyTo')),
      corbeille: texte(e, 'trashed'),
    };
  });
}

// ---------- Signatures ----------
export function signature(nom, type) {
  const n = String(nom ?? '').trim();
  const k = n.toLocaleLowerCase('fr');
  if (k in SIGNATURES) return SIGNATURES[k];
  if (!n && type === 'ANONYMOUS') return 'Anonyme';
  return n;
}

// ---------- Fiche des familles (CSV « ; ») ----------
export function famillesDepuisFiche(lignes) {
  const [entete, ...corps] = lignes;
  const col = (nom) => entete.indexOf(nom);
  const iId = col('id_blogger'); const iChoisie = col('famille_choisie'); const iProposee = col('famille_proposee');
  const carte = new Map();
  for (const l of corps) {
    const id = l[iId]; if (!id) continue;
    const f = (l[iChoisie] || '').trim() || (l[iProposee] || '').trim();
    carte.set(id, f);
  }
  return carte;
}

// ---------- Images ----------
// Images du blog (blogger.googleusercontent.com, bp.blogspot.com) à copier : { url à télécharger, src à remplacer }.
// Une image entourée d'un lien vers son agrandissement est téléchargée dans sa grande taille.
const HOTES_BLOGGER = /^https?:\/\/(?:blogger\.googleusercontent\.com|\d+\.bp\.blogspot\.com|lh\d+\.googleusercontent\.com)\//i;
export function imagesBlogger(html) {
  const vues = new Map();
  const re = /(?:<a\b[^>]*\bhref="([^"]+)"[^>]*>\s*)?<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  for (const m of String(html ?? '').matchAll(re)) {
    const src = m[2].replace(/&amp;/g, '&');
    if (!HOTES_BLOGGER.test(src) || vues.has(src)) continue;
    const href = m[1]?.replace(/&amp;/g, '&');
    vues.set(src, { src, url: href && HOTES_BLOGGER.test(href) ? href : src });
  }
  return [...vues.values()];
}

// Avant assainissement : lien autour d'une image retiré (l'image suffit), cadres « separator » de Blogger aplatis,
// largeur et hauteur fixées par Blogger retirées (l'image prend la largeur de la colonne), images remplacées.
export function preparerHtml(html, remplacements = new Map()) {
  let h = String(html ?? '');
  h = h.replace(/<a\b[^>]*>\s*(<img\b[^>]*>)\s*<\/a>/gi, '$1');
  h = h.replace(/<div\b[^>]*class="separator"[^>]*>\s*(<img\b[^>]*>)\s*<\/div>/gi, '<p>$1</p>');
  h = h.replace(/<img\b[^>]*>/gi, (img) => {
    let t = img.replace(/\s(width|height|data-original-width|data-original-height|border)="[^"]*"/gi, '');
    const src = (t.match(/\bsrc="([^"]+)"/i) || [])[1];
    const brut = src?.replace(/&amp;/g, '&');
    if (brut && remplacements.has(brut)) t = t.replace(/\bsrc="[^"]+"/i, `src="${remplacements.get(brut).replace(/&/g, '&amp;')}"`);
    if (!/\salt=/.test(t)) t = t.replace(/<img\b/i, '<img alt=""');
    return t;
  });
  return h;
}

// Commentaire Blogger (HTML court) → texte simple du modèle des commentaires (retours à la ligne gardés).
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function texteCommentaire(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#'
      ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITES[e.toLowerCase()] ?? m))
    .replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const dateCourteFr = (iso) => new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Toronto' });

// ---------- Préparation ----------
// entrees : lireFlux(...) ; options : { familles: Map, assainir, sourates, uidAuteur, remplacements: Map(src → url Storage) }
export function preparerImport(entrees, { familles = new Map(), assainir, sourates = [], uidAuteur = null, remplacements = new Map() } = {}) {
  const anomalies = []; const ecartes = [];
  const posts = entrees.filter((e) => e.type === 'POST');
  const pages = entrees.filter((e) => e.type === 'PAGE');
  const commentaires = entrees.filter((e) => e.type === 'COMMENT');
  const slugsPris = new Set();
  const articles = [];
  // Adresses Blogger qui donneraient la même adresse : chacune prend son titre complet.
  const compte = new Map();
  for (const p of posts) if (p.statut === 'LIVE') { const b = slugDepuisBlogger(p.fichier); if (b) compte.set(b, (compte.get(b) || 0) + 1); }

  for (const p of posts) {
    if (p.corbeille) { ecartes.push({ quoi: 'article', id: p.id, titre: p.titre, raison: 'dans la corbeille de Blogger' }); continue; }
    const publie = p.statut === 'LIVE';
    if (!publie && p.statut !== 'DRAFT' && p.statut !== 'SCHEDULED') anomalies.push(`Article ${p.id} : statut Blogger inattendu « ${p.statut} » → brouillon`);
    const id = idArticle(p.id);
    let slug = null;
    if (publie) {
      slug = slugDepuisBlogger(p.fichier) || slugifier(p.titre) || `article-${p.id}`;
      if (compte.get(slug) > 1) { const t = slugifier(p.titre); if (slugValide(t)) slug = t; }
      if (!slugValide(slug)) slug = `article-${p.id}`;
      // Adresse déjà prise (« le-sens-des-declinaisons-de-la-racine » ×3) : titre complet, puis suffixe -2, -3…
      if (slugsPris.has(slug)) { const t = slugifier(p.titre); if (slugValide(t) && !slugsPris.has(t)) slug = t; }
      let n = 2; const base = slug;
      while (slugsPris.has(slug)) slug = `${base.slice(0, LIMITES.slug - 4)}-${n++}`;
      slugsPris.add(slug);
    }
    let famille = familles.get(p.id) || '';
    if (!FAMILLES[famille]) {
      if (famille) anomalies.push(`Article ${p.id} : famille « ${famille} » inconnue → reflexions`);
      else if (familles.size) anomalies.push(`Article ${p.id} (« ${p.titre} ») absent de la fiche des familles → reflexions`);
      famille = 'reflexions';
    }
    const brut = p.contenu;
    const styles = (brut.match(/<style\b/gi) || []).length;
    const scripts = (brut.match(/<script\b/gi) || []).length;
    const iframes = (brut.match(/<iframe\b/gi) || []).length;
    const images = imagesBlogger(brut);
    const corps = assainir(preparerHtml(brut, remplacements));
    const iframesGardes = (corps.match(/<iframe\b/gi) || []).length;
    if (iframes > iframesGardes) anomalies.push(`Article ${p.id} (« ${p.titre} ») : ${iframes - iframesGardes} cadre(s) intégré(s) non YouTube retiré(s)`);
    if (corps.length > LIMITES.corps) anomalies.push(`Article ${p.id} : texte trop long (${corps.length} caractères)`);
    const texte = texteBrut(corps);
    const versets = versetsDansTexte(`${p.titre} ${texte}`, sourates).slice(0, LIMITES.versets);
    const titre = (p.titre || '(sans titre)').slice(0, LIMITES.titre);
    const resume = (p.resume || texte.slice(0, 280).replace(/\s+\S*$/, '') + (texte.length > 280 ? '…' : '')).slice(0, LIMITES.resume);
    const premiereImage = (corps.match(/<img\b[^>]*\bsrc="([^"]+)"/i) || [])[1]?.replace(/&amp;/g, '&') || null;
    const image = premiereImage && premiereImage.length <= 300 && /^(https?:|\/)/.test(premiereImage) ? premiereImage : null;
    const libelles = nettoyerLibelles(p.libelles);
    const quand = (iso) => (iso ? new Date(iso) : null);
    articles.push({
      id, bloggerId: p.id, slug, statut: publie ? 'publie' : 'brouillon', titre, famille, libelles, resume, image, corps,
      versets, sourates: souratesDe(versets),
      creeLe: quand(p.cree || p.publie), publieLe: publie ? quand(p.publie) : null, modifieLe: quand(p.modifie || p.publie),
      url: p.fichier ? `https://blog.alfamous.ca${p.fichier}` : '',
      images, styles, scripts, iframes, nbCaracteres: texte.length,
      import: {
        source: SOURCE, bloggerId: p.id, url: p.fichier ? `https://blog.alfamous.ca${p.fichier}` : null,
        publieBlogger: p.publie || null, modifieBlogger: p.modifie || null, libellesBlogger: p.libelles,
        styleRetire: styles > 0, iframes,
      },
      auteurUid: uidAuteur, auteurNom: AUTEUR,
    });
  }

  // ---------- Commentaires ----------
  const parId = new Map(commentaires.map((c) => [c.id, c]));
  const articlesParBlogger = new Map(articles.map((a) => [a.bloggerId, a]));
  const pagesParId = new Map(pages.map((p) => [p.id, p]));
  const sortiesCom = []; const filPage = [];
  for (const c of commentaires) {
    if (c.statut !== 'LIVE') { ecartes.push({ quoi: 'commentaire', id: c.id, raison: `supprimé sur Blogger (${c.statut})` }); continue; }
    let texte = texteCommentaire(c.contenu);
    if (!texte) { ecartes.push({ quoi: 'commentaire', id: c.id, raison: 'vide' }); continue; }
    const nom = signature(c.auteurNom, c.auteurType);
    const parent = c.enReponseA && parId.get(c.enReponseA);
    if (parent) texte = `↪ en réponse à ${signature(parent.auteurNom, parent.auteurType)} (${dateCourteFr(parent.publie)}) : ${texte}`;
    else if (c.enReponseA) anomalies.push(`Commentaire ${c.id} : répond à un commentaire absent (${c.enReponseA})`);
    if (texte.length > TEXTE_COMMENTAIRE_MAX) { anomalies.push(`Commentaire ${c.id} : ${texte.length} caractères, coupé à ${TEXTE_COMMENTAIRE_MAX}`); texte = `${texte.slice(0, TEXTE_COMMENTAIRE_MAX - 1)}…`; }
    const commun = { auteurNom: nom, auteurUid: nom === AUTEUR ? uidAuteur : null, texte, creeLe: new Date(c.publie || c.cree), bloggerId: c.id, enReponseA: parent ? c.enReponseA : null };
    const art = articlesParBlogger.get(c.parent);
    if (art) {
      if (art.statut !== 'publie') anomalies.push(`Commentaire ${c.id} : sur un brouillon (${art.titre}) — importé, visible à sa publication`);
      sortiesCom.push({ ...commun, id: idCommentaire(c.id), cle: art.id });
    } else if (pagesParId.has(c.parent)) {
      filPage.push({ ...commun, page: pagesParId.get(c.parent).titre || c.parent });
    } else ecartes.push({ quoi: 'commentaire', id: c.id, raison: `rattaché à un élément absent (${c.parent})` });
  }
  filPage.sort((x, y) => x.creeLe - y.creeLe);
  const pagesHorsArticles = pages.map((p) => ({ id: p.id, titre: p.titre || '(sans titre)', statut: p.statut, fichier: p.fichier }));
  return { articles, commentaires: sortiesCom, filPage, pages: pagesHorsArticles, ecartes, anomalies };
}

// ---------- Rapport et fiche ----------
export function texteRapport({ articles, commentaires, filPage, pages, ecartes, anomalies }, { cible = 'à blanc' } = {}) {
  const publies = articles.filter((a) => a.statut === 'publie');
  const parFamille = Object.keys(FAMILLES).map((f) => `${FAMILLES[f]} : ${publies.filter((a) => a.famille === f).length}`).join(' · ');
  const L = [];
  L.push(`Import Blogger « Zoom-Coran » → Alfamous1 (${cible}) — ${new Date().toISOString()}`, '');
  L.push(`Articles : ${articles.length} (publiés ${publies.length}, brouillons ${articles.length - publies.length})`);
  L.push(`Familles des publiés : ${parFamille}`);
  L.push(`Images du blog à copier dans Storage : ${articles.reduce((n, a) => n + a.images.length, 0)} (dans ${articles.filter((a) => a.images.length).length} articles)`);
  L.push(`<style> retirés : ${articles.filter((a) => a.styles).length} articles · <script> retirés : ${articles.filter((a) => a.scripts).length} · cadres (iframe) : ${articles.reduce((n, a) => n + a.iframes, 0)}`);
  L.push(`Versets repérés : ${articles.reduce((n, a) => n + a.versets.length, 0)} (dans ${articles.filter((a) => a.versets.length).length} articles)`);
  L.push(`Commentaires : ${commentaires.length} sur des articles + ${filPage.length} dans le fil « Commentaires de l'ancienne page Zoom-Coran »`);
  const sig = {}; for (const c of [...commentaires, ...filPage]) sig[c.auteurNom] = (sig[c.auteurNom] || 0) + 1;
  L.push(`Signatures : ${Object.entries(sig).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  L.push(`Réponses (↪) : ${[...commentaires, ...filPage].filter((c) => c.enReponseA).length}`);
  L.push('', `Pages Blogger non importées (${pages.length}) :`);
  for (const p of pages) L.push(`  - ${p.titre} [${p.statut}] ${p.fichier}`);
  L.push('', `Écartés (${ecartes.length}) :`);
  for (const e of ecartes) L.push(`  - ${e.quoi} ${e.id}${e.titre ? ` « ${e.titre} »` : ''} : ${e.raison}`);
  L.push('', `Anomalies (${anomalies.length}) :`);
  for (const a of anomalies) L.push(`  - ${a}`);
  L.push('', 'Adresses des articles publiés (Blogger → Alfamous1) :');
  for (const a of publies) L.push(`  ${a.url}  →  /articles/${a.slug}/`);
  return `${L.join('\n')}\n`;
}

export function csvControle(articles) {
  const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const lignes = [['id', 'statut', 'publié le', 'titre', 'famille', 'libellés', 'adresse', 'URL Blogger', 'images', 'style retiré', 'iframes', 'versets repérés', 'caractères'].map(q).join(';')];
  for (const a of articles) {
    lignes.push([a.id, a.statut, a.publieLe ? a.publieLe.toISOString().slice(0, 10) : '', a.titre, a.famille, a.libelles.join(' | '), a.slug || '', a.url,
      a.images.length, a.styles ? 'oui' : '', a.iframes || '', a.versets.join(' '), a.nbCaracteres].map(q).join(';'));
  }
  return `﻿${lignes.join('\r\n')}\r\n`;
}
