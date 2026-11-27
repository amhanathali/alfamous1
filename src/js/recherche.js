// Moteur de recherche d'Alfamous1. Fonctions pures (testables dans Node et dans le navigateur).
// Il reprend les règles de l'ancienne application (Zoom-Coran.js, mots-coran.js, statRacines.js) :
//   - plusieurs termes séparés par un espace ou « + » : versets qui contiennent TOUS les termes ;
//   - « mots contigus » : les termes se suivent (fenêtre de k mots, ordre libre) ;
//   - « mot entier » : égalité stricte au lieu de « contient » ;
//   - racines : égalité stricte, sur la colonne Racines du classeur (alignée mot à mot sur le texte).
import { normaliserArabe, normaliserLatin, estArabe, aDesVoyelles, calculerAwy } from './arabe.js';

// ---------- Analyse de la requête ----------
//   2:255 · 2.255 · 2:1-5   versets
//   36                       sourate
//   p 50 · page 50           page Warsh
//   r:رحم علم               racine(s) forcée(s)
//   m:رحم                    mot(s) forcé(s)
//   رحم علم                  racines si tous les termes sont des racines connues, sinon mots
//   sabr                     mots en lettres latines (translittération ou traduction)
export function analyserRequete(brute, racinesConnues = null) {
  const q = (brute || '').trim();
  if (!q) return { type: 'vide' };
  let m = q.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/);
  if (m) return { type: 'versets', sourate: +m[1], de: +m[2], a: +(m[3] || m[2]) };
  m = q.match(/^(\d{1,3})$/);
  if (m) return { type: 'sourate', sourate: +m[1] };
  m = q.match(/^p(?:age)?\s*(\d{1,3})$/i);
  if (m) return { type: 'page', page: +m[1] };

  const termes = (t) => t.split(/[\s+]+/).map((x) => x.trim()).filter(Boolean);
  m = q.match(/^(r|racines?)\s*:\s*(.+)$/i);
  if (m) return { type: 'racines', termes: termes(m[2]) };
  m = q.match(/^(m|mots?)\s*:\s*(.+)$/i);
  if (m) return { type: 'mots', termes: termes(m[2]), langue: estArabe(m[2]) ? 'ar' : 'latin' };

  const t = termes(q);
  if (estArabe(q)) {
    if (racinesConnues && !aDesVoyelles(q) && t.every((x) => racinesConnues.has(x))) return { type: 'racines', termes: t };
    return { type: 'mots', termes: t, langue: 'ar' };
  }
  return { type: 'mots', termes: t, langue: 'latin' };
}

// ---------- Correspondance d'une liste de mots avec des termes ----------
// mots : mots (normalisés) d'un verset ; termes : termes (normalisés) ; egal(mot, terme) → booléen
// Renvoie les positions à surligner, ou null si le verset ne convient pas.
export function correspondre(mots, termes, egal, { contigus = false } = {}) {
  if (!termes.length || !mots.length) return null;
  if (!contigus) {
    // Chaque terme doit apparaître au moins une fois ; on surligne toutes les occurrences.
    const positions = new Set();
    for (const t of termes) {
      let trouve = false;
      mots.forEach((w, i) => { if (egal(w, t)) { positions.add(i); trouve = true; } });
      if (!trouve) return null;
    }
    return [...positions].sort((a, b) => a - b);
  }
  // Contigus : une fenêtre de k mots consécutifs contient tous les termes (ordre libre).
  const k = termes.length;
  const positions = new Set();
  for (let debut = 0; debut + k <= mots.length; debut++) {
    const besoin = new Map();
    for (const t of termes) besoin.set(t, (besoin.get(t) || 0) + 1);
    for (let i = debut; i < debut + k; i++) {
      // Comme l'ancienne application : on attribue le mot au terme le plus long qu'il satisfait.
      const candidats = [...besoin].filter(([t, n]) => n > 0 && egal(mots[i], t)).map(([t]) => t)
        .sort((a, b) => b.length - a.length);
      if (candidats.length) besoin.set(candidats[0], besoin.get(candidats[0]) - 1);
    }
    if ([...besoin.values()].every((n) => n <= 0)) for (let i = debut; i < debut + k; i++) positions.add(i);
  }
  return positions.size ? [...positions].sort((a, b) => a - b) : null;
}

// ---------- Recherche de mots ----------
// texteParSourate : Map(n → { versets: [{ v, ar, tr }] })
// options.source : 'coran' (arabe ou translittération) ou une Map « s:v » → texte de traduction
export function chercherMots(texteParSourate, termesBruts, langue, { motEntier = false, contigus = false, source = 'coran' } = {}) {
  let normaliser;
  if (langue === 'ar') {
    const awy = calculerAwy(termesBruts.join(' '));
    normaliser = (w) => normaliserArabe(w, awy);
  } else normaliser = normaliserLatin;
  const termes = termesBruts.map(normaliser).filter(Boolean);
  if (!termes.length) return [];
  const egal = motEntier ? (w, t) => w === t : (w, t) => w.includes(t);
  const dansTraduction = langue !== 'ar' && source !== 'coran';
  const resultats = [];
  for (const [s, { versets }] of texteParSourate) {
    for (const x of versets) {
      const brut = langue === 'ar' ? x.ar : dansTraduction ? source.get(`${s}:${x.v}`) : x.tr;
      if (!brut) continue;
      const mots = brut.split(/\s+/).map(normaliser);
      const positions = correspondre(mots, termes, egal, { contigus });
      if (positions) resultats.push({ s, v: x.v, positions, dansTraduction });
    }
  }
  return resultats;
}

