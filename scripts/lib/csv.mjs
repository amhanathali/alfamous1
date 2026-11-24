// Lecteur CSV minimal (RFC 4180) : guillemets, guillemets doublés, retours à la ligne dans les cellules.
// Aucune dépendance externe.
export function lireCsv(texte, separateur = ',') {
  const lignes = [];
  let ligne = [];
  let cellule = '';
  let entreGuillemets = false;
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1); // BOM éventuel
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { cellule += '"'; i++; }
        else entreGuillemets = false;
      } else cellule += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === separateur) { ligne.push(cellule); cellule = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = '';
    } else cellule += c;
  }
  if (cellule !== '' || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
  return lignes;
}
