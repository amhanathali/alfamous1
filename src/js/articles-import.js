// Importer un fichier dans l'éditeur d'articles : Word (.docx), Markdown, texte.
// Le HTML obtenu est ensuite assaini par l'éditeur (articles-assainir.js). Fonctions pures testées : tests/articles-import.test.mjs.
import { echapper } from './commentaires-format.js';

// Texte simple → paragraphes (une ligne vide sépare deux paragraphes).
export function texteVersHtml(texte) {
  return String(texte ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p dir="auto">${echapper(p).replace(/\n/g, '<br>')}</p>`).join('\n');
}

// Markdown courant → HTML : titres #, ##, ###, listes - et 1., citations >, **gras**, *italique*, [lien](https://…).
export function markdownVersHtml(md) {
  const enLigne = (t) => echapper(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  const blocs = String(md ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  return blocs.map((b) => {
    const lignes = b.split('\n').filter((l) => l.trim());
    if (!lignes.length) return '';
    const t = lignes[0].match(/^(#{1,3})\s+(.*)$/);
    if (t && lignes.length === 1) { const n = Math.max(2, t[1].length + 1); return `<h${n}>${enLigne(t[2])}</h${n}>`; }
    if (lignes.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>${lignes.map((l) => `<li>${enLigne(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    if (lignes.every((l) => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lignes.map((l) => `<li>${enLigne(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    if (lignes.every((l) => /^>\s?/.test(l))) return `<blockquote><p>${lignes.map((l) => enLigne(l.replace(/^>\s?/, ''))).join('<br>')}</p></blockquote>`;
    return `<p dir="auto">${lignes.map(enLigne).join('<br>')}</p>`;
  }).filter(Boolean).join('\n');
}

// Paragraphes et titres : sens d'écriture déduit du contenu (arabe à droite), sans écraser un dir existant.
export function ajouterDirAuto(html) {
  return String(html ?? '').replace(/<(p|h[1-6]|li)(?![^>]*\bdir=)([^>]*)>/g, '<$1 dir="auto"$2>');
}

// Word (.docx) → HTML, dans le navigateur, avec mammoth.js (servi par l'application, chargé à la demande).
// envoyerImage(fichier) envoie chaque image dans Storage et retourne son adresse.
let mammothPret = null;
function chargerMammoth() {
  if (globalThis.mammoth) return Promise.resolve(globalThis.mammoth);
  if (!mammothPret) {
    mammothPret = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/mammoth/mammoth.browser.min.js', import.meta.url).href;
      s.onload = () => ok(globalThis.mammoth);
      s.onerror = () => { mammothPret = null; ko(new Error('Convertisseur Word introuvable (vendor/mammoth).')); };
      document.head.append(s);
    });
  }
  return mammothPret;
}

export async function versDocx(arrayBuffer, envoyerImage) {
  const mammoth = await chargerMammoth();
  let images = 0; let echecs = 0;
  const options = {
    styleMap: ['p[style-name=\'Title\'] => h2:fresh', 'p[style-name=\'Titre\'] => h2:fresh', 'p[style-name=\'Quote\'] => blockquote > p:fresh',
      'p[style-name=\'Citation\'] => blockquote > p:fresh'],
    convertImage: mammoth.images.imgElement(async (image) => {
      const type = image.contentType || 'image/png';
      if (!/^image\/(png|jpeg|gif|webp)$/.test(type)) return { src: '' };
      const octets = await image.read();
      const fichier = new File([octets], `image-${images + echecs + 1}.${type.split('/')[1].replace('jpeg', 'jpg')}`, { type });
      try { const src = await envoyerImage(fichier); images += 1; return { src }; } catch (e) { echecs += 1; console.error(e); return { src: '' }; }
    }),
  };
  const r = await mammoth.convertToHtml({ arrayBuffer }, options);
  // Titre 1 de Word → h2 (le h1 est le titre de l'article).
  const html = ajouterDirAuto(r.value.replace(/<h1(\s|>)/g, '<h2$1').replace(/<\/h1>/g, '</h2>'));
  const nbTitres = (html.match(/<h[2-4]/g) || []).length;
  const nbPara = (html.match(/<p[\s>]/g) || []).length;
  const nbTableaux = (html.match(/<table/g) || []).length;
  const bilan = `Lu : ${nbTitres} titre${nbTitres > 1 ? 's' : ''}, ${nbPara} paragraphe${nbPara > 1 ? 's' : ''}`
    + `${nbTableaux ? `, ${nbTableaux} tableau${nbTableaux > 1 ? 'x' : ''}` : ''}${images ? `, ${images} image${images > 1 ? 's' : ''} envoyée${images > 1 ? 's' : ''} dans Storage` : ''}.`
    + `${echecs ? ` ATTENTION : ${echecs} image${echecs > 1 ? 's' : ''} non envoyée${echecs > 1 ? 's' : ''} (absente${echecs > 1 ? 's' : ''} du texte).` : ''}`;
  return { html, bilan };
}
