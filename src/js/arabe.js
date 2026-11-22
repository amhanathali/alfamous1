// Normalisation pour la recherche, alignée sur l'ancienne application Alfamous (Zoom-Coran.js) :
//   - voyelles, signes coraniques et shadda retirés ;
//   - formes d'alif (أ إ آ ٱ) → ا ; ة → ت ; ى → ي ; ؤ → و ; ئ → ي ; tatwīl retiré ;
//   - « AWY » : les lettres ا و ي sont retirées du texte ET de la requête, sauf celles que
//     l'utilisateur a tapées. Ainsi « رحمن » trouve ٱلرَّحْمَـٰنِ, et « كتب » trouve ٱلْكِتَـٰبُ.

const DIACRITIQUES = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const AWY = ['ا', 'و', 'ي'];

function base(texte) {
  return String(texte || '')
    .normalize('NFC')
    .replace(/[ﻵ-ﻼ]/g, 'لا')
    .replace(/ـ/g, '')
    .replace(DIACRITIQUES, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ة/g, 'ت')
    .replace(/[ىی]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[^ء-ي\s]/g, '');
}

// Lettres faibles présentes dans la requête (à conserver).
export function calculerAwy(requete) {
  const b = base(requete);
  return new Set(AWY.filter((l) => b.includes(l)));
}

// awy : Set des lettres faibles à garder ; null = garder toutes les lettres.
export function normaliserArabe(texte, awy = null) {
  const b = base(texte);
  if (!awy) return b;
  return b.replace(/[اوي]/g, (l) => (awy.has(l) ? l : ''));
}

// Latin : minuscules, sans diacritiques ni ponctuation, sans ʿ ni ʾ.
export function normaliserLatin(texte) {
  return String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export const estArabe = (texte) => /[؀-ۿ]/.test(texte || '');
export const aDesVoyelles = (texte) => /[ً-ْ]/.test(texte || '');
