// Onglet « Témoignages » (sur le modèle de l'onglet Articles).
//   #/temoignages                  liste (plus récents d'abord, filtre sur les titres et extraits)
//   #/temoignage/<id>              lecture ; Modifier (auteur), Masquer / Démasquer (2+), Supprimer (3)
//   #/temoignages/nouveau          écrire un témoignage (niveau ≥ 1)
//   #/temoignage/<id>/modifier     modifier le sien (historique conservé)
// Case « Masquer mon nom (publier en Anonyme) » : le document public ne porte alors ni le nom ni le compte ;
// l'auteur réel est dans temoignages/<id>/prive/auteur (lu par lui seul et l'admin). Règles : firestore.rules.
import { firebase, avecDelai } from './firebase.js';
import { session, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, dateCourte, messageErreur } from './commentaires-format.js';
import { ajouterLimite } from './limite.js';
import { allerAuPassage } from './surligner.js';
import {
  LIMITES_TEMOIGNAGE, signature, identite, verifierTemoignage, texteEnParagraphes, extrait, surlignerDans,
} from './temoignages-outils.js';

const PAR_PAGE = 50;
const erreurHtml = (e) => `<p class="message erreur">${echapper(messageErreur(e))}</p>`;
const puceMasque = '<span class="etat retire">masqué</span>';
// Filtre de la liste, gardé pendant la visite (retour à la liste) et passé au témoignage ouvert (?q=) pour y être surligné.
let filtreListe = '';

