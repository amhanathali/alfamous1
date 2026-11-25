// Champs de saisie à 16 px au moins : en dessous, Safari sur iPhone zoome quand on touche le champ.
// La correction passe par la taille de police (le zoom reste permis : pas de maximum-scale ni de user-scalable=no).
// Ce test lit src/css/app.css : toute règle qui vise un champ (input, select, textarea ou une classe de champ)
// et fixe une police doit la fixer à 16 px au moins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/css/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

// Classes posées directement sur des champs de saisie (src/js/*.js).
const CLASSES_CHAMPS = ['filtre-lexique', 'art-recherche', 'note-ctx', 'zone-html', 'dossier'];
// Cases à cocher, boutons radio, fichiers : pas de zoom.
const SANS_ZOOM = /\[type=['"]?(checkbox|radio|file)['"]?\]/;

// Règles simples (les @media sont ouvertes : leur contenu est lu comme des règles ordinaires).
function regles(texte) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(texte))) {
    const sel = m[1].trim();
    if (sel && !sel.startsWith('@')) out.push({ selecteurs: sel.split(',').map((s) => s.trim()), corps: m[2] });
  }
  return out;
}
function taillePolice(corps) {
  const fs = corps.match(/font-size\s*:\s*([\d.]+)px/);
  if (fs) return +fs[1];
  const f = corps.match(/(?:^|;)\s*font\s*:\s*(?:[\w-]+\s+)*?([\d.]+)px/);
  return f ? +f[1] : null;
}
function visseUnChamp(selecteur) {
  const dernier = selecteur.split(/\s+|>|\+|~/).filter(Boolean).pop() || '';
  if (SANS_ZOOM.test(dernier)) return false;
  if (/(^|[^\w-])(input|select|textarea)(?![\w-])/.test(dernier)) return true;
  return CLASSES_CHAMPS.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(dernier));
}

test('aucune règle ne met un champ de saisie sous 16 px', () => {
  const fautifs = [];
  for (const { selecteurs, corps } of regles(css)) {
    const t = taillePolice(corps);
    if (t === null || t >= 16) continue;
    for (const s of selecteurs) if (visseUnChamp(s)) fautifs.push(`${s} : ${t} px`);
  }
  assert.deepEqual(fautifs, []);
});

test('les listes de l\'en-tête (dans des libellés à 14 px) sont remises à 16 px', () => {
  assert.match(css, /\.choix-trad select,\s*\.options select\s*\{\s*font-size:\s*16px/);
});

test('le zoom n\'est pas bloqué', () => {
  assert.doesNotMatch(html, /maximum-scale|user-scalable\s*=\s*(no|0)/i);
});

test('bouton de recherche : loupe avec un nom accessible', () => {
  assert.match(html, /<button type="submit" class="bouton-chercher" aria-label="Chercher"/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
});
