// Liens entre les articles et le reste de l'application (étape 3b, docs/ARTICLES.md § 9) :
// - ligne « Articles » sous chaque verset cité par un article publié (une requête par lot de sourates affichées) ;
// - bloc « Articles » dans la fiche d'une entrée du lexique ;
// - « Ajouter au contexte… » (rédacteurs) : versets choisis, entrée du lexique ou racine → panneau Contexte d'un article.
import { firebase, avecDelai } from './firebase.js';
import { session, surChangement, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, dateCourte, messageErreur } from './commentaires-format.js';
import { FAMILLES } from './articles-outils.js';

const adresse = (a) => `#/article/${encodeURIComponent(a.slug || a.id)}`;
const parSourate = new Map(); // sourate → Promise<[articles publiés qui citent un verset de cette sourate]>

// ---------- Sous les versets ----------
async function articlesDesSourates(sourates) {
  const manquantes = sourates.filter((s) => !parSourate.has(s));
  for (let i = 0; i < manquantes.length; i += 10) {
    const lot = manquantes.slice(i, i + 10);
    const promesse = (async () => {
      const { db, F } = await firebase();
      const q = F.query(F.collection(db, 'articles'), F.where('sourates', 'array-contains-any', lot), F.where('statut', '==', 'publie'), F.orderBy('publieLe', 'desc'));
      return (await avecDelai(F.getDocs(q))).docs.map((d) => ({ id: d.id, ...d.data() }));
    })();
    for (const s of lot) parSourate.set(s, promesse.then((liste) => liste.filter((a) => (a.sourates || []).includes(s))).catch(() => { parSourate.delete(s); return []; }));
  }
  const listes = await Promise.all(sourates.map((s) => parSourate.get(s)));
  return listes.flat();
}

let attente = null;
function planifier(contenu) {
  clearTimeout(attente);
  attente = setTimeout(async () => {
    const cartes = [...contenu.querySelectorAll('.verset[data-cle]:not([data-art-vu])')];
    if (!cartes.length) return;
    cartes.forEach((c) => { c.dataset.artVu = '1'; });
    const sourates = [...new Set(cartes.map((c) => Number(c.dataset.cle.split(':')[0])))];
    let articles;
    try { articles = await articlesDesSourates(sourates); } catch { return; }
    for (const c of cartes) {
      const cites = articles.filter((a) => (a.versets || []).includes(c.dataset.cle));
      if (!cites.length || c.querySelector('.ligne-articles')) continue;
      const vus = new Set();
      const liens = cites.filter((a) => !vus.has(a.id) && vus.add(a.id))
        .map((a) => `<a href="${adresse(a)}">${echapper(a.titre)}</a>`).join(' · ');
      c.querySelector('.verset-pied')?.insertAdjacentHTML('beforebegin', `<div class="ligne-articles"><span>Articles :</span> ${liens}</div>`);
    }
  }, 120);
}

// ---------- Fiche du lexique ----------
export async function blocArticlesLexique(zone, cle, racine = false) {
  if (!zone) return;
  try {
    const { db, F } = await firebase();
    const col = F.collection(db, 'articles');
    const q = (champ) => F.query(col, F.where(champ, 'array-contains', cle), F.where('statut', '==', 'publie'), F.orderBy('publieLe', 'desc'));
    const [a, b] = await Promise.all([avecDelai(F.getDocs(q('lexique'))), avecDelai(F.getDocs(q('racines')))]);
    const vus = new Map();
    for (const d of [...a.docs, ...b.docs]) vus.set(d.id, { id: d.id, ...d.data() });
    const liste = [...vus.values()];
    zone.innerHTML = `<h2>Articles <small>qui étudient ou citent cette entrée</small></h2>
      ${liste.length ? `<div class="liste-fils">${liste.map((x) => `<a class="art-ligne" href="${adresse(x)}"><span class="vignette">${echapper((String(x.titre).match(/\p{L}/u) || ['?'])[0])}</span>
        <span class="art-centre"><span class="art-titre">${echapper(x.titre)}</span><span class="art-meta"><span class="famille f-${echapper(x.famille)}">${echapper(FAMILLES[x.famille] || '')}</span></span></span>
        <span class="art-droite">${dateCourte(x.publieLe)}</span></a>`).join('')}</div>` : '<p class="aide">Aucun article publié ne cite cette entrée.</p>'}
      ${session.niveau >= 2 ? `<p><button type="button" class="btn" data-contexte-entree="${echapper(cle)}" data-racine="${racine ? 1 : 0}">Ajouter au contexte d'un article…</button></p>` : ''}`;
  } catch { zone.innerHTML = ''; }
}

