// Témoignages : fonctions pures (testées par npm test), partagées par l'onglet et le script d'import.
import { echapper } from './commentaires-format.js';

export const LIMITES_TEMOIGNAGE = { titre: 200, texteMin: 40, texteMax: 20000 };
export const NOM_ANONYME = 'Anonyme';

// Signature affichée : « Anonyme » si l'auteur a coché « Masquer mon nom ».
export const signature = (t) => (t?.anonyme || !t?.auteurNom ? NOM_ANONYME : t.auteurNom);

// Champs d'identité du document public, selon la case « Masquer mon nom » : un témoignage anonyme ne porte
// ni le compte ni le nom (le document est lu par tous ; l'auteur réel est dans prive/auteur).
export function identite(anonyme, uid, nom) {
  return anonyme ? { anonyme: true, auteurUid: null, auteurNom: '' } : { anonyme: false, auteurUid: uid, auteurNom: nom };
}

// Vérification du formulaire (mêmes bornes que les règles Firestore) ; '' si tout va bien.
export function verifierTemoignage({ titre, texte }) {
  if (!titre) return 'Le titre est vide.';
  if (titre.length > LIMITES_TEMOIGNAGE.titre) return `Titre trop long (${LIMITES_TEMOIGNAGE.titre} caractères au plus).`;
  if (texte.length < LIMITES_TEMOIGNAGE.texteMin) return `Témoignage trop court (${LIMITES_TEMOIGNAGE.texteMin} caractères au moins).`;
  if (texte.length > LIMITES_TEMOIGNAGE.texteMax) return `Témoignage trop long (${LIMITES_TEMOIGNAGE.texteMax} caractères au plus).`;
  return '';
}

// Texte simple → HTML : échappé ; une ligne vide sépare les paragraphes, un saut de ligne simple reste un saut de ligne.
// Les adresses https deviennent des liens (ouverts dans un nouvel onglet).
export function texteEnParagraphes(texte) {
  const lien = (h) => h.replace(/https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)»]/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  return String(texte || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    .map((b) => `<p>${lien(echapper(b)).replace(/\n/g, '<br>')}</p>`).join('');
}

// Extrait d'une ligne pour la liste. Avec un terme filtré trouvé loin dans le texte, l'extrait commence un peu
// avant lui (« …début coupé ») pour que le passage trouvé soit visible et surligné.
export function extrait(texte, max = 180, terme = '') {
  let t = String(texte || '').replace(/\s+/g, ' ').trim();
  let debut = '';
  const i = terme ? t.toLocaleLowerCase('fr').indexOf(terme.toLocaleLowerCase('fr')) : -1;
  if (i >= 0 && i > max - terme.length - 20) {
    const coupe = t.lastIndexOf(' ', Math.max(0, i - 60));
    t = t.slice(coupe + 1);
    debut = '…';
  }
  return debut + (t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t);
}

// Surligne un terme (sans tenir compte des majuscules) dans le texte d'un élément déjà affiché : seuls les nœuds de
// texte sont touchés (balises, liens et attributs intacts). Renvoie le premier <mark> posé, ou null.
export function surlignerDans(racine, terme) {
  const t = String(terme || '').trim();
  if (!racine || !t) return null;
  const doc = racine.ownerDocument;
  const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const marcheur = doc.createTreeWalker(racine, 4 /* NodeFilter.SHOW_TEXT */);
  const noeuds = [];
  while (marcheur.nextNode()) if (!marcheur.currentNode.parentElement?.closest('mark')) noeuds.push(marcheur.currentNode);
  let premier = null;
  for (const n of noeuds) {
    const s = n.nodeValue;
    re.lastIndex = 0;
    if (!re.test(s)) continue;
    re.lastIndex = 0;
    const frag = doc.createDocumentFragment();
    let pos = 0;
    for (const m of s.matchAll(re)) {
      if (m.index > pos) frag.append(s.slice(pos, m.index));
      const mark = doc.createElement('mark');
      mark.className = 'surligne-filtre';
      mark.textContent = m[0];
      frag.append(mark);
      premier ||= mark;
      pos = m.index + m[0].length;
    }
    if (pos < s.length) frag.append(s.slice(pos));
    n.replaceWith(frag);
  }
  return premier;
}

// Contenu de l'ancienne application → texte simple. Les anciens envois sont soit du texte brut, soit le HTML
// du forum (<br>, liens <a href>) : sauts de ligne gardés, balises retirées, entités décodées.
export function ancienContenuEnTexte(html) {
  const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  return String(html || '')
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, '\n\n')
    .replace(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (t, url, txt) => {
      const vu = txt.replace(/<[^>]*>/g, '').trim();
      return vu && vu !== url ? `${vu} (${url})` : url;
    })
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*|#39);/gi, (t, e) => {
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#\d+$/.test(e)) return String.fromCodePoint(Number(e.slice(1)));
      return ENTITES[e.toLowerCase()] ?? t;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
