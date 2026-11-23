// Gestion des niveaux des membres : fonctions pures (testées par npm test, tests/membres.test.mjs).
// Niveaux (docs/DROITS.md) : 0 = visiteur, courriel non vérifié ou bloqué ; 1 = membre (par défaut, sans
// revendication) ; 2 = modérateur ; 3 = admin. La revendication « niveau » n'est posée que pour 0 (bloqué), 2 et 3.

export class ErreurMembres extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// L'appelant doit être un admin au courriel vérifié (lu dans son jeton, jamais dans les données envoyées).
export function verifierAdmin(auth) {
  if (!auth) throw new ErreurMembres('unauthenticated', 'Connectez-vous.');
  if (auth.token?.email_verified !== true || auth.token?.niveau !== 3) {
    throw new ErreurMembres('permission-denied', 'Réservé aux admins.');
  }
  return auth;
}

// Demande de changement : { uid, niveau } ; on ne change jamais son propre niveau (il reste toujours un admin).
export function validerChangement(data, uidAppelant) {
  const uid = data?.uid;
  const niveau = data?.niveau;
  if (typeof uid !== 'string' || !uid || uid.length > 128) throw new ErreurMembres('invalid-argument', 'Compte non précisé.');
  if (!Number.isInteger(niveau) || niveau < 0 || niveau > 3) throw new ErreurMembres('invalid-argument', 'Niveau invalide (0 à 3).');
  if (uid === uidAppelant) throw new ErreurMembres('failed-precondition', 'Vous ne pouvez pas changer votre propre niveau.');
  return { uid, niveau };
}

// Niveau effectif d'un compte, comme le calculent les règles Firestore.
export function niveauDe(compte) {
  if (!compte?.emailVerified) return 0;
  const n = compte.customClaims?.niveau;
  return Number.isInteger(n) ? n : 1;
}

// Nouvelles revendications : les autres sont gardées ; niveau 1 = pas de revendication (comme npm run niveau).
export function revendications(actuelles, niveau) {
  const autres = { ...(actuelles || {}) };
  delete autres.niveau;
  return niveau === 1 ? autres : { ...autres, niveau };
}

// Ligne de la liste des membres (aucune autre donnée du compte n'est renvoyée).
export function resumeMembre(compte, compteurs = {}) {
  const date = (t) => (t ? Date.parse(t) || null : null);
  const m = compte.metadata || {};
  return {
    uid: compte.uid,
    nom: compte.displayName || '',
    courriel: compte.email || '',
    verifie: compte.emailVerified === true,
    niveau: niveauDe(compte),
    bloque: compte.emailVerified === true && compte.customClaims?.niveau === 0,
    creeLe: date(m.creationTime),
    vuLe: date(m.lastRefreshTime) || date(m.lastSignInTime),
    commentaires: compteurs.commentaires ?? null,
    definitions: compteurs.definitions ?? null,
    fils: compteurs.fils ?? null,
    reponses: compteurs.reponses ?? null,
  };
}
