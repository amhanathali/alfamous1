// Découpe un texte de commentaire Alfamous en commentaires individuels.
// Conventions de l'ancienne application :
//   - blocs séparés par une ligne « ----------- » ;
//   - chaque bloc se termine par une ou plusieurs signatures « @Nom » ou « @Nom - date ».
// Formats de date rencontrés : 2024-09-13 23:03:51 | 07/11/2026 14:17:35 | 2024-10-06, 2:09:02 PM

const SEPARATEUR = /\n?\s*-{5,}\s*\n?/;
const SIGNATURE = /^\s*@([^\n@]+?)(?:\s+-\s+(.+?))?\s*$/;

export function normaliserDate(brute) {
  if (!brute) return null;
  let m = brute.match(/^(\d{4})-(\d{2})-(\d{2})[ ,T]+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
  if (m) {
    let [, a, mo, j, h, mi, s, ap] = m;
    h = Number(h);
    if (ap) { if (/pm/i.test(ap) && h < 12) h += 12; if (/am/i.test(ap) && h === 12) h = 0; }
    return `${a}-${mo}-${j}T${String(h).padStart(2, '0')}:${mi}:${s}`;
  }
  m = brute.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, j, mo, a, h, mi, s] = m; // format jour/mois/année (Québec, France)
    return `${a}-${mo}-${j}T${h.padStart(2, '0')}:${mi}:${s}`;
  }
  return null;
}

export function decouperCommentaires(texte) {
  const resultat = [];
  if (!texte || !texte.trim()) return resultat;
  for (const bloc of texte.split(SEPARATEUR)) {
    if (!bloc.trim()) continue;
    const lignes = bloc.split('\n');
    const corps = [];
    const signatures = [];
    for (const l of lignes) {
      const m = l.match(SIGNATURE);
      if (m) signatures.push({ auteur: m[1].trim(), dateBrute: m[2] || null });
      else corps.push(l);
    }
    const texteCommentaire = corps.join('\n').trim();
    if (!texteCommentaire && !signatures.length) continue;
    // On retient la signature datée la plus récente, sinon la dernière signature.
    const datees = signatures.filter((s) => normaliserDate(s.dateBrute));
    const sig = datees.length ? datees[datees.length - 1] : signatures[signatures.length - 1];
    resultat.push({
      texte: texteCommentaire,
      auteur: sig ? sig.auteur : null,
      date: sig ? normaliserDate(sig.dateBrute) : null,
      dateBrute: sig ? sig.dateBrute : null,
      vide: !texteCommentaire,
    });
  }
  return resultat;
}
