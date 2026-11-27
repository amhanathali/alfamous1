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

// Extrait et surlignage : module commun à tous les onglets filtrés.
export { extrait, surlignerDans } from './surligner.js';

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
