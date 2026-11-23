// Historique des recherches : fonctions pures (testées par npm test, tests/historique.test.mjs).
export const HISTORIQUE_MAX = 50;
export const RECHERCHE_MAX = 200;

// Fusion de plusieurs listes [{ q, t }] : une seule fois chaque recherche (la plus récente gardée),
// de la plus récente à la plus ancienne, 50 au plus. Les éléments mal formés sont ignorés.
export function fusionnerHistoriques(...listes) {
  const parQ = new Map();
  for (const l of listes) {
    for (const x of Array.isArray(l) ? l : []) {
      if (!x || typeof x.q !== 'string' || !Number.isFinite(x.t)) continue;
      const q = x.q.trim().slice(0, RECHERCHE_MAX);
      if (!q) continue;
      if (!parQ.has(q) || parQ.get(q) < x.t) parQ.set(q, x.t);
    }
  }
  return [...parQ].map(([q, t]) => ({ q, t })).sort((a, b) => b.t - a.t).slice(0, HISTORIQUE_MAX);
}