export async function routeTemoignages(contenu) {
  const [chemin, qs] = location.hash.split('?');
  const q = new URLSearchParams(qs || '').get('q') || '';
  if (chemin === '#/temoignages') { document.title = 'Témoignages — Alfamous'; await vueListe(contenu); return true; }
  if (chemin === '#/temoignages/nouveau') { document.title = 'Témoigner — Alfamous'; await vueEditeur(contenu, null); return true; }
  let m = chemin.match(/^#\/temoignage\/([^/]+)\/modifier$/);
  if (m) { document.title = 'Modifier un témoignage — Alfamous'; await vueEditeur(contenu, decodeURIComponent(m[1])); return true; }
  m = chemin.match(/^#\/temoignage\/([^/]+)$/);
  if (m) { await vueLecture(contenu, decodeURIComponent(m[1]), q); return true; }
  return false;
}

// ---------- Liste ----------
async function vueListe(contenu) {
  contenu.innerHTML = '<p class="message">Chargement…</p>';
  let liste = []; let suite = null;
  const { db, F } = await firebase().catch((e) => { contenu.innerHTML = erreurHtml(e); throw e; });
  async function charger(apres) {
    const c = [F.orderBy('creeLe', 'desc')];
    if (apres) c.push(F.startAfter(apres));
    c.push(F.limit(PAR_PAGE));
    const snap = await avecDelai(F.getDocsFromServer(F.query(F.collection(db, 'temoignages'), ...c)));
    liste = liste.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    suite = snap.docs.length === PAR_PAGE ? snap.docs[snap.docs.length - 1] : null;
  }
  try { await charger(); } catch (e) { contenu.innerHTML = erreurHtml(e); return; }

  const ligne = (t) => `<a class="art-ligne" href="#/temoignage/${encodeURIComponent(t.id)}${filtreListe.trim() ? `?q=${encodeURIComponent(filtreListe.trim())}` : ''}">
      <span class="vignette">${echapper((String(t.titre || '').match(/\p{L}/u) || ['·'])[0])}</span>
      <span class="art-centre"><span class="art-titre" dir="auto">${echapper(t.masque ? 'Témoignage masqué par un modérateur' : t.titre || 'Sans titre')}</span>
        ${t.masque ? '' : `<span class="art-resume" dir="auto">${echapper(extrait(t.texte, 180, filtreListe.trim()))}</span>`}
        <span class="art-meta"><span>${echapper(signature(t))}</span>${t.masque ? puceMasque : ''}</span></span>
      <span class="art-droite">${dateCourte(t.creeLe)}</span>
    </a>`;
  const dessiner = () => {
    const f = filtreListe.trim().toLocaleLowerCase('fr');
    const vus = liste.filter((t) => !f || `${t.titre} ${t.texte} ${signature(t)}`.toLocaleLowerCase('fr').includes(f));
    contenu.innerHTML = `
      <div class="titre"><h1>Témoignages</h1><span class="resume">${liste.length}${suite ? '+' : ''} témoignage${liste.length > 1 ? 's' : ''} · les plus récents d'abord</span></div>
      <p class="aide">Des parcours personnels, racontés par celles et ceux qui les ont vécus. Chacun peut signer de son nom ou
        publier en Anonyme.</p>
      <div class="barre-outils">
        <input class="art-recherche" type="search" placeholder="Filtrer les témoignages affichés…" value="${echapper(filtreListe)}" aria-label="Filtrer">
        ${session.niveau >= 1 ? '<a class="btn principal" href="#/temoignages/nouveau">+ Témoigner</a>'
          : session.utilisateur ? '<span class="aide">Vérifiez votre courriel pour témoigner.</span>'
            : '<button class="lien-bouton" type="button" data-compte="connexion">Se connecter pour témoigner</button>'}
      </div>
      <div class="liste-fils">${vus.map(ligne).join('') || '<p class="vide">Aucun témoignage.</p>'}</div>
      ${suite ? '<button class="plus" type="button" data-plus>Témoignages plus anciens</button>' : ''}`;
    contenu.querySelectorAll('.art-ligne .art-centre').forEach((el) => surlignerDans(el, filtreListe));
    const champ = contenu.querySelector('.art-recherche');
    champ.addEventListener('input', () => { filtreListe = champ.value; const pos = champ.selectionStart; dessiner(); const c = contenu.querySelector('.art-recherche'); c.focus(); c.setSelectionRange(pos, pos); });
    contenu.querySelector('[data-plus]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await charger(suite); dessiner(); } catch (err) { e.target.textContent = messageErreur(err); }
    });
  };
  dessiner();
}

// ---------- Lecture ----------
async function lire(id) {
  const { db, F } = await firebase();
  const d = await avecDelai(F.getDocFromServer(F.doc(db, `temoignages/${id}`)));
  if (!d.exists()) return null;
  const t = { id: d.id, ...d.data() };
  // Auteur réel (prive/auteur) : lisible seulement par l'auteur lui-même et l'admin ; refus = ni l'un ni l'autre.
  t.auteurReel = null;
  if (session.utilisateur) {
    try {
      const p = await F.getDocFromServer(F.doc(db, `temoignages/${id}/prive/auteur`));
      if (p.exists()) t.auteurReel = p.data();
    } catch { /* pas l'auteur */ }
  }
  t.estAuteur = !!(session.utilisateur && session.niveau >= 1 && t.auteurReel?.auteurUid === session.utilisateur.uid);
  if (t.masque && session.niveau >= 2) {
    try { t.prive = (await F.getDocFromServer(F.doc(db, `temoignages/${id}/prive/texte`))).data(); } catch { /* rien */ }
  }
  return t;
}

async function vueLecture(contenu, id, q = '') {
  contenu.innerHTML = '<p class="message">Chargement…</p>';
  let t;
  try { t = await lire(id); } catch (e) { contenu.innerHTML = erreurHtml(e); return; }
  if (!t) { contenu.innerHTML = '<p class="message">Témoignage introuvable. <a href="#/temoignages">Tous les témoignages</a></p>'; return; }
  document.title = `${t.masque ? 'Témoignage masqué' : t.titre || 'Témoignage'} — Alfamous`;
  const n = session.niveau;
  const titre = t.masque ? (n >= 2 && t.prive ? t.prive.titre : 'Témoignage masqué par un modérateur') : t.titre;
  const texte = t.masque ? (n >= 2 && t.prive ? t.prive.texte : '') : t.texte;
  const actions = [];
  if (t.estAuteur && !t.masque) actions.push(`<a class="btn principal" href="#/temoignage/${encodeURIComponent(t.id)}/modifier">Modifier</a>`);
  if (t.nbVersions > 1 && (!t.masque || n >= 2)) actions.push(`<button class="btn" type="button" data-tem="historique">Historique (${t.nbVersions} versions)</button>`);
  if (n >= 2) actions.push(`<button class="btn" type="button" data-tem="${t.masque ? 'demasquer' : 'masquer'}">${t.masque ? 'Démasquer' : 'Masquer'}</button>`);
  if (n >= 3) actions.push('<button class="btn danger" type="button" data-tem="supprimer">Supprimer définitivement</button>');
  contenu.innerHTML = `<a class="retour" href="#/temoignages">← Témoignages</a>
    <article class="art-page">
      <div class="art-meta"><span>${echapper(signature(t))} · ${dateCourte(t.creeLe)}${t.modifieLe ? ` · modifié le ${dateCourte(t.modifieLe)}` : ''}</span>
        ${t.masque ? puceMasque : ''}</div>
      <h1 dir="auto">${echapper(titre || 'Sans titre')}</h1>
      ${t.masque ? `<p class="aide">Masqué par ${echapper(t.masque.parNom)} le ${dateCourte(t.masque.le)}${n >= 2 ? ' — texte visible des modérateurs seulement.' : '.'}</p>` : ''}
      ${t.estAuteur ? `<p class="aide">Votre témoignage${t.anonyme ? ' : publié en Anonyme, votre nom n\'apparaît nulle part sur la page.' : '.'}</p>` : ''}
      ${n >= 3 && t.anonyme && t.auteurReel ? `<p class="aide">Admin : auteur réel ${echapper(t.auteurReel.auteurNom || '—')}${t.auteurReel.auteurUid ? '' : ' (sans compte)'}.</p>` : ''}
      ${actions.length ? `<p class="actions-art">${actions.join(' ')}</p>` : ''}
      <div class="corps-art" dir="auto">${texteEnParagraphes(texte)}</div>
      <p class="form-msg" role="alert"></p>
    </article>`;
  // Terme venu du filtre de la liste : surligné dans le titre et le texte ; on descend jusqu'au premier passage
  // (après le retour en haut de page fait par le routeur).
  const premierTitre = surlignerDans(contenu.querySelector('.art-page h1'), q);
  const premierTexte = surlignerDans(contenu.querySelector('.corps-art'), q);
  if (!premierTitre) allerAuPassage(premierTexte);
  const msg = contenu.querySelector('.form-msg');
  contenu.querySelectorAll('[data-tem]').forEach((b) => b.addEventListener('click', async () => {
    msg.textContent = '';
    try { await agir(contenu, t, b.dataset.tem); } catch (e) { msg.textContent = messageErreur(e); }
  }));
}

async function agir(contenu, t, action) {
  const { db, F } = await firebase();
  const ref = F.doc(db, `temoignages/${t.id}`);
  if (action === 'historique') { await fenetreHistorique(t); return; }
  if (action === 'masquer') {
    const lot = F.writeBatch(db);
    lot.set(F.doc(db, `temoignages/${t.id}/prive/texte`), { titre: t.titre, texte: t.texte });
    lot.update(ref, { titre: '', texte: '', masque: { par: session.utilisateur.uid, parNom: session.nom, le: F.serverTimestamp() } });
    await avecDelai(lot.commit());
    await vueLecture(contenu, t.id);
    return;
  }
  if (action === 'demasquer') {
    const prive = t.prive || (await F.getDocFromServer(F.doc(db, `temoignages/${t.id}/prive/texte`))).data();
    const lot = F.writeBatch(db);
    lot.update(ref, { titre: prive.titre, texte: prive.texte, masque: null });
    lot.delete(F.doc(db, `temoignages/${t.id}/prive/texte`));
    await avecDelai(lot.commit());
    await vueLecture(contenu, t.id);
    return;
  }
  if (action === 'supprimer') {
    ouvrirFenetre(`<h2>Supprimer ce témoignage ?</h2><p>Le témoignage et son historique sont effacés définitivement.</p>
      <p class="form-msg" role="alert"></p>
      <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button>
      <button type="button" class="btn danger-plein" data-confirmer>Supprimer</button></div>`);
    const f = document.querySelector('#fenetre');
    f.querySelector('[data-confirmer]').addEventListener('click', async () => {
      try {
        const lot = F.writeBatch(db);
        for (const sous of ['versions', 'prive']) {
          (await F.getDocs(F.collection(db, `temoignages/${t.id}/${sous}`))).docs.forEach((d) => lot.delete(d.ref));
        }
        lot.delete(ref);
        await avecDelai(lot.commit());
        fermerFenetre();
        location.hash = '#/temoignages';
      } catch (e) { f.querySelector('.form-msg').textContent = messageErreur(e); }
    });
  }
}

async function fenetreHistorique(t) {
  ouvrirFenetre('<h2>Historique</h2><p class="aide">Chargement…</p>');
  let versions;
  try {
    const { db, F } = await firebase();
    const snap = await avecDelai(F.getDocsFromServer(F.collection(db, `temoignages/${t.id}/versions`)));
    versions = snap.docs.map((d) => ({ n: Number(d.id), ...d.data() })).sort((x, y) => y.n - x.n);
  } catch (e) { ouvrirFenetre(`<h2>Historique</h2>${erreurHtml(e)}`); return; }
  const montrer = (v) => {
    ouvrirFenetre(`<h2>Historique des versions</h2>
      <div class="versions"><div class="v-liste">${versions.map((x) => `<button type="button" class="${x.n === v.n ? 'actif' : ''}" data-v="${x.n}">Version ${x.n}<br><small>${dateCourte(x.le)}</small></button>`).join('')}</div>
      <div><h3 class="v-titre" dir="auto">${echapper(v.titre || 'Sans titre')}</h3><div class="corps-art apercu-version" dir="auto">${texteEnParagraphes(v.texte)}</div></div></div>
      <div class="fenetre-bas"><button class="btn" type="button" data-fermer>Fermer</button></div>`);
    const f = document.querySelector('#fenetre');
    f.classList.add('large');
    f.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => montrer(versions.find((x) => x.n === Number(b.dataset.v)))));
  };
  if (versions.length) montrer(versions[0]);
  else ouvrirFenetre('<h2>Historique</h2><p>Aucune version enregistrée.</p><div class="fenetre-bas"><button class="btn" data-fermer>Fermer</button></div>');
}

