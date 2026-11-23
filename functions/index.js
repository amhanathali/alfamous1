// Cloud Functions d'Alfamous1 : gestion des niveaux des membres par l'onglet « Membres » (admins seulement).
// Région des données : northamerica-northeast1 (Montréal). Maquette : docs/maquettes/membres.html.
//   membres       → liste des inscrits (nom, courriel, vérifié, dates, niveau, nombres de contributions) + journal
//   changerNiveau → pose la revendication « niveau » d'un compte et l'inscrit au journal (journalNiveaux)
// Le niveau de l'appelant est lu dans son jeton : seul un admin (niveau 3, courriel vérifié) est servi.
// La collection journalNiveaux reste fermée aux clients (firestore.rules) : seules ces fonctions la lisent et l'écrivent.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ErreurMembres, verifierAdmin, validerChangement, niveauDe, revendications, resumeMembre } from './membres-outils.js';

initializeApp();
setGlobalOptions({ region: 'northamerica-northeast1', maxInstances: 2 });

// Erreurs « métier » → erreurs lisibles côté navigateur (message en français).
const enveloppe = (f) => async (req) => {
  try { return await f(req); } catch (e) {
    if (e instanceof ErreurMembres) throw new HttpsError(e.code, e.message);
    throw e;
  }
};

const compter = (q) => q.count().get().then((s) => s.data().count).catch(() => null);

export const membres = onCall(enveloppe(async (req) => {
  verifierAdmin(req.auth);
  const auth = getAuth();
  const db = getFirestore();
  const comptes = [];
  let page;
  do {
    page = await auth.listUsers(1000, page?.pageToken);
    comptes.push(...page.users);
  } while (page.pageToken);

  const liste = await Promise.all(comptes.map(async (u) => {
    const [commentaires, definitions, fils, reponses] = await Promise.all([
      compter(db.collection('commentaires').where('auteurUid', '==', u.uid).where('type', '==', 'verset')),
      compter(db.collection('commentaires').where('auteurUid', '==', u.uid).where('type', '==', 'lexique')),
      compter(db.collection('notes').where('auteurUid', '==', u.uid).where('publie', '==', true)),
      compter(db.collectionGroup('reponses').where('auteurUid', '==', u.uid)),
    ]);
    return resumeMembre(u, { commentaires, definitions, fils, reponses });
  }));
  liste.sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0)); // plus récents en premier

  const journal = (await db.collection('journalNiveaux').orderBy('le', 'desc').limit(50).get()).docs.map((d) => {
    const j = d.data();
    return { le: j.le?.toMillis?.() ?? null, parNom: j.parNom, cibleNom: j.cibleNom, avant: j.avant, apres: j.apres };
  });
  return { membres: liste, journal };
}));

export const changerNiveau = onCall(enveloppe(async (req) => {
  const appelant = verifierAdmin(req.auth);
  const { uid, niveau } = validerChangement(req.data, appelant.uid);
  const auth = getAuth();
  const compte = await auth.getUser(uid).catch(() => { throw new ErreurMembres('not-found', 'Compte introuvable.'); });
  if (!compte.emailVerified) {
    throw new ErreurMembres('failed-precondition', 'Courriel non vérifié : le niveau sera modifiable après la vérification.');
  }
  const avant = niveauDe(compte);
  if (avant === niveau) return { avant, apres: niveau, inchange: true };
  await auth.setCustomUserClaims(uid, revendications(compte.customClaims, niveau));
  // Bloqué : ses sessions sont fermées ; à la reconnexion, son jeton porte le niveau 0.
  if (niveau === 0) await auth.revokeRefreshTokens(uid);
  await getFirestore().collection('journalNiveaux').add({
    le: FieldValue.serverTimestamp(),
    parUid: appelant.uid, parNom: appelant.token.name || appelant.token.email || '',
    cibleUid: uid, cibleNom: compte.displayName || compte.email || '', cibleCourriel: compte.email || '',
    avant, apres: niveau,
  });
  return { avant, apres: niveau };
}));
