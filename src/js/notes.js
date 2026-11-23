// Mes Notes et forum (maquette validée le 23 nov. 2026 : docs/maquettes/notes-forum.html).
// Une note est privée (Mes Notes) ; « Publier » en fait un fil du forum, lisible par tous.
// Routes : #/notes, #/note/nouvelle[?type=verset&cle=112:1], #/note/<id>, #/forum[?cle=112:1], #/fil/<id>
// Modèle et règles : docs/MODELE-DONNEES.md, firestore.rules (collection notes).
import { firebase, avecDelai } from './firebase.js';
import { session, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, enrichir, dateCourte, initiale, messageErreur, TEXTE_MAX } from './commentaires-format.js';
import { ajouterLimite } from './limite.js';

const lienRequete = (q) => `#/q/${encodeURIComponent(q)}`;
const NOTE_MAX = 20000;
const TITRE_MAX = 140;
let filtreForum = 'tous';
let filtreNotes = 'toutes';
let filCourant = null; // { note, reponses } du fil affiché

// ---------- Outils ----------
// cliquable = false dans les listes : chaque ligne est déjà un lien (pas de lien dans un lien).
function puceLien(l, cliquable = true) {
  if (!l) return '<span class="lien-cible">libre</span>';
  const balise = (href, html) => (cliquable && href ? `<a class="lien-cible" href="${href}">${html}</a>` : `<span class="lien-cible">${html}</span>`);
  if (l.type === 'verset') return balise(lienRequete(l.cle), `verset ${echapper(l.cle)}`);
  if (l.type === 'racine') return balise(lienRequete(`r:${l.cle}`), `racine <span class="ar" lang="ar">${echapper(l.cle)}</span>`);
  return balise(`#/lexique/${encodeURIComponent(l.cle)}`, `lexique <span class="ar" lang="ar">${echapper(l.cle)}</span>`);
}
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const titreAffiche = (n) => (n.masque ? 'Fil masqué par un modérateur' : n.titre || 'Sans titre');
const erreurHtml = (e) => `<p class="message erreur">${echapper(messageErreur(e))}</p>`;

export function menuNotes() {
  const zone = document.querySelector('#menu');
  if (!zone) return;
  const h = location.hash;
  const actif = (re) => (re.test(h) ? ' actif' : '');
  zone.innerHTML = `<a href="#/" class="${/^#\/(notes|note|forum|fil|lexique)/.test(h) ? '' : 'actif'}">Lecture</a>
    <a href="#/lexique" class="${actif(/^#\/lexique/).trim()}">Lexique</a>
    ${session.utilisateur && session.niveau >= 1 ? `<a href="#/notes" class="${actif(/^#\/notes?(\/|$)/).trim()}">Mes Notes</a>` : ''}
    <a href="#/forum" class="${actif(/^#\/(forum|fil)/).trim()}">Forum</a>`;
}

