// Moteur de recherche d'Alfamous1. Fonctions pures : elles reçoivent les données déjà chargées,
// ce qui permet de les tester dans Node comme dans le navigateur.
import { normaliserArabe, normaliserLatin, estArabe } from './arabe.js';

// ---------- Analyse de la requête ----------
// Formes reconnues :
//   2:255  2.255  2:1-5      verset ou plage de versets
//   36                        sourate entière
//   p 50  page 50             page Warsh
//   r:رحم  racine رحم         racine (aussi : un mot arabe sans voyelle qui est une racine connue)
//   رحمة                     mot arabe (dans le texte)
//   rahma                     mot translittéré
export function analyserRequete(brute, racinesConnues = null) {
  const q = (brute || '').trim();
  if (!q) return { type: 'vide' };
  let m = q.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/);
  if (m) return { type: 'versets', sourate: +m[1], de: +m[2], a: +(m[3] || m[2]) };
  m = q.match(/^(\d{1,3})$/);
  if (m) return { type: 'sourate', sourate: +m[1] };
  m = q.match(/^p(?:age)?\s*(\d{1,3})$/i);
  if (m) return { type: 'page', page: +m[1] };
  m = q.match(/^(?:r|racine)\s*[:\s]\s*(.+)$/i);
  if (m && estArabe(m[1])) return { type: 'racine', racine: m[1].trim().replace(/[\s\-]/g, '') };
  if (estArabe(q)) {
    const nu = q.replace(/[\s\-]/g, '');
    if (racinesConnues && !/[ً-ْ]/.test(q) && racinesConnues.has(nu)) return { type: 'racine', racine: nu, aussiMot: true };
    return { type: 'mot', mot: q, langue: 'ar' };
  }
  return { type: 'mot', mot: q, langue: 'latin' };
}

// ---------- Recherche dans le texte ----------
// texteParSourate : Map(n → { versets: [{ v, ar, tr }] })
// options.motEntier : le mot doit correspondre à un mot entier (sinon : partie de mot).
export function chercherMot(texteParSourate, mot, langue, options = {}) {
  const cible = langue === 'ar' ? normaliserArabe(mot) : normaliserLatin(mot);
  if (!cible) return [];
  const resultats = [];
  for (const [s, { versets }] of texteParSourate) {
    for (const x of versets) {
      const mots = (langue === 'ar' ? x.ar : x.tr).split(/\s+/);
      const positions = [];
      mots.forEach((w, i) => {
        const n = langue === 'ar' ? normaliserArabe(w) : normaliserLatin(w);
        // En latin, l'article (al-, ar-, wa-l-…) est ignoré pour le mot entier.
        const sansArticle = langue === 'ar' ? n
          : n.replace(/^(?:wa|fa|bi|li)?a([tdrzsln])(?=\1)/, '').replace(/^(?:wa|fa|bi|li)?al(?=.)/, '');
        if (options.motEntier ? (n === cible || sansArticle === cible) : n.includes(cible)) positions.push(i);
      });
      if (positions.length) resultats.push({ s, v: x.v, positions });
    }
  }
  return resultats;
}

// ---------- Racines ----------
// racines : { racine: ["s:v:n", …] } ; motsParSourate : Map(n → { versets: { v: [[tr, racine, ar, sens], …] } })
export function occurrencesRacine(racines, racine) {
  const liste = racines[racine] || [];
  const parVerset = new Map();
  for (const ref of liste) {
    const [s, v, n] = ref.split(':').map(Number);
    const cle = `${s}:${v}`;
    if (!parVerset.has(cle)) parVerset.set(cle, { s, v, positions: [] });
    parVerset.get(cle).positions.push(n - 1);
  }
  return { total: liste.length, versets: [...parVerset.values()] };
}

// Racines voisines (« amis ») : autres racines présentes dans les mêmes versets.
// Amis contigus : racines des mots immédiatement avant ou après une occurrence.
export function amisRacine(occurrences, motsParSourate, racine, limite = 30) {
  const amis = new Map();
  const contigus = new Map();
  const ajouter = (carte, r, ref) => {
    if (!r || r === racine) return;
    if (!carte.has(r)) carte.set(r, { racine: r, nombre: 0, refs: new Set() });
    const e = carte.get(r); e.nombre++; e.refs.add(ref);
  };
  for (const { s, v, positions } of occurrences.versets) {
    const mots = motsParSourate.get(s)?.versets[v] || [];
    const vus = new Set();
    mots.forEach((w) => { if (w && !vus.has(w[1])) { vus.add(w[1]); ajouter(amis, w[1], `${s}:${v}`); } });
    for (const p of positions) {
      ajouter(contigus, mots[p - 1]?.[1], `${s}:${v}`);
      ajouter(contigus, mots[p + 1]?.[1], `${s}:${v}`);
    }
  }
  const trier = (carte) => [...carte.values()]
    .map((e) => ({ racine: e.racine, nombre: e.nombre, versets: e.refs.size }))
    .sort((a, b) => b.versets - a.versets || b.nombre - a.nombre || a.racine.localeCompare(b.racine, 'ar'))
    .slice(0, limite);
  return { amis: trier(amis), contigus: trier(contigus) };
}

// Répartition des occurrences d'une racine par sourate.
export function repartitionParSourate(occurrences) {
  const parSourate = new Map();
  for (const { s, positions } of occurrences.versets) parSourate.set(s, (parSourate.get(s) || 0) + positions.length);
  return [...parSourate].map(([s, n]) => ({ s, n })).sort((a, b) => a.s - b.s);
}