// ---------- Éditeur ----------
async function vueEditeur(contenu, id) {
  if (!session.utilisateur) {
    contenu.innerHTML = `<p class="message">Connectez-vous pour témoigner.<br>
      <button class="btn principal" data-compte="connexion">Se connecter</button>
      <button class="btn" data-compte="inscription">Créer un compte</button></p>`;
    return;
  }
  if (session.niveau < 1) {
    contenu.innerHTML = '<p class="message">Vérifiez votre courriel pour témoigner. <button type="button" class="lien-bouton" data-compte="verifier">Que faire ?</button></p>';
    return;
  }
  let t = { titre: '', texte: '', anonyme: false, nbVersions: 0 };
  if (id) {
    contenu.innerHTML = '<p class="message">Chargement…</p>';
    try { t = await lire(id); } catch (e) { contenu.innerHTML = erreurHtml(e); return; }
    if (!t) { contenu.innerHTML = '<p class="message">Témoignage introuvable. <a href="#/temoignages">Tous les témoignages</a></p>'; return; }
    if (!t.estAuteur || t.masque) { contenu.innerHTML = `<p class="message">Seul l'auteur modifie son témoignage${t.masque ? ' (et pas lorsqu\'il est masqué)' : ''}. <a href="#/temoignage/${encodeURIComponent(id)}">Retour</a></p>`; return; }
  }
  const L = LIMITES_TEMOIGNAGE;
  contenu.innerHTML = `<a class="retour" href="${id ? `#/temoignage/${encodeURIComponent(id)}` : '#/temoignages'}">← ${id ? 'Le témoignage' : 'Témoignages'}</a>
    <div class="titre"><h1>${id ? 'Modifier mon témoignage' : 'Témoigner'}</h1></div>
    <form class="editeur" id="editeur-tem">
      <label>Titre <input type="text" name="titre" maxlength="${L.titre}" required value="${echapper(t.titre)}" dir="auto"></label>
      <label>Votre témoignage <small>(${L.texteMin} à ${L.texteMax} caractères ; une ligne vide sépare les paragraphes)</small>
        <textarea name="texte" maxlength="${L.texteMax}" required dir="auto">${echapper(t.texte)}</textarea></label>
      <label class="case-anonyme"><input type="checkbox" name="anonyme"${t.anonyme ? ' checked' : ''}> Masquer mon nom (publier en Anonyme)</label>
      <p class="aide" data-signature></p>
      <div class="editeur-bas">
        <div class="gauche"><button class="btn principal" type="submit">${id ? 'Enregistrer' : 'Publier'}</button>
          <a class="btn" href="${id ? `#/temoignage/${encodeURIComponent(id)}` : '#/temoignages'}">Annuler</a></div>
      </div>
      <p class="form-msg" role="alert"></p>
    </form>`;
  const form = contenu.querySelector('#editeur-tem');
  const msg = form.querySelector('.form-msg');
  const sig = form.querySelector('[data-signature]');
  const majSignature = () => {
    sig.textContent = form.anonyme.checked
      ? 'Signé « Anonyme » : ni votre nom ni votre compte n\'apparaissent sur la page. Vous seul (et l\'administrateur) savez que ce témoignage est le vôtre ; vous pourrez le modifier.'
      : `Signé « ${session.nom} ». ${id ? '' : 'Publié tout de suite, lisible par tous. '}Vous pourrez le modifier ou cocher « Masquer mon nom » plus tard.`;
  };
  form.anonyme.addEventListener('change', majSignature);
  majSignature();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const d = { titre: form.titre.value.trim(), texte: form.texte.value.trim() };
    const err = verifierTemoignage(d);
    if (err) { msg.textContent = err; return; }
    const ident = identite(form.anonyme.checked, session.utilisateur.uid, session.nom);
    const bouton = form.querySelector('[type=submit]');
    bouton.disabled = true;
    try {
      const { db, F } = await firebase();
      const lot = F.writeBatch(db);
      if (!id) {
        const ref = F.doc(F.collection(db, 'temoignages'));
        lot.set(ref, { ...d, ...ident, creeLe: F.serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null });
        lot.set(F.doc(db, `temoignages/${ref.id}/prive/auteur`), { auteurUid: session.utilisateur.uid, auteurNom: session.nom });
        await ajouterLimite(lot, db, F, session);
        await avecDelai(lot.commit());
        location.hash = `#/temoignage/${ref.id}`;
        return;
      }
      if (d.titre === t.titre && d.texte === t.texte && ident.anonyme === !!t.anonyme && ident.auteurNom === t.auteurNom) {
        msg.textContent = 'Aucun changement.'; bouton.disabled = false; return;
      }
      lot.set(F.doc(db, `temoignages/${id}/versions/${t.nbVersions}`), { titre: t.titre, texte: t.texte, le: t.modifieLe ?? t.creeLe });
      lot.update(F.doc(db, `temoignages/${id}`), { ...d, ...ident, modifieLe: F.serverTimestamp(), nbVersions: t.nbVersions + 1 });
      await avecDelai(lot.commit());
      location.hash = `#/temoignage/${id}`;
    } catch (err2) { msg.textContent = messageErreur(err2); bouton.disabled = false; }
  });
}