// ---------- Routage ----------
export async function routeNotes(contenu) {
  const h = location.hash;
  const [chemin, qs] = h.split('?');
  const params = new URLSearchParams(qs || '');
  menuNotes();
  if (chemin === '#/notes') { document.title = 'Mes Notes — Alfamous'; await vueMesNotes(contenu); return true; }
  if (chemin === '#/forum') { document.title = 'Forum — Alfamous'; await vueForum(contenu, params.get('cle')); return true; }
  let m = chemin.match(/^#\/note\/(.+)$/);
  if (m) { document.title = 'Note — Alfamous'; await vueEditeur(contenu, decodeURIComponent(m[1]), params); return true; }
  m = chemin.match(/^#\/fil\/(.+)$/);
  if (m) { document.title = 'Forum — Alfamous'; await vueFil(contenu, decodeURIComponent(m[1])); return true; }
  return false;
}

// ---------- Mes Notes ----------
async function vueMesNotes(contenu) {
  if (!session.utilisateur || session.niveau < 1) {
    contenu.innerHTML = `<p class="message">Mes Notes est réservé aux membres connectés (courriel vérifié).<br>
      <button class="btn principal" data-compte="connexion">Se connecter</button></p>`;
    return;
  }
  contenu.innerHTML = '<p class="message">Chargement…</p>';
  try {
    const { db, F } = await firebase();
    const q = F.query(F.collection(db, 'notes'), F.where('auteurUid', '==', session.utilisateur.uid), F.orderBy('modifieLe', 'desc'));
    const notes = (await avecDelai(F.getDocsFromServer(q))).docs.map((d) => ({ id: d.id, ...d.data() }));
    const dessiner = () => {
      const liste = notes.filter((n) => filtreNotes === 'toutes' || (filtreNotes === 'publiees') === n.publie);
      contenu.innerHTML = `<div class="titre"><h1>Mes Notes</h1><span class="resume">${pluriel(notes.length, 'note')} · privées tant qu'elles ne sont pas publiées</span></div>
        <div class="barre-outils">
          <div class="filtres">${[['toutes', 'Toutes'], ['privees', 'Privées'], ['publiees', 'Publiées au forum']].map(([k, l]) => `<button data-filtre-notes="${k}" class="${filtreNotes === k ? 'actif' : ''}">${l}</button>`).join('')}</div>
          <a class="btn principal" href="#/note/nouvelle">+ Nouvelle note</a>
        </div>
        <div class="liste-fils">${liste.length ? liste.map((n) => `<a class="fil-ligne" href="#/note/${n.id}">
            <div><div class="fil-titre">${echapper(n.masque ? 'Fil masqué par un modérateur' : n.titre || 'Sans titre')}</div>
              <div class="fil-meta"><span class="etat ${n.publie ? 'publie' : 'prive'}">${n.publie ? 'publiée' : 'privée'}</span>${puceLien(n.lien, false)}
                <span class="extrait">${echapper(n.texte.slice(0, 90))}${n.texte.length > 90 ? '…' : ''}</span></div></div>
            <div class="fil-droite">modifiée le<b>${dateCourte(n.modifieLe)}</b>${n.publie ? pluriel(n.nbReponses, 'réponse') : ''}</div></a>`).join('')
          : '<p class="vide">Aucune note pour l\'instant.</p>'}</div>`;
      contenu.querySelectorAll('[data-filtre-notes]').forEach((b) => b.addEventListener('click', () => { filtreNotes = b.dataset.filtreNotes; dessiner(); }));
    };
    dessiner();
  } catch (e) { contenu.innerHTML = erreurHtml(e); }
}

// ---------- Éditeur de note ----------
async function vueEditeur(contenu, id, params) {
  if (!session.utilisateur || session.niveau < 1) { contenu.innerHTML = '<p class="message">Réservé aux membres connectés.</p>'; return; }
  let n;
  if (id === 'nouvelle') {
    const type = params.get('type');
    n = { id: null, titre: '', texte: '', lien: type ? { type, cle: params.get('cle') || '' } : null, publie: false, nbReponsesAutrui: 0 };
  } else {
    try {
      const { db, F } = await firebase();
      const snap = await avecDelai(F.getDocFromServer(F.doc(db, `notes/${id}`)));
      if (!snap.exists()) { contenu.innerHTML = '<p class="message">Note introuvable.</p>'; return; }
      n = { id, ...snap.data() };
      if (n.auteurUid !== session.utilisateur.uid) { location.hash = `#/fil/${id}`; return; }
      if (n.masque) { contenu.innerHTML = '<p class="message">Ce fil a été masqué par un modérateur : il ne peut plus être modifié.</p>'; return; }
    } catch (e) { contenu.innerHTML = erreurHtml(e); return; }
  }
  const l = n.lien || { type: 'aucun', cle: '' };
  const peutDepublier = n.publie && !n.nbReponsesAutrui;
  contenu.innerHTML = `<a class="retour" href="#/notes">← Mes Notes</a>
    <form class="editeur" id="editeur">
      <div class="fil-meta"><span class="etat ${n.publie ? 'publie' : 'prive'}">${n.publie ? 'publiée au forum' : 'privée'}</span>
        <span>${n.id ? `créée le ${dateCourte(n.creeLe)}` : 'nouvelle note'}</span>${n.publie ? `<a href="#/fil/${n.id}">voir le fil</a>` : ''}</div>
      <label>Titre ${n.publie ? '(obligatoire pour un fil)' : '(facultatif tant que la note est privée)'}
        <input type="text" name="titre" maxlength="${TITRE_MAX}" value="${echapper(n.titre)}" placeholder="Ex. : Le mot « aḥad » dans 112:1"></label>
      <label>Porte sur</label>
      <div class="ligne-lien">
        <select name="type">${[['aucun', 'Rien (note libre)'], ['verset', 'Un verset'], ['racine', 'Une racine'], ['lexique', 'Une entrée du lexique']]
          .map(([k, t]) => `<option value="${k}" ${l.type === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="text" name="cle" value="${echapper(l.cle)}" placeholder="112:1 · أحد · expression du lexique" ${l.type === 'aucun' ? 'disabled' : ''} dir="auto">
      </div>
      <label>Texte<textarea name="texte" maxlength="${NOTE_MAX}" required placeholder="Votre note… (renvois possibles : 2:255, r:أحد)">${echapper(n.texte)}</textarea></label>
      <div class="editeur-bas">
        <div class="gauche">
          ${!n.publie && n.id ? '<button type="button" class="btn" data-note="supprimer">Supprimer</button>' : ''}
          ${n.publie ? `<button type="button" class="btn" data-note="depublier" ${peutDepublier ? '' : 'disabled title="Impossible : le fil a des réponses d\'autres membres"'}>Dépublier</button>` : ''}
        </div>
        <div class="droite">
          <button type="submit" class="btn" data-note="enregistrer">Enregistrer</button>
          ${!n.publie ? '<button type="button" class="btn principal" data-note="publier">Publier au forum</button>' : ''}
        </div>
      </div>
      <p class="aide-pub">${n.publie
        ? (peutDepublier ? 'Dépublier : le fil redevient une note privée (possible tant qu\'aucun autre membre n\'y a répondu). Chaque modification est gardée dans l\'historique.'
          : 'Ce fil a des réponses d\'autres membres : vous pouvez le modifier (historique conservé), pas le dépublier ni le supprimer.')
        : `Publier : la note devient un fil du forum, lisible par tous et signé « ${echapper(session.nom)} ».`}</p>
      <p class="form-msg" role="alert"></p>
    </form>`;

  const form = contenu.querySelector('#editeur');
  const msg = form.querySelector('.form-msg');
  form.type.addEventListener('change', () => { form.cle.disabled = form.type.value === 'aucun'; if (!form.cle.disabled) form.cle.focus(); });
  const lire = () => {
    const type = form.type.value;
    const cle = form.cle.value.trim();
    return { titre: form.titre.value.trim(), texte: form.texte.value.trim(), lien: type === 'aucun' ? null : { type, cle } };
  };
  const verifier = (d, publier) => {
    if (!d.texte) return 'Le texte est vide.';
    if (publier && !d.titre) return 'Un titre est nécessaire pour publier au forum.';
    if (d.lien?.type === 'verset' && !/^\d{1,3}:\d{1,3}$/.test(d.lien.cle)) return 'Verset attendu sous la forme 112:1.';
    if (d.lien && !d.lien.cle) return 'Indiquez ce sur quoi porte la note, ou choisissez « Rien ».';
    return '';
  };

  async function agir(action) {
    msg.style.color = ''; msg.textContent = '';
    const d = lire();
    const { db, F } = await firebase();
    const ts = F.serverTimestamp();
    try {
      if (action === 'enregistrer' || action === 'publier') {
        const publier = action === 'publier' || n.publie;
        const err = verifier(d, publier);
        if (err) { msg.textContent = err; return; }
        if (!n.id) {
          const ref = F.doc(F.collection(db, 'notes'));
          const lot = F.writeBatch(db);
          lot.set(ref, {
            auteurUid: session.utilisateur.uid, auteurNom: session.nom, ...d, publie: publier,
            creeLe: ts, modifieLe: ts, activiteLe: ts, publieLe: publier ? ts : null,
            nbReponses: 0, nbReponsesAutrui: 0, nbVersions: 1, masque: null,
          });
          await ajouterLimite(lot, db, F, session);
          await avecDelai(lot.commit());
          location.hash = publier ? `#/fil/${ref.id}` : `#/note/${ref.id}`;
          return;
        }
        if (!n.publie && action === 'publier') {
          await avecDelai(F.updateDoc(F.doc(db, `notes/${n.id}`), { ...d, publie: true, publieLe: ts, activiteLe: ts, modifieLe: ts }));
          location.hash = `#/fil/${n.id}`;
          return;
        }
        if (!n.publie) {
          await avecDelai(F.updateDoc(F.doc(db, `notes/${n.id}`), { ...d, modifieLe: ts }));
        } else {
          if (d.titre === n.titre && d.texte === n.texte && JSON.stringify(d.lien) === JSON.stringify(n.lien)) { msg.textContent = 'Aucun changement.'; return; }
          const lot = F.writeBatch(db);
          lot.set(F.doc(db, `notes/${n.id}/versions/${n.nbVersions}`), { titre: n.titre, texte: n.texte, lien: n.lien, le: n.modifieLe });
          lot.update(F.doc(db, `notes/${n.id}`), { ...d, modifieLe: ts, nbVersions: n.nbVersions + 1 });
          await avecDelai(lot.commit());
        }
        await vueEditeur(contenu, n.id, params);
        const m2 = contenu.querySelector('.form-msg'); m2.style.color = 'var(--discret)'; m2.textContent = 'Enregistré.';
        return;
      }
      if (action === 'depublier') {
        await avecDelai(F.updateDoc(F.doc(db, `notes/${n.id}`), { publie: false, publieLe: null }));
        await vueEditeur(contenu, n.id, params);
        const m2 = contenu.querySelector('.form-msg'); m2.style.color = 'var(--discret)'; m2.textContent = 'Le fil est redevenu une note privée.';
        return;
      }
      if (action === 'supprimer') {
        ouvrirFenetre(`<h2>Supprimer cette note ?</h2><p>La note privée est effacée définitivement.</p>
          <p class="form-msg" role="alert"></p>
          <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button>
          <button type="button" class="btn danger-plein" data-note-confirmer="${n.id}">Supprimer</button></div>`);
      }
    } catch (e) { msg.textContent = messageErreur(e); }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); agir('enregistrer'); });
  form.querySelectorAll('[data-note]').forEach((b) => {
    if (b.type !== 'submit') b.addEventListener('click', () => agir(b.dataset.note));
  });
}

