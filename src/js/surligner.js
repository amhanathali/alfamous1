// Surlignage du terme tapé dans un filtre (Lecture, Lexique, Articles, Forum, Témoignages) : fonctions testées par npm test.
// La comparaison suit l'esprit des filtres : sans majuscules ni accents (« fatiha » trouve « Fātiḥa »), sans voyelles
// arabes ni tatwīl, formes d'alif confondues (« الاخلاص » trouve « الإخلاص »), ʿ et ʾ ignorés.
// Seuls les nœuds de texte sont modifiés : balises, liens et attributs restent intacts.

const SIGNES_ARABES = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
const DIGRAMMES = { ṯ: 'th', ḏ: 'dh', ḫ: 'kh', š: 'sh', ġ: 'gh', Ṯ: 'th', Ḏ: 'dh', Ḫ: 'kh', Š: 'sh', Ġ: 'gh' };

// Un caractère → sa forme comparable ('' s'il est ignoré).
export function plier(c) {
  if (SIGNES_ARABES.test(c) || c === 'ʿ' || c === 'ʾ') return '';
  if (/[ٱأإآ]/.test(c)) return 'ا';
  if (c === 'ة') return 'ت';
  if (c === 'ى' || c === 'ی') return 'ي';
  return c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
// Variante : ṯ ḏ ḫ š ġ lus aussi th dh kh sh gh (filtre des sourates : « kawthar »).
export const plierDigrammes = (c) => DIGRAMMES[c] ?? plier(c);

// Texte → { plie, origine } : origine[i] = indice, dans le texte d'origine, du caractère qui a donné plie[i].
function plierTexte(texte, f) {
  let plie = ''; const origine = [];
  let i = 0;
  for (const c of texte) {
    const p = f(c);
    for (let k = 0; k < p.length; k += 1) origine.push(i);
    plie += p;
    i += c.length;
  }
  return { plie, origine };
}
const plierTerme = (terme, f) => [...String(terme || '').trim()].map(f).join('');

// Plages [début, fin[ du terme dans un texte (indices du texte d'origine). debut : seulement en tête du texte.
export function plages(texte, terme, { plier: f = plier, debut = false } = {}) {
  const q = plierTerme(terme, f);
  if (!q) return [];
  const { plie, origine } = plierTexte(String(texte || ''), f);
  const r = [];
  for (let i = plie.indexOf(q); i >= 0; i = plie.indexOf(q, i + q.length)) {
    if (debut && i > 0) break;
    const fin = i + q.length < origine.length ? origine[i + q.length] : texte.length;
    // Signes ignorés (voyelles) juste après le dernier caractère trouvé : gardés dans la plage.
    let j = fin; while (j < texte.length && !f(texte[j])) j += 1;
    r.push([origine[i], j]);
    if (debut) break;
  }
  return r;
}

// Retire les surlignages posés par surlignerDans (avant de surligner un nouveau terme dans la même page).
export function effacerSurlignage(racine) {
  racine?.querySelectorAll('mark.surligne-filtre').forEach((m) => m.replaceWith(...m.childNodes));
  racine?.normalize();
}

// Surligne le terme dans le texte d'un élément affiché ; renvoie le premier <mark> posé, ou null.
export function surlignerDans(racine, terme, options = {}) {
  if (!racine || !String(terme || '').trim()) return null;
  const doc = racine.ownerDocument;
  const marcheur = doc.createTreeWalker(racine, 4 /* NodeFilter.SHOW_TEXT */);
  const noeuds = [];
  while (marcheur.nextNode()) {
    const n = marcheur.currentNode;
    if (!n.parentElement?.closest('mark, script, style, textarea, input')) noeuds.push(n);
  }
  let premier = null;
  for (const n of noeuds) {
    const s = n.nodeValue;
    const p = plages(s, terme, options);
    if (!p.length) continue;
    const frag = doc.createDocumentFragment();
    let pos = 0;
    for (const [a, b] of p) {
      if (a > pos) frag.append(s.slice(pos, a));
      const mark = doc.createElement('mark');
      mark.className = 'surligne-filtre';
      mark.textContent = s.slice(a, b);
      frag.append(mark);
      premier ||= mark;
      pos = b;
    }
    if (pos < s.length) frag.append(s.slice(pos));
    n.replaceWith(frag);
  }
  return premier;
}

// Fait défiler jusqu'au premier passage surligné (après le retour en haut de page fait par le routeur).
export function allerAuPassage(mark) {
  if (mark) setTimeout(() => mark.scrollIntoView({ block: 'center' }), 0);
}

// Extrait d'une ligne pour une liste. Si le terme est trouvé loin dans le texte, l'extrait commence un peu avant
// lui (« … ») pour que le passage soit visible et surligné.
export function extrait(texte, max = 180, terme = '') {
  let t = String(texte || '').replace(/\s+/g, ' ').trim();
  let avant = '';
  const p = terme ? plages(t, terme) : [];
  const i = p.length ? p[0][0] : -1;
  if (i >= 0 && p[0][1] > max - 20) {
    const coupe = t.lastIndexOf(' ', Math.max(0, i - 60));
    t = t.slice(coupe + 1);
    avant = '…';
  }
  return avant + (t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t);
}

// Paramètre « ?q=… » ajouté au lien d'un élément ouvert depuis une liste filtrée.
export const avecTerme = (lien, terme) => (String(terme || '').trim() ? `${lien}?q=${encodeURIComponent(String(terme).trim())}` : lien);
