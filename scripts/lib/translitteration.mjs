// Translittération savante du texte arabe vocalisé (graphie uthmanie de tanzil.net) en lettres latines.
// Système inspiré de la norme DIN 31635, celui du blog Alfamous : ā ī ū ṯ ǧ ḥ ḫ ḏ š ṣ ḍ ṭ ẓ ʿ ġ ʾ.
// Chaque mot est translittéré isolément (forme de citation) : « bismi allāhi ar-raḥmāni ar-raḥīmi ».
// Travail original d'Alfamous1 (aucune donnée de coran-seul.com).

const CONSONNES = {
  'ء': 'ʾ', 'أ': 'ʾ', 'إ': 'ʾ', 'ؤ': 'ʾ', 'ئ': 'ʾ', 'ٔ': 'ʾ',
  'ب': 'b', 'ت': 't', 'ث': 'ṯ', 'ج': 'ǧ', 'ح': 'ḥ', 'خ': 'ḫ', 'د': 'd', 'ذ': 'ḏ',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'š', 'ص': 'ṣ', 'ض': 'ḍ', 'ط': 'ṭ', 'ظ': 'ẓ',
  'ع': 'ʿ', 'غ': 'ġ', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 't', 'و': 'w', 'ي': 'y', 'ى': 'y',
};
const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SUKUN = 'ْ', SHADDA = 'ّ';
const FATHATAN = 'ً', DAMMATAN = 'ٌ', KASRATAN = 'ٍ';
const ALIF_SUSCRIT = 'ٰ';            // petit alif (ā)
const MADDA = 'ٓ';
const MUET = '۟';                    // petit zéro : lettre non prononcée
const PETIT_WAW = '\u06E5', PETIT_YA = '\u06E6', PETIT_YA_HAUT = '\u06E7';
const IGNORES = new Set(['\u0640', '\u06DC', '\u06E0', '\u06E2', '\u06E3', '\u06E8', '\u06EA', '\u06EB', '\u06EC', '\u06ED']);
const SOLAIRES = new Set('تثدذرزسشصضطظلن');

// Découpe un mot en lettres, chacune avec ses signes diacritiques.
function lettres(mot) {
  const res = [];
  let precedent = '';
  for (const c of mot) {
    const tatweel = precedent === '\u0640';
    precedent = c;
    if (c === '\u0654' && tatweel) { res.push({ l: 'ء', signes: '' }); continue; } // hamza posée sur un trait
    if (IGNORES.has(c)) continue;
    if (/[\u064B-\u0654\u0670\u06DF\u06E5\u06E6\u06E7]/.test(c) && res.length) res[res.length - 1].signes += c;
    else res.push({ l: c, signes: '' });
  }
  return res;
}

const voyelle = (s) => (s.includes(FATHA) ? 'a' : s.includes(DAMMA) ? 'u' : s.includes(KASRA) ? 'i'
  : s.includes(FATHATAN) ? 'an' : s.includes(DAMMATAN) ? 'un' : s.includes(KASRATAN) ? 'in' : '');

// Lettres isolées en tête de sourate (الٓمٓ, حمٓ…) : on épelle leur nom.
const NOMS_LETTRES = {
  'ا': 'alif', 'ل': 'lām', 'م': 'mīm', 'ر': 'rā', 'ص': 'ṣād', 'ك': 'kāf', 'ه': 'hā', 'ي': 'yā',
  'ع': 'ʿayn', 'ط': 'ṭā', 'س': 'sīn', 'ح': 'ḥā', 'ق': 'qāf', 'ن': 'nūn',
};

export function translittererMot(mot) {
  const L = lettres(mot);
  if (L.length <= 5 && L.every((x) => NOMS_LETTRES[x.l] && !/[\u064B-\u0652]/.test(x.signes))) {
    return L.map((x) => NOMS_LETTRES[x.l]).join('-');
  }
  let out = '';
  let i = 0;

  // Article ٱل (alif de liaison) : assimilation devant les lettres solaires.
  if (L[0]?.l === 'ٱ' && L[1]?.l === 'ل' && L[2]) {
    const suivante = L[2];
    // Le nom divin : ٱللَّه → allāh
    if (suivante.l === 'ل' && suivante.signes.includes(SHADDA) && L[3]?.l === 'ه') {
      out = 'allāh'; i = 4;
      const v = voyelle(L[3].signes); out += v;
      return out + translitterer(L.slice(i));
    }
    if (L[1].signes.includes(SHADDA)) {          // ٱلَّذِينَ, ٱلَّتِي : un seul lām écrit, redoublé
      return 'all' + voyelle(L[1].signes) + translitterer(L.slice(2));
    }
    if (SOLAIRES.has(suivante.l) && suivante.signes.includes(SHADDA)) {
      out = `a${CONSONNES[suivante.l]}-`; // la consonne redoublée sera écrite par la suite
      i = 2;
    } else { out = 'al-'; i = 2; }
  } else if (L[0]?.l === 'ٱ') {
    out = voyelle(L[0].signes) || 'i'; i = 1; // alif de liaison isolé (ex. ٱهْدِنَا → ihdinā)
  }
  let res = out + translitterer(L.slice(i), out === '');
  const squelette = mot.replace(/[^\u0621-\u064A\u0671]/g, '');
  if (/^[وفبلت]*ٱ?لله(م)?$/.test(squelette)) res = res.replace(/-l-lah/, '-llāh').replace(/lla(h)/, 'llā$1');
  // Article assimilé : « ar-rraḥmān » → « ar-raḥmān »
  return res.replace(/^a(.)-\1\1/u, 'a$1-$1');
}