// Suppression d'une note et de tout ce qu'elle contient (réponses et historiques).
async function supprimerNote(id) {
  const { db, F } = await firebase();
  const lot = F.writeBatch(db);
  const reponses = await F.getDocs(F.collection(db, `notes/${id}/reponses`));
  for (const r of reponses.docs) {
    for (const sous of ['versions', 'prive', 'signalements']) {
      (await F.getDocs(F.collection(db, `notes/${id}/reponses/${r.id}/${sous}`)).catch(() => ({ docs: [] }))).docs.forEach((d) => lot.delete(d.ref));
    }
    lot.delete(r.ref);
  }
  for (const sous of ['versions', 'prive', 'signalements']) {
    (await F.getDocs(F.collection(db, `notes/${id}/${sous}`)).catch(() => ({ docs: [] }))).docs.forEach((d) => lot.delete(d.ref));
  }
  lot.delete(F.doc(db, `notes/${id}`));
  await avecDelai(lot.commit());
}

// ---------- Forum ----------
async function vueForum(contenu, cle) {
  contenu.innerHTML = '<p class="message">Chargement du forum…</p>';
  try {
    const { db, F } = await firebase();
    const q = F.query(F.collection(db, 'notes'), F.where('publie', '==', true), F.orderBy('activiteLe', 'desc'), F.limit(200));
    const fils = (await avecDelai(F.getDocsFromServer(q))).docs.map((d) => ({ id: d.id, ...d.data() }));
    const dessiner = () => {
      let liste = fils;
      if (cle) liste = liste.filter((n) => n.lien?.cle === cle);
      else if (filtreForum === 'verset') liste = liste.filter((n) => n.lien?.type === 'verset');
      else if (filtreForum === 'racine') liste = liste.filter((n) => n.lien && n.lien.type !== 'verset');
      else if (filtreForum === 'libre') liste = liste.filter((n) => !n.lien);
      contenu.innerHTML = `<div class="titre"><h1>Forum${cle ? ` · ${echapper(cle)}` : ''}</h1><span class="resume">${pluriel(liste.length, 'fil')} · par dernière activité</span></div>
        <div class="barre-outils">
          ${cle ? `<a href="#/forum">← Tous les fils</a>` : `<div class="filtres">${[['tous', 'Tous'], ['verset', 'Sur un verset'], ['racine', 'Racine ou lexique'], ['libre', 'Libres']]
            .map(([k, l]) => `<button data-filtre-forum="${k}" class="${filtreForum === k ? 'actif' : ''}">${l}</button>`).join('')}</div>`}
          ${session.niveau >= 1 ? `<a class="btn principal" href="#/note/nouvelle${cle && /^\d+:\d+$/.test(cle) ? `?type=verset&cle=${cle}` : ''}">+ Nouveau fil</a>`
            : '<button class="lien-bouton" data-compte="connexion">Se connecter pour publier ou répondre</button>'}
        </div>
        <div class="liste-fils">${liste.map((n) => `<a class="fil-ligne${n.masque ? ' masque' : ''}" href="#/fil/${n.id}">
            <div><div class="fil-titre">${echapper(titreAffiche(n))}</div>
              <div class="fil-meta"><span>${echapper(n.auteurNom)}</span>${puceLien(n.lien, false)}<span>publié le ${dateCourte(n.publieLe)}</span></div></div>
            <div class="fil-droite"><b>${n.nbReponses}</b>${n.nbReponses > 1 ? 'réponses' : 'réponse'}<br>activité ${dateCourte(n.activiteLe)}</div></a>`).join('')
          || '<p class="vide">Aucun fil pour l\'instant.</p>'}</div>`;
      contenu.querySelectorAll('[data-filtre-forum]').forEach((b) => b.addEventListener('click', () => { filtreForum = b.dataset.filtreForum; dessiner(); }));
    };
    dessiner();
  } catch (e) { contenu.innerHTML = erreurHtml(e); }
}

