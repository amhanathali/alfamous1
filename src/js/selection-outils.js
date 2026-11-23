// Copie de versets : fonctions pures (testées par npm test, tests/selection.test.mjs).
import { echapper } from './commentaires-format.js';

// Références « s:v » dans l'ordre du Coran.
export function trierReferences(refs) {
  const cle = (r) => r.split(':').map(Number);
  return refs.slice().sort((a, b) => { const [s1, v1] = cle(a); const [s2, v2] = cle(b); return s1 - s2 || v1 - v2; });
}

// versets : [{ ref, ar, tr, trad }] ; options : { tr, trad, lien, nomTrad, base }.
// Retourne le texte simple et le HTML (texte mis en forme) de la sélection.
export function composerCopie(versets, { tr = true, trad = false, lien = false, nomTrad = '', base = '' } = {}) {
  const lienDe = (ref) => `${base}#/q/${encodeURIComponent(ref)}`;
  const blocs = versets.map((v) => [
    `[${v.ref}]`,
    v.ar,
    ...(tr && v.tr ? [v.tr] : []),
    ...(trad && v.trad ? [`${nomTrad ? `${nomTrad} (commentaire traditionnel) : ` : ''}${v.trad}`] : []),
    ...(lien ? [lienDe(v.ref)] : []),
  ].join('\n'));
  const html = versets.map((v) => `<p><b>[${echapper(v.ref)}]</b></p>
<p dir="rtl" lang="ar" style="font-family:'Amiri','Traditional Arabic',serif;font-size:20pt;text-align:right">${echapper(v.ar)}</p>
${tr && v.tr ? `<p><i>${echapper(v.tr)}</i></p>\n` : ''}${trad && v.trad ? `<p>${nomTrad ? `<small>${echapper(nomTrad)} (commentaire traditionnel)</small><br>` : ''}${echapper(v.trad)}</p>\n` : ''}${lien ? `<p><a href="${echapper(lienDe(v.ref))}">${echapper(lienDe(v.ref))}</a></p>\n` : ''}`).join('<hr>\n');
  return { texte: blocs.join('\n\n'), html };
}
