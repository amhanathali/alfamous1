// Limite de fréquence (docs/DROITS.md) : 20 publications par heure et par membre.
// Chaque publication (commentaire, note, réponse, signalement) met à jour limites/{uid} dans le même lot ;
// les règles Firestore le vérifient. Modérateurs et admin exemptés.
export const LIMITE_HEURE = 20;

export async function ajouterLimite(lot, db, F, session) {
  if (session.niveau >= 2) return;
  const ref = F.doc(db, `limites/${session.utilisateur.uid}`);
  const snap = await F.getDocFromServer(ref).catch(() => null);
  const avant = snap?.exists() ? snap.data() : null;
  const debut = avant?.debut?.toMillis?.() ?? 0;
  if (avant && debut > Date.now() - 3600e3) {
    if (avant.n >= LIMITE_HEURE) {
      const reprise = new Date(debut + 3600e3).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
      throw Object.assign(new Error(`Limite atteinte : ${LIMITE_HEURE} publications par heure. Vous pourrez publier de nouveau vers ${reprise}.`), { code: 'limite' });
    }
    lot.set(ref, { debut: avant.debut, n: avant.n + 1, dernier: F.serverTimestamp() });
  } else {
    lot.set(ref, { debut: F.serverTimestamp(), n: 1, dernier: F.serverTimestamp() });
  }
}