// ---------- Un fil ----------
async function chargerFil(id) {
  const { db, F } = await firebase();
  const snap = await avecDelai(F.getDocFromServer(F.doc(db, `notes/${id}`)));
  if (!snap.exists()) return null;
  const note = { id, ...snap.data() };
  const reps = await avecDelai(F.getDocsFromServer(F.query(F.collection(db, `notes/${id}/reponses`), F.orderBy('creeLe', 'asc'))));
  const reponses = reps.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (session.niveau >= 2) {
    const prive = async (chemin) => (await F.getDoc(F.doc(db, chemin)).catch(() => null))?.data();
    const compte = async (chemin) => (await F.getCountFromServer(F.collection(db, chemin)).catch(() => null))?.data().count || 0;
    if (note.masque) note.prive = await prive(`notes/${id}/prive/texte`);
    note.signalements = await compte(`notes/${id}/signalements`);
    await Promise.all(reponses.map(async (r) => {
      if (r.masque) r.prive = await prive(`notes/${id}/reponses/${r.id}/prive/texte`);
      r.signalements = await compte(`notes/${id}/reponses/${r.id}/signalements`);
    }));
  }
  return { note, reponses };
}

function blocMessage(m, { tete, note }) {
  const n = session.niveau;
  const mien = session.utilisateur && m.auteurUid === session.utilisateur.uid;
  const acts = [];
  if (m.nbVersions > 1 && (!m.masque || n >= 2)) acts.push(`<button data-fil-act="historique" data-cible="${tete ? 'note' : m.id}">Historique (${m.nbVersions} versions)</button>`);
  if (mien && !m.masque && n >= 1) acts.push(tete ? `<a href="#/note/${note.id}">Modifier</a>` : `<button data-fil-act="modifier" data-cible="${m.id}">Modifier</button>`);
  if (n === 1 && !mien && !m.masque) acts.push(`<button data-fil-act="signaler" data-cible="${tete ? 'note' : m.id}">Signaler</button>`);
  if (n >= 2) acts.push(`<button data-fil-act="${m.masque ? 'demasquer' : 'masquer'}" data-cible="${tete ? 'note' : m.id}">${m.masque ? 'Démasquer' : tete ? 'Masquer le fil' : 'Masquer'}</button>`);
  if (n >= 3) acts.push(`<button class="danger" data-fil-act="supprimer" data-cible="${tete ? 'note' : m.id}">${tete ? 'Supprimer le fil' : 'Supprimer définitivement'}</button>`);
  if (n >= 2 && m.signalements) acts.push(`<span class="signal">⚑ ${pluriel(m.signalements, 'signalement')}</span>`);
  let corps;
  if (m.masque && n < 2) corps = `<p class="com-texte placeholder">${tete ? 'Fil masqué par un modérateur.' : 'Message masqué par un modérateur.'}</p>`;
  else if (m.masque) corps = `<p class="com-texte barre">${enrichir(m.prive?.texte ?? '', lienRequete)}</p>
      <span class="bandeau-masque">Masqué par ${echapper(m.masque.parNom)} le ${dateCourte(m.masque.le)}</span>`;
  else corps = `<p class="com-texte">${enrichir(m.texte, lienRequete)}</p>`;
  return `<div class="message-fil${m.masque ? ' masque' : ''}" data-msg="${tete ? 'note' : m.id}">
    <div class="avatar" aria-hidden="true">${echapper(initiale(m.auteurNom))}</div>
    <div class="com-corps"><div class="com-meta"><span class="auteur">${echapper(m.auteurNom)}</span>${mien ? '<span class="toi">vous</span>' : ''}
      <span>${dateCourte(tete ? m.publieLe : m.creeLe)}</span>${m.nbVersions > 1 ? '<span>· modifié</span>' : ''}</div>
      ${corps}${acts.length ? `<div class="com-actions">${acts.join('')}</div>` : ''}</div></div>`;
}

