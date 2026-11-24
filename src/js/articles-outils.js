// Articles : fonctions pures (testées par npm test, tests/articles.test.mjs). Modèle : docs/ARTICLES.md.

export const FAMILLES = {
  racines: 'Analyses de racines',
  critiques: 'Articles critiques',
  identite: 'Identité amazighe & kabyle',
  reflexions: 'Autres réflexions',
};
export const LIMITES = { titre: 200, resume: 500, libelles: 10, libelle: 40, corps: 300000, versets: 300, slug: 100 };

// Adresse lisible (slug) à partir d'un titre : minuscules sans accents, lettres latines et chiffres, tirets.
// Les lettres arabes et les signes de translittération (ʿ ʾ) sont retirés ; ṣ, ḥ… perdent leur point.
// Un titre sans lettre latine donne '' : l'appelant complète (date, identifiant).
export function slugifier(titre, max = LIMITES.slug) {
  const s = String(titre ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents et points souscrits (décomposés par NFKD)
    .toLowerCase()
    .replace(/[œ]/g, 'oe').replace(/[æ]/g, 'ae').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length <= max) return s;
  const coupe = s.slice(0, max);
  return (coupe.includes('-') ? coupe.slice(0, coupe.lastIndexOf('-')) : coupe).replace(/-+$/g, '');
}

export const slugValide = (s) => typeof s === 'string' && s.length >= 3 && s.length <= LIMITES.slug
  && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

// Slug d'un article importé de Blogger : chemin « /AAAA/MM/<slug>.html » ; un slug générique (« blog-post »,
// trop court, ou suffixé « _0106756503 ») est complété par l'année et le mois pour rester unique et lisible.
export function slugDepuisBlogger(chemin) {
  const m = String(chemin ?? '').match(/^\/(\d{4})\/(\d{2})\/([^/]+?)\.html$/);
  if (!m) return '';
  const [, annee, mois, brut] = m;
  let s = slugifier(brut.replace(/_\d+$/, ''));
  if (!slugValide(s) || s === 'blog-post') s = `${s && s !== 'blog-post' ? s + '-' : 'article-'}${annee}-${mois}`;
  return s;
}

// Références de versets « s:v » repérées dans un texte (19:26, 19.26, 2 : 183), dans l'ordre d'apparition et
// sans doublon ; seules les références qui existent (sourates = [{ n, versets }]) sont gardées.
export function versetsDansTexte(texte, sourates) {
  const max = new Map((sourates ?? []).map((s) => [s.n, s.versets]));
  const vus = new Set();
  // Pas collé à un autre nombre (« 10.11.2024 », « 1.2.3 ») ; une ponctuation finale (« 19.26, ») est acceptée.
  const re = /(?<!\d|\d[.,:/])(\d{1,3})\s?[:.]\s?(\d{1,3})(?!\d|[.,:/]\d)/g;
  for (const m of String(texte ?? '').matchAll(re)) {
    const s = Number(m[1]); const v = Number(m[2]);
    if (max.has(s) && v >= 1 && v <= max.get(s)) vus.add(`${s}:${v}`);
  }
  return [...vus];
}

// Sourates des versets cités, triées : une seule requête Firestore par sourate affichée (array-contains).
export const souratesDe = (versets) => [...new Set((versets ?? []).map((r) => Number(String(r).split(':')[0])))]
  .filter((n) => n >= 1 && n <= 114).sort((a, b) => a - b);

// Libellés : espaces simples, 40 caractères, sans doublon (casse ignorée), 10 au plus.
export function nettoyerLibelles(liste) {
  const vus = new Set(); const res = [];
  for (const brut of liste ?? []) {
    const l = String(brut ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITES.libelle);
    const k = l.toLocaleLowerCase('fr');
    if (l && !vus.has(k)) { vus.add(k); res.push(l); }
  }
  return res.slice(0, LIMITES.libelles);
}

// Les versets marqués « cité » du panneau Contexte deviennent les champs publics versets et sourates.
export function champsCites(contexte) {
  const versets = [...new Set((contexte?.versets ?? []).filter((v) => v?.cite).map((v) => v.ref))]
    .filter((r) => /^\d{1,3}:\d{1,3}$/.test(r)).slice(0, LIMITES.versets);
  return { versets, sourates: souratesDe(versets) };
}
