// Publication « comme le client » : le contenu et le compteur limites/{uid} dans le même lot.
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

export async function lotAvecLimite(d, uid, ajouter) {
  const b = writeBatch(d);
  ajouter(b);
  if (uid) {
    const ref = doc(d, `limites/${uid}`);
    const avant = await getDoc(ref).then((s) => (s.exists() ? s.data() : null)).catch(() => null);
    if (avant && avant.debut.toMillis() > Date.now() - 3600e3) b.set(ref, { debut: avant.debut, n: avant.n + 1, dernier: serverTimestamp() });
    else b.set(ref, { debut: serverTimestamp(), n: 1, dernier: serverTimestamp() });
  }
  return b.commit();
}