async function vueFil(contenu, id) {
  contenu.innerHTML = '<p class="message">Chargement du fil…</p>';
  let donnees;
  try { donnees = await chargerFil(id); } catch (e) {
    contenu.innerHTML = e?.code === 'permission-denied' ? '<p class="message">Fil introuvable (supprimé, ou redevenu une note privée).</p>' : erreurHtml(e);
    return;
  }
  if (!donnees) { contenu.innerHTML = '<p class="message">Fil introuvable (supprimé, ou redevenu une note privée).</p>'; return; }
  filCourant = donnees;
  const { note, reponses } = donnees;
  let cite = '';
  if (note.lien?.type === 'verset' && !note.masque) {
    try {
      const { texte } = await import('./donnees.js');
      const [s, v] = note.lien.cle.split(':').map(Number);
      const x = (await texte(s)).versets.find((y) => y.v === v);
      if (x) cite = `<div class="verset-cite"><a href="${lienRequete(note.lien.cle)}">${note.lien.cle}</a><p class="ar" lang="ar">${echapper(x.ar)}</p></div>`;
    } catch { /* citation facultative */ }
  }
  const titre = note.masque && session.niveau >= 2 ? `${note.prive?.titre ?? ''} (masqué)` : titreAffiche(note);
  document.title = `${titre} — Forum Alfamous`;
  const peutRepondre = note.publie && !note.masque;
  contenu.innerHTML = `<a class="retour" href="#/forum">← Forum</a>
    <div class="fil-tete">
      <div class="fil-meta">${puceLien(note.lien)}${!note.publie ? '<span class="etat prive">note privée</span>' : ''}</div>
      <h1>${echapper(titre)}</h1>${cite}
      ${blocMessage(note, { tete: true, note })}
    </div>
    <div class="reponses">
      <h2>Réponses · ${reponses.length} ${reponses.length > 1 ? '<span class="aide">— de la plus ancienne à la plus récente</span>' : ''}</h2>
      ${reponses.map((r) => blocMessage(r, { tete: false, note })).join('') || '<p class="aide">Aucune réponse pour l\'instant.</p>'}
      ${!peutRepondre ? ''
        : session.niveau >= 1
          ? `<form class="ecrire" id="repondre"><textarea name="texte" maxlength="${TEXTE_MAX}" required placeholder="Votre réponse… (renvois possibles : 2:255, r:أحد)"></textarea>
              <div class="ecrire-bas"><span>Publiée tout de suite, signée « ${echapper(session.nom)} ». Vous pourrez la modifier, pas la supprimer.</span>
              <button class="btn principal">Répondre</button></div><p class="form-msg" role="alert"></p></form>`
          : `<div class="ecrire connexion">Pour répondre, connectez-vous avec un compte au courriel vérifié.<br>
              <button type="button" class="btn principal" data-compte="connexion">Se connecter</button>
              <button type="button" class="btn" data-compte="inscription">Créer un compte</button></div>`}
    </div>`;
  contenu.querySelector('#repondre')?.addEventListener('submit', (e) => { e.preventDefault(); repondre(contenu, e.target); });
}

