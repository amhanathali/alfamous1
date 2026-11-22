// Outils de normalisation pour comparer des mots arabes ou translittérés.

// Arabe : on retire voyelles et signes coraniques, on unifie les formes d'alif, de yā' et de tā' marbūṭa.
export function normaliserArabe(texte) {
  return (texte || '')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

// Latin : minuscules, sans diacritiques, sans ʿ ni ʾ, tirets et apostrophes ignorés.
export function normaliserLatin(texte) {
  return (texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʿʾ'’`\-]/g, '');
}

export const estArabe = (texte) => /[؀-ۿ]/.test(texte || '');
