// Chargement des données (fichiers JSON servis par Firebase Hosting), avec mémoire en session.
const BASE = './donnees';
const cache = new Map();
const num = (s) => String(s).padStart(3, '0');

function charger(chemin, type = 'json') {
  if (!cache.has(chemin)) {
    cache.set(chemin, fetch(`${BASE}/${chemin}`).then((r) => {
      if (!r.ok) throw new Error(`${chemin} : ${r.status}`);
      return type === 'json' ? r.json() : r.text();
    }).catch((e) => { cache.delete(chemin); throw e; }));
  }
  return cache.get(chemin);
}

export const sourates = () => charger('sourates.json');
export const texte = (s) => charger(`texte/${num(s)}.json`);
export const mots = (s) => charger(`mots/${num(s)}.json`);
export const racines = () => charger('racines.json');
export const langues = () => charger('traductions/langues.json');
export const traductionsDisponibles = () => charger('traductions/disponibles.json').catch(() => []);

async function toutes(fonction) {
  const liste = await Promise.all(Array.from({ length: 114 }, (_, i) => fonction(i + 1)));
  return new Map(liste.map((d) => [d.sourate, d]));
}
export const toutLeTexte = () => toutes(texte);
export const tousLesMots = () => toutes(mots);

// Traduction tanzil : « sourate|verset|texte » par ligne ; lignes « # » = commentaires de licence.
export async function traduction(id) {
  const brut = await charger(`traductions/${id}.txt`, 'text');
  const carte = new Map();
  for (const ligne of brut.split(/\r?\n/)) {
    const m = ligne.match(/^(\d+)\|(\d+)\|(.*)$/);
    if (m) carte.set(`${m[1]}:${m[2]}`, m[3]);
  }
  return carte;
}