async function repondre(contenu, form) {
  const texte = form.texte.value.trim();
  const msg = form.querySelector('.form-msg');
  if (!texte) return;
  const bouton = form.querySelector('.principal');
  bouton.disabled = true; msg.textContent = '';
  const { db, F } = await firebase();
  const id = filCourant.note.id;
  // Numéro de réponse = nbReponses + 1 (vérifié par les règles) ; un essai de plus si deux membres répondent en même temps.
  for (let essai = 0; essai < 2; essai++) {
    try {
      const note = (await F.getDocFromServer(F.doc(db, `notes/${id}`))).data();
      const lot = F.writeBatch(db);
      lot.set(F.doc(db, `notes/${id}/reponses/${note.nbReponses + 1}`), {
        auteurUid: session.utilisateur.uid, auteurNom: session.nom, texte,
        creeLe: F.serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null,
      });
      lot.update(F.doc(db, `notes/${id}`), {
        nbReponses: F.increment(1), nbReponsesAutrui: F.increment(note.auteurUid === session.utilisateur.uid ? 0 : 1), activiteLe: F.serverTimestamp(),
      });
      await ajouterLimite(lot, db, F, session);
      await avecDelai(lot.commit());
      await vueFil(contenu, id);
      return;
    } catch (e) {
      if (essai === 1 || e?.code !== 'permission-denied') { msg.textContent = messageErreur(e); bouton.disabled = false; return; }
    }
  }
}

// ---------- Actions dans un fil ----------
function chemins(cible) {
  const id = filCourant.note.id;
  const base = cible === 'note' ? `notes/${id}` : `notes/${id}/reponses/${cible}`;
  const m = cible === 'note' ? filCourant.note : filCourant.reponses.find((r) => r.id === cible);
  return { base, m };
}