// ---------- Recherche en lettres latines ----------
// Le latin est cherché à la fois dans la translittération, dans le commentaire traditionnel choisi
// (traduction : Map « s:v » → texte, ou null) et dans les commentaires Alfamous des versets
// (commentaires : Map « s:v » → [textes], ou null). Un verset est retenu s'il convient dans l'une des sources.
// Résultat : [{ s, v, positions (translittération), positionsTrad, nbCommentaires }], dans l'ordre du texte.
export function chercherLatin(texteParSourate, termesBruts, { motEntier = false, contigus = false, traduction = null, commentaires = null } = {}) {
  const termes = termesBruts.map(normaliserLatin).filter(Boolean);
  if (!termes.length) return [];
  const egal = motEntier ? (w, t) => w === t : (w, t) => w.includes(t);
  const mots = (brut) => String(brut).split(/\s+/).map(normaliserLatin);
  const resultats = [];
  for (const [s, { versets }] of texteParSourate) {
    for (const x of versets) {
      const cle = `${s}:${x.v}`;
      const positions = x.tr ? correspondre(mots(x.tr), termes, egal, { contigus }) : null;
      const trad = traduction?.get(cle);
      const positionsTrad = trad ? correspondre(mots(trad), termes, egal, { contigus }) : null;
      const nbCommentaires = (commentaires?.get(cle) || [])
        .filter((c) => c && correspondre(mots(c), termes, egal, { contigus })).length;
      if (positions || positionsTrad || nbCommentaires) {
        resultats.push({ s, v: x.v, positions: positions || [], positionsTrad: positionsTrad || [], nbCommentaires });
      }
    }
  }
  return resultats;
}

// ---------- Recherche de racines (plusieurs racines possibles) ----------
export function chercherRacines(texteParSourate, racines, { contigus = false } = {}) {
  const resultats = [];
  for (const [s, { versets }] of texteParSourate) {
    for (const x of versets) {
      const positions = correspondre(x.racines, racines, (w, t) => w === t, { contigus });
      if (positions) resultats.push({ s, v: x.v, positions });
    }
  }
  return resultats;
}

// ---------- Amis d'une racine (mêmes mesures que l'ancienne application) ----------
// Pour chaque verset contenant la racine R, chaque paire (position de R, autre mot) compte :
//   N = nombre de paires ; distance moyenne et minimale (en mots) ; lien = N / distance moyenne.
// distanceMax = 1 donne les « amis contigus » (mots immédiatement voisins).
export function amisRacine(texteParSourate, R, { distanceMax = Infinity } = {}) {
  const agg = new Map();
  let paires = 0;
  for (const [s, { versets }] of texteParSourate) {
    for (const x of versets) {
      const rs = x.racines;
      const pos = [];
      rs.forEach((r, i) => { if (r === R) pos.push(i); });
      if (!pos.length) continue;
      for (const i of pos) {
        for (let j = 0; j < rs.length; j++) {
          const d = Math.abs(j - i);
          if (j === i || d > distanceMax) continue;
          const ami = rs[j];
          if (!ami || ami === R) continue;
          let e = agg.get(ami);
          if (!e) agg.set(ami, (e = { racine: ami, n: 0, somme: 0, min: Infinity, versets: new Set() }));
          e.n++; e.somme += d; e.min = Math.min(e.min, d); e.versets.add(`${s}:${x.v}`);
          paires++;
        }
      }
    }
  }
  const liste = [...agg.values()].map((e) => {
    const moyenne = e.somme / e.n;
    return { racine: e.racine, n: e.n, moyenne, min: e.min, lien: e.n / moyenne, versets: e.versets.size };
  });
  return { liste: trierAmis(liste, 'lien'), paires };
}

export function trierAmis(liste, critere = 'lien') {
  const c = {
    lien: (a, b) => b.lien - a.lien || b.n - a.n,
    n: (a, b) => b.n - a.n || b.lien - a.lien,
    moyenne: (a, b) => a.moyenne - b.moyenne || b.n - a.n,
    versets: (a, b) => b.versets - a.versets || b.n - a.n,
    racine: (a, b) => a.racine.localeCompare(b.racine, 'ar'),
  }[critere] || ((a, b) => b.lien - a.lien);
  return [...liste].sort(c);
}

// ---------- Déclinaisons : formes du texte portant une racine ----------
export function declinaisons(texteParSourate, R) {
  const formes = new Map();
  let total = 0;
  for (const [s, { versets }] of texteParSourate) {
    for (const x of versets) {
      const mots = x.ar.split(/\s+/); const tr = x.tr.split(/\s+/);
      x.racines.forEach((r, i) => {
        if (r !== R) return;
        total++;
        const f = mots[i];
        if (!formes.has(f)) formes.set(f, { forme: f, tr: tr[i] || '', n: 0, premier: `${s}:${x.v}` });
        formes.get(f).n++;
      });
    }
  }
  return { total, formes: [...formes.values()].sort((a, b) => b.n - a.n || a.forme.localeCompare(b.forme, 'ar')) };
}

// ---------- Statistiques de toutes les racines ----------
export function statistiquesRacines(texteParSourate) {
  const compte = new Map();
  let total = 0;
  for (const [, { versets }] of texteParSourate) {
    for (const x of versets) for (const r of x.racines) { compte.set(r, (compte.get(r) || 0) + 1); total++; }
  }
  return { total, racines: [...compte].map(([racine, n]) => ({ racine, n, part: n / total })).sort((a, b) => b.n - a.n) };
}

export function repartitionParSourate(resultats) {
  const parSourate = new Map();
  for (const { s, positions } of resultats) parSourate.set(s, (parSourate.get(s) || 0) + (positions?.length || 1));
  return [...parSourate].map(([s, n]) => ({ s, n })).sort((a, b) => a.s - b.s);
}
