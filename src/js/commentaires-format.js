// Mise en forme des commentaires (fonctions pures, testées par npm test).

export const TEXTE_MAX = 4000;

export const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Texte simple → HTML : échappé, puis liens automatiques (« renvois »).
//   3:14 · 2:255-257   → verset(s)            r:3.14 · r:3:14 → verset 3:14
//   r:1                → sourate 1 (dès 1:1)   p50 · p 50      → page 50
//   r:رحم              → racine               m:رحم+سلم · m:abc+xyz → recherche de mots
// Un nombre seul (« 5 ») reste du texte : seul le préfixe r: en fait un renvoi.
export const AIDE_RENVOIS = 'renvois possibles : 3:14, r:3.14, r:1, p50, r:رحم, m:رحم+سلم, m:abc+xyz';
const TERME = '[^\\s+.,;:!?()«»"\'&<>]+';
const RENVOI = new RegExp(
  '(^|[^\\w:./])(?:'
  + 'r:(\\d{1,3})(?:[.:](\\d{1,3})(?:-(\\d{1,3}))?)?(?![\\w:]|\\.\\d)'          // r:3.14, r:3:14-20, r:1
  + '|(\\d{1,3}):(\\d{1,3})(?:-(\\d{1,3}))?(?![\\d:])'                    // 3:14, 2:255-257
  + '|r:([\\u0621-\\u064A\\u0671]+)'                                     // r:رحم
  + '|[pP] ?(\\d{1,3})(?![\\w:]|\\.\\d)'                                         // p50, p 50
  + `|m: ?(${TERME}(?:\\+${TERME})*)`                                       // m:رحم+سلم, m:abc+xyz
  + ')', 'g');
const estArabe = (t) => /[\u0600-\u06FF]/.test(t);
export function enrichir(texte, lien) {
  return echapper(texte).replace(RENVOI, (tout, avant, rs, rv, ra, vs, vv, va, racine, page, mots) => {
    const vu = tout.slice(avant.length);
    let q;
    let attrs = '';
    if (rs) q = rv ? `${rs}:${rv}${ra ? `-${ra}` : ''}` : rs;
    else if (vs) q = `${vs}:${vv}${va ? `-${va}` : ''}`;
    else if (racine) return `${avant}<a href="${lien(`r:${racine}`)}" class="ar" lang="ar">${racine}</a>`;
    else if (page) q = `p ${page}`;
    else if (mots) { q = `m:${mots}`; if (estArabe(mots)) attrs = ' dir="auto"'; }
    return `${avant}<a href="${lien(q)}"${attrs}>${vu}</a>`;
  });
}

// Horodatage Firestore (ou Date) → « 23 nov. 2026 ».
export function dateCourte(t) {
  const d = t?.toDate ? t.toDate() : t instanceof Date ? t : null;
  return d ? d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'à l\'instant';
}

export const initiale = (nom) => (String(nom || '?').trim()[0] || '?').toUpperCase();

// Message lisible pour une erreur Firebase.
export function messageErreur(e) {
  const code = e?.code || '';
  // Cloud Functions : le message du serveur est déjà en français (« Réservé aux admins. »…).
  if (code.startsWith('functions/') && code !== 'functions/internal' && code !== 'functions/unavailable') {
    return String(e.message || '').replace(/\s*\[\d+\]$/, '') || 'Erreur inconnue.';
  }
  const M = {
    'permission-denied': 'Action refusée : vos droits ne le permettent pas.',
    unavailable: 'Service injoignable. En local, lancez LANCER_EMULATEURS.bat.',
    'auth/invalid-credential': 'Courriel ou mot de passe incorrect.',
    'auth/invalid-email': 'Adresse courriel invalide.',
    'auth/email-already-in-use': 'Un compte existe déjà avec ce courriel.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères au moins).',
    'auth/too-many-requests': 'Trop d\'essais : réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Connexion impossible. En local, lancez LANCER_EMULATEURS.bat.',
    'auth/configuration-not-found': 'Connexion par courriel non activée sur ce projet (console Firebase › Authentication).',
    'auth/operation-not-allowed': 'Connexion par courriel non activée sur ce projet (console Firebase › Authentication).',
    'functions/internal': 'Erreur du serveur (Cloud Functions). Réessayez plus tard.',
    'functions/unavailable': 'Service injoignable. En local, lancez LANCER_EMULATEURS.bat.',
  };
  return M[code] || e?.message || 'Erreur inconnue.';
}