function translitterer(L, debutDeMot = false) {
  let out = '';
  let simple = false;
  for (let k = 0; k < L.length; k++) {
    const { l, signes } = L[k];
    const prec = out.slice(-1);
    if (signes.includes(MUET)) continue;                     // lettre écrite mais non prononcée

    if (l === 'ا' || l === 'آ') {
      if (l === 'آ') { out += (k === 0 && debutDeMot ? '' : 'ʾ') + 'ā'; continue; }
      if (prec === 'a') { out = out.slice(0, -1) + 'ā'; continue; } // fatha + alif = ā
      if (/an$/.test(out)) continue;                          // alif après tanwīn fatḥ
      const v = voyelle(signes);
      if (v) out += v;
      continue;
    }
    if (l === 'ى' && !voyelle(signes) && !signes.includes(SHADDA) && !signes.includes(SUKUN)) {
      if (signes.includes(ALIF_SUSCRIT) || prec === 'a') { out = out.replace(/a$/, '') + 'ā'; continue; }
      if (prec === 'i') { out = out.slice(0, -1) + 'ī'; continue; }
      if (/an$/.test(out)) continue;
      continue;
    }
    if (l === 'و' && signes.includes(ALIF_SUSCRIT) && !voyelle(signes)) { out = out.replace(/a?$/, 'ā'); continue; } // صَلَوٰة
    // Voyelles longues : ū (damma + waw nu), ī (kasra + ya nu)
    if (l === 'و' && prec === 'u' && !voyelle(signes) && !signes.includes(SHADDA)) { out = out.slice(0, -1) + 'ū'; continue; }
    if (l === 'ي' && prec === 'i' && !voyelle(signes) && !signes.includes(SHADDA)) { out = out.slice(0, -1) + 'ī'; continue; }

    if (l === 'ٱ' && k > 0 && L[k + 1]?.l === 'ل') {        // article après préfixe : وَٱلْأَرْضِ → wa-l-ʾarḍi
      const apres = L[k + 2];
      if (apres && SOLAIRES.has(apres.l) && apres.signes.includes(SHADDA) && !L[k + 1].signes) {
        out += `-${CONSONNES[apres.l]}-`; simple = true;
      } else out += '-l-';
      k++;                                                    // le lām est déjà écrit (ou assimilé)
      continue;
    }
    const c = CONSONNES[l];
    if (!c) continue;
    const double = signes.includes(SHADDA) && !(k === 0 && debutDeMot) && !simple;
    simple = false;
    if (c === 'ʾ' && k === 0 && debutDeMot) { /* hamza initiale non notée */ }
    else out += double ? c + c : c;
    if (l === 'ة' && !voyelle(signes)) { out = out.slice(0, -1) + 'a'; continue; } // tāʾ marbūṭa en pause
    out += voyelle(signes);
    if (signes.includes(ALIF_SUSCRIT)) out = out.replace(/a?$/, 'ā');
    if (signes.includes(PETIT_WAW)) out = out.replace(/u?$/, 'ū');
    if (signes.includes(PETIT_YA) || signes.includes(PETIT_YA_HAUT)) out = out.replace(/i?$/, 'ī');
  }
  return out
    .replace(/([^-])\1\1+/gu, '$1$1')
    .replace(/uū/g, 'ū').replace(/iī/g, 'ī').replace(/aā/g, 'ā')
    .replace(/([ūī])\1+/g, '$1');
}

export function translittererVerset(texte) {
  return texte.split(/\s+/).filter((m) => /[ء-يٱ]/.test(m)).map(translittererMot).join(' ');
}