async function actionFil(contenu, b) {
  const { db, F } = await firebase();
  const { base, m } = chemins(b.dataset.cible);
  const tete = b.dataset.cible === 'note';
  const ts = F.serverTimestamp();
  const signature = { par: session.utilisateur.uid, parNom: session.nom, le: ts };
  switch (b.dataset.filAct) {
    case 'historique': {
      const snap = await avecDelai(F.getDocs(F.collection(db, `${base}/versions`)));
      const anciennes = snap.docs.map((d) => ({ n: Number(d.id), ...d.data() })).sort((a, c) => c.n - a.n);
      const actuelle = { n: m.nbVersions, titre: m.masque ? m.prive?.titre : m.titre, texte: m.masque ? m.prive?.texte ?? '' : m.texte, le: tete ? m.modifieLe : m.modifieLe ?? m.creeLe };
      ouvrirFenetre(`<h2>Historique</h2>${[actuelle, ...anciennes].map((v, i) => `<div class="version${i === 0 ? ' actuelle' : ''}">
        <small>Version ${v.n} · ${dateCourte(v.le)}${i === 0 ? ' · affichée' : ''}</small>${v.titre !== undefined && tete ? `<b>${echapper(v.titre)}</b><br>` : ''}${enrichir(v.texte, lienRequete)}</div>`).join('')}
        <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button></div>`);
      return;
    }
    case 'modifier': {
      const corps = contenu.querySelector(`[data-msg="${m.id}"] .com-corps`);
      corps.querySelector('.com-texte').outerHTML = `<form class="ecrire" data-edition-rep="${m.id}"><textarea name="texte" maxlength="${TEXTE_MAX}" required>${echapper(m.texte)}</textarea>
        <div class="ecrire-bas"><span>L'ancienne version reste dans l'historique.</span>
        <span><button type="button" class="btn" data-annuler>Annuler</button> <button class="btn principal">Enregistrer</button></span></div><p class="form-msg" role="alert"></p></form>`;
      corps.querySelector('.com-actions')?.remove();
      const f = corps.querySelector('form');
      f.querySelector('[data-annuler]').addEventListener('click', () => vueFil(contenu, filCourant.note.id));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texte = f.texte.value.trim();
        if (!texte || texte === m.texte) return vueFil(contenu, filCourant.note.id);
        try {
          const lot = F.writeBatch(db);
          lot.set(F.doc(db, `${base}/versions/${m.nbVersions}`), { texte: m.texte, le: m.modifieLe ?? m.creeLe });
          lot.update(F.doc(db, base), { texte, modifieLe: ts, nbVersions: m.nbVersions + 1 });
          await avecDelai(lot.commit());
          vueFil(contenu, filCourant.note.id);
        } catch (err) { f.querySelector('.form-msg').textContent = messageErreur(err); }
      });
      f.texte.focus();
      return;
    }
    case 'signaler':
      ouvrirFenetre(`<h2>Signaler ${tete ? 'ce fil' : 'ce message'}</h2>
        <p>Le signalement va aux modérateurs, qui décident de le masquer ou non. L'auteur n'est pas prévenu.</p>
        <form data-signal-fil="${b.dataset.cible}"><label>Motif (facultatif)<textarea name="motif" maxlength="500" rows="3"></textarea></label>
        <p class="form-msg" role="alert"></p>
        <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button class="btn principal">Signaler</button></div></form>`);
      return;
    case 'masquer': {
      const lot = F.writeBatch(db);
      if (tete) {
        lot.set(F.doc(db, `${base}/prive/texte`), { titre: m.titre, texte: m.texte });
        lot.update(F.doc(db, base), { titre: '', texte: '', masque: signature });
      } else {
        lot.set(F.doc(db, `${base}/prive/texte`), { texte: m.texte });
        lot.update(F.doc(db, base), { texte: '', masque: signature });
      }
      await avecDelai(lot.commit());
      return vueFil(contenu, filCourant.note.id);
    }
    case 'demasquer': {
      const lot = F.writeBatch(db);
      lot.delete(F.doc(db, `${base}/prive/texte`));
      lot.update(F.doc(db, base), tete ? { titre: m.prive?.titre ?? '', texte: m.prive?.texte ?? '', masque: null } : { texte: m.prive?.texte ?? '', masque: null });
      await avecDelai(lot.commit());
      return vueFil(contenu, filCourant.note.id);
    }
    case 'supprimer':
      ouvrirFenetre(`<h2>Supprimer définitivement ?</h2>
        <p>${tete ? 'Le fil, toutes ses réponses et leurs historiques seront effacés.' : `Le message de <b>${echapper(m.auteurNom)}</b> et son historique seront effacés.`} Cette action ne peut pas être annulée.</p>
        <p class="aide">Pour le retirer de façon réversible, utilisez plutôt « Masquer ».</p><p class="form-msg" role="alert"></p>
        <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button>
        <button type="button" class="btn danger-plein" data-suppr-fil="${b.dataset.cible}">Supprimer</button></div>`);
  }
}

