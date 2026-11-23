// Mise en forme des commentaires (fonctions pures, testées par npm test).

export const TEXTE_MAX = 4000;

export const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Texte simple → HTML : échappé, puis liens automatiques.
//   2:255 ou 2:255-257 → recherche du verset ; r:رحم → vue de la racine.
export function enrichir(texte, lien) {
  return echapper(texte)
    .replace(/(^|[^\d:])(\d{1,3}:\d{1,3}(?:-\d{1,3})?)(?![\d:])/g, (_, avant, ref) => `${avant}<a href="${lien(ref)}">${ref}</a>`)
    .replace(/r:([ء-يٱ]+)/g, (_, r) => `<a href="${lien(`r:${r}`)}" class="ar" lang="ar">${r}</a>`);
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
  const M = {
    'permission-denied': 'Action refusée : vos droits ne le permettent pas.',
    unavailable: 'Service injoignable. En local, lancez LANCER_EMULATEURS.bat.',
    'auth/invalid-credential': 'Courriel ou mot de passe incorrect.',
    'auth/invalid-email': 'Adresse courriel invalide.',
    'auth/email-already-in-use': 'Un compte existe déjà avec ce courriel.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères au moins).',
    'auth/too-many-requests': 'Trop d\'essais : réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Connexion impossible. En local, lancez LANCER_EMULATEURS.bat.',
  };
  return M[code] || e?.message || 'Erreur inconnue.';
}