// ---------- Ajouter au contexte d'un article ----------
// ajout = { versets: ['19:26'], racines: ['صوم'], lexique: ['صوم'] }
export async function ajouterAuContexte(ajout) {
  ouvrirFenetre('<h2>Ajouter au contexte d\'un article</h2><p class="aide">Chargement de vos articles…</p>');
  let articles;
  try {
    const { db, F } = await firebase();
    const snap = await avecDelai(F.getDocsFromServer(F.query(F.collection(db, 'articles'), F.orderBy('modifieLe', 'desc'), F.limit(60))));
    articles = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => a.auteurUid === session.utilisateur.uid || session.niveau >= 3);
  } catch (e) { ouvrirFenetre(`<h2>Ajouter au contexte</h2><p class="erreur">${echapper(messageErreur(e))}</p>`); return; }
  const quoi = [
    ajout.versets?.length ? `${ajout.versets.length} verset${ajout.versets.length > 1 ? 's' : ''} (${ajout.versets.slice(0, 6).join(', ')}${ajout.versets.length > 6 ? '…' : ''})` : '',
    ajout.lexique?.length ? `l'entrée du lexique « ${ajout.lexique.join(', ')} »` : '',
    ajout.racines?.length ? `la racine ${ajout.racines.join(', ')}` : '',
  ].filter(Boolean).join(', ');
  ouvrirFenetre(`<h2>Ajouter au contexte d'un article</h2>
    <p>${echapper(quoi)} → </p>
    ${articles.length ? `<div class="liste-choix">${articles.map((a, i) => `<label class="choix"><input type="radio" name="cible" value="${a.id}" ${i === 0 ? 'checked' : ''}>
      <span>${echapper(a.titre || 'Sans titre')} <small class="aide">${a.statut === 'publie' ? 'publié' : a.statut === 'retire' ? 'retiré' : 'brouillon'} · ${dateCourte(a.modifieLe)}</small></span></label>`).join('')}</div>` : '<p class="aide">Aucun article à vous. Créez-en un dans l\'onglet Articles.</p>'}
    ${ajout.versets?.length ? '<label class="choix"><input type="checkbox" name="cite" checked> marquer les versets comme « cités »</label>' : ''}
    <p class="aide">Si l'article est ouvert dans l'éditeur, rechargez-le ensuite pour voir l'ajout.</p>
    <p class="form-msg" role="alert"></p>
    <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button>${articles.length ? '<button type="button" class="btn principal" data-ajout-ok>Ajouter</button>' : ''}</div>`);
  const f = document.querySelector('#fenetre');
  f.querySelector('[data-ajout-ok]')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const id = f.querySelector('[name=cible]:checked').value;
      const cite = f.querySelector('[name=cite]')?.checked ?? true;
      await ecrireContexte(articles.find((a) => a.id === id), ajout, cite);
      fermerFenetre();
      ouvrirFenetre(`<h2>Ajouté</h2><p>Le contexte de l'article est à jour.</p><div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button><a class="btn principal" href="#/article/${encodeURIComponent(id)}/modifier">Ouvrir l'éditeur</a></div>`);
    } catch (err) { f.querySelector('.form-msg').textContent = messageErreur(err); e.target.disabled = false; }
  });
}

async function ecrireContexte(a, ajout, cite) {
  const { db, F } = await firebase();
  const ref = F.doc(db, `articles/${a.id}/atelier/brouillon`);
  const snap = await avecDelai(F.getDocFromServer(ref));
  // Atelier absent (article importé) : repris du document public, comme dans l'éditeur.
  const t = snap.exists() ? snap.data() : {
    titre: a.titre, famille: a.famille, libelles: a.libelles || [], resume: a.resume || '', image: a.image ?? null, corps: a.corps || '',
    contexte: { versets: (a.versets || []).map((r) => ({ ref: r, cite: true, note: '' })), sources: (a.sources || []).map((s) => ({ ...s, publique: true })) },
  };
  const c = { ...(t.contexte || {}) };
  c.versets = [...(c.versets || [])];
  for (const r of ajout.versets || []) {
    const v = c.versets.find((x) => x.ref === r);
    if (v) { if (cite) v.cite = true; } else c.versets.push({ ref: r, cite, note: '' });
  }
  for (const champ of ['racines', 'lexique']) c[champ] = [...new Set([...(c[champ] || []), ...(ajout[champ] || [])])];
  await avecDelai(F.setDoc(ref, {
    titre: t.titre ?? '', famille: t.famille, libelles: t.libelles || [], resume: t.resume || '', image: t.image ?? null, corps: t.corps || '',
    contexte: c, majLe: F.serverTimestamp(), majPar: session.utilisateur.uid,
  }));
}

// ---------- Initialisation ----------
export function initArticlesLiens(contenu) {
  new MutationObserver(() => planifier(contenu)).observe(contenu, { childList: true, subtree: true });
  // Bouton dans la barre de sélection des versets (rédacteurs) : la sélection est gardée par selection.js.
  const droite = document.querySelector('#barre-copie .droite');
  droite?.insertAdjacentHTML('afterbegin', '<button type="button" class="btn" data-contexte-selection hidden>Ajouter au contexte…</button>');
  const maj = () => { const b = document.querySelector('[data-contexte-selection]'); if (b) b.hidden = !(session.utilisateur && session.niveau >= 2); };
  surChangement(maj); maj();
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-contexte-selection]')) {
      let versets = [];
      try { versets = JSON.parse(sessionStorage.getItem('selection') || '[]'); } catch { /* rien */ }
      if (versets.length) ajouterAuContexte({ versets });
    }
    const entree = e.target.closest('[data-contexte-entree]');
    if (entree) {
      const cle = entree.dataset.contexteEntree;
      const racine = entree.dataset.racine === '1';
      ajouterAuContexte(racine ? { racines: [cle], lexique: [cle] } : { lexique: [cle] });
    }
  });
}