async function supprimerReponse(id, rid) {
  const { db, F } = await firebase();
  const lot = F.writeBatch(db);
  for (const sous of ['versions', 'prive', 'signalements']) {
    (await F.getDocs(F.collection(db, `notes/${id}/reponses/${rid}/${sous}`))).docs.forEach((d) => lot.delete(d.ref));
  }
  lot.delete(F.doc(db, `notes/${id}/reponses/${rid}`));
  await avecDelai(lot.commit());
}

// ---------- Sous le verset : fils du forum et notes de l'utilisateur ----------
export async function ligneForum(zone, cle, type = 'verset') {
  if (!zone) return;
  if (type === 'verset' && !/^\d{1,3}:\d{1,3}$/.test(cle)) return;
  const quoi = type === 'verset' ? cle : `« ${echapper(cle)} »`;
  const surQuoi = type === 'verset' ? 'ce verset' : 'cette entrée';
  try {
    const { db, F } = await firebase();
    const col = F.collection(db, 'notes');
    const nbFils = (await avecDelai(F.getCountFromServer(F.query(col, F.where('publie', '==', true), F.where('lien.type', '==', type), F.where('lien.cle', '==', cle))))).data().count;
    let nbMiennes = 0;
    if (session.utilisateur && session.niveau >= 1) {
      nbMiennes = (await F.getCountFromServer(F.query(col, F.where('auteurUid', '==', session.utilisateur.uid), F.where('publie', '==', false), F.where('lien.cle', '==', cle))).catch(() => null))?.data().count || 0;
    }
    zone.innerHTML = `<span>Forum : ${nbFils ? `<a href="#/forum?cle=${encodeURIComponent(cle)}">${pluriel(nbFils, 'fil')} sur ${quoi}</a>` : `aucun fil sur ${quoi}`}</span>
      ${session.niveau >= 1 ? `<a href="#/note/nouvelle?type=${type}&cle=${encodeURIComponent(cle)}">+ Ouvrir une discussion sur ${quoi}</a>` : ''}
      ${nbMiennes ? `<a class="mes-notes-verset" href="#/notes">Mes notes sur ${surQuoi} : ${nbMiennes}</a>` : ''}`;
  } catch { zone.innerHTML = ''; }
}

// ---------- Événements globaux ----------
export function initNotes(contenu) {
  document.addEventListener('click', async (e) => {
    const conf = e.target.closest('[data-note-confirmer]');
    if (conf) {
      conf.disabled = true;
      try { await supprimerNote(conf.dataset.noteConfirmer); fermerFenetre(); location.hash = '#/notes'; }
      catch (err) { conf.closest('dialog').querySelector('.form-msg').textContent = messageErreur(err); conf.disabled = false; }
      return;
    }
    const suppr = e.target.closest('[data-suppr-fil]');
    if (suppr) {
      suppr.disabled = true;
      try {
        if (suppr.dataset.supprFil === 'note') { await supprimerNote(filCourant.note.id); fermerFenetre(); location.hash = '#/forum'; }
        else { await supprimerReponse(filCourant.note.id, suppr.dataset.supprFil); fermerFenetre(); vueFil(contenu, filCourant.note.id); }
      } catch (err) { suppr.closest('dialog').querySelector('.form-msg').textContent = messageErreur(err); suppr.disabled = false; }
      return;
    }
    const b = e.target.closest('[data-fil-act]');
    if (b && filCourant) {
      b.disabled = true;
      try { await actionFil(contenu, b); } catch (err) {
        ouvrirFenetre(`<h2>Action impossible</h2><p>${echapper(messageErreur(err))}</p><div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button></div>`);
      } finally { b.disabled = false; }
    }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-signal-fil]');
    if (!f) return;
    e.preventDefault();
    const { db, F } = await firebase();
    const { base } = chemins(f.dataset.signalFil);
    try {
      const lot = F.writeBatch(db);
      lot.set(F.doc(db, `${base}/signalements/${session.utilisateur.uid}`), { motif: f.motif.value.trim(), le: F.serverTimestamp() });
      await ajouterLimite(lot, db, F, session);
      await avecDelai(lot.commit());
      ouvrirFenetre('<h2>Merci</h2><p>Le signalement a été transmis aux modérateurs.</p><div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button></div>');
    } catch (err) {
      f.querySelector('.form-msg').textContent = err?.code === 'permission-denied' ? 'Vous avez déjà signalé ce message.' : messageErreur(err);
    }
  });
}

