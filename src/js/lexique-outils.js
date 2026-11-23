// Lexique : fonctions pures (testées par npm test, tests/lexique.test.mjs).

// Voyelles, signes coraniques, alif suscrit et tatwīl retirés ; lettres (hamza comprises) conservées.
const SIGNES = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
export const CLE_MAX = 200;

// Clé d'une entrée du lexique : sans voyelles, espaces simples (décision du 23 nov. 2026).
export function normaliserCle(cle) {
  return String(cle ?? '').normalize('NFC').replace(SIGNES, '').replace(/\s+/g, ' ').trim();
}

// Une clé est une racine du Coran si elle figure telle quelle dans racines.json.
export const estRacine = (cle, racines) => Object.prototype.hasOwnProperty.call(racines, cle);

// « Racines proches (lettres communes) », reprise de l'ancien module « synonymes » (synonymes.js) :
// chaque lettre n'est gardée qu'une fois (dans l'ordre), puis on prend toutes les suites d'au moins
// deux lettres qui se suivent ; une racine est proche si elle contient l'une de ces suites.
// Rapprochement par les lettres seulement, pas par le sens.
export function suitesDeLettres(racine, { inverse = false } = {}) {
  let lettres = [...new Set([...normaliserCle(racine).replace(/\s/g, '')])];
  if (inverse) lettres = lettres.reverse();
  const suites = [];
  for (let debut = 0; debut < lettres.length; debut++) {
    for (let fin = debut + 2; fin <= lettres.length; fin++) suites.push(lettres.slice(debut, fin).join(''));
  }
  return [...new Set(suites)];
}

// racines : { racine: [occurrences…] } (racines.json) ; retourne [{ racine, n }] dans l'ordre alphabétique arabe.
export function racinesProches(racine, racines, { inverse = false } = {}) {
  const suites = suitesDeLettres(racine, { inverse });
  const soi = normaliserCle(racine);
  if (!suites.length) return [];
  return Object.keys(racines)
    .filter((r) => r !== soi && suites.some((s) => r.includes(s)))
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .map((r) => ({ racine: r, n: racines[r].length }));
}

// Définitions (commentaires de type « lexique ») → entrées [{ cle, definitions, derniere }],
// dans l'ordre alphabétique arabe. derniere = définition la plus récente (pour l'extrait).
export function grouperEntrees(definitions) {
  const parCle = new Map();
  for (const d of definitions) {
    if (!parCle.has(d.cle)) parCle.set(d.cle, []);
    parCle.get(d.cle).push(d);
  }
  const temps = (t) => (t?.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : Number(t) || 0);
  return [...parCle].map(([cle, liste]) => {
    const triees = liste.slice().sort((a, b) => temps(b.creeLe) - temps(a.creeLe));
    return { cle, definitions: liste.length, derniere: triees.find((d) => !d.masque) || null };
  }).sort((a, b) => a.cle.localeCompare(b.cle, 'ar'));
}

// Filtre de la liste : la clé ou le texte d'une définition contient ce qui est tapé
// (arabe sans voyelles, latin sans accents ni majuscules).
const plat = (t) => normaliserCle(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function filtrerEntrees(entrees, definitions, saisie) {
  const q = plat(saisie);
  if (!q) return entrees;
  const clesTexte = new Set(definitions.filter((d) => !d.masque && plat(d.texte).includes(q)).map((d) => d.cle));
  return entrees.filter((e) => plat(e.cle).includes(q) || clesTexte.has(e.cle));
}
