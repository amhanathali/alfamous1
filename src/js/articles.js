// Onglet « Articles » (docs/ARTICLES.md ; maquette acceptée : docs/maquettes/articles.html).
//   #/articles                 liste (filtres famille et libellé, recherche, plus récents d'abord)
//   #/article/<adresse ou id>  lecture : texte assaini, versets cités, sources, commentaires, forum
//   #/articles/nouveau         éditeur d'un nouvel article (niveau ≥ 2)
//   #/article/<id>/modifier    éditeur : brouillon privé, versions, publication, retrait
// Modèle et règles : docs/MODELE-DONNEES.md, firestore.rules, storage.rules.
import { firebase, avecDelai, stockage } from './firebase.js';
import { session, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, dateCourte, messageErreur } from './commentaires-format.js';
import { afficherCommentaires } from './commentaires.js';
import * as D from './donnees.js';
import {
  FAMILLES, LIMITES, slugifier, slugValide, nettoyerLibelles, champsCites,
} from './articles-outils.js';
import { assainisseur, texteBrut } from './articles-assainir.js';
import { versDocx, markdownVersHtml, texteVersHtml } from './articles-import.js';

const PAR_PAGE = 30;
const LIBELLES_CONNUS = ['Les mots du Coran', 'Développement personnel', 'Société', 'Politique', 'Divers', 'Conférences',
  'Livres', 'Outils', 'Sciences & Philosophie'];
const lienRequete = (q) => `#/q/${encodeURIComponent(q)}`;
const redacteur = () => session.utilisateur && session.niveau >= 2;
const proprio = (a) => redacteur() && (a.auteurUid === session.utilisateur.uid || session.niveau >= 3);
const erreurHtml = (e) => `<p class="message erreur">${echapper(messageErreur(e))}</p>`;
const puceFamille = (f) => `<span class="famille f-${echapper(f)}">${echapper(FAMILLES[f] || f)}</span>`;
const puceEtat = (a) => (a.statut === 'brouillon' ? '<span class="etat brouillon">brouillon</span>'
  : a.statut === 'retire' ? '<span class="etat retire">retiré</span>' : '');
const adresse = (a) => `#/article/${encodeURIComponent(a.statut === 'publie' && a.slug ? a.slug : a.id)}`;

// ---------- Routage ----------
export async function routeArticles(contenu) {
  const [chemin, qs] = location.hash.split('?');
  const params = new URLSearchParams(qs || '');
  if (chemin === '#/articles') { document.title = 'Articles — Alfamous'; await vueListe(contenu, params); return true; }
  if (chemin === '#/articles/nouveau') { document.title = 'Nouvel article — Alfamous'; await vueEditeur(contenu, null); return true; }
  let m = chemin.match(/^#\/article\/([^/]+)\/modifier$/);
  if (m) { document.title = 'Modifier un article — Alfamous'; await vueEditeur(contenu, decodeURIComponent(m[1])); return true; }
  m = chemin.match(/^#\/article\/([^/]+)$/);
  if (m) { await vueLecture(contenu, decodeURIComponent(m[1])); return true; }
  return false;
}

// ---------- Liste ----------
async function vueListe(contenu, params) {
  const famille = FAMILLES[params.get('famille')] ? params.get('famille') : '';
  const libelle = params.get('libelle') || '';
  contenu.innerHTML = '<p class="message">Chargement…</p>';
  let publies = []; let suite = null; let travail = [];
  const { db, F } = await firebase().catch((e) => { contenu.innerHTML = erreurHtml(e); throw e; });
  const requete = (apres) => {
    const c = [F.where('statut', '==', 'publie')];
    if (famille) c.push(F.where('famille', '==', famille));
    if (libelle) c.push(F.where('libelles', 'array-contains', libelle));
    c.push(F.orderBy('publieLe', 'desc'));
    if (apres) c.push(F.startAfter(apres));
    c.push(F.limit(PAR_PAGE));
    return F.query(F.collection(db, 'articles'), ...c);
  };
  async function charger(apres) {
    const snap = await avecDelai(F.getDocsFromServer(requete(apres)));
    publies = publies.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    suite = snap.docs.length === PAR_PAGE ? snap.docs[snap.docs.length - 1] : null;
  }
  try {
    await charger();
    if (redacteur()) {
      const q = F.query(F.collection(db, 'articles'), F.where('statut', 'in', ['brouillon', 'retire']), F.orderBy('modifieLe', 'desc'));
      travail = (await avecDelai(F.getDocsFromServer(q))).docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (e) { contenu.innerHTML = erreurHtml(e); return; }

  let filtre = '';
  const lienFiltre = (f, l) => {
    const p = new URLSearchParams();
    if (f) p.set('famille', f);
    if (l) p.set('libelle', l);
    return `#/articles${p.toString() ? `?${p}` : ''}`;
  };
  const ligne = (a) => {
    const image = a.image && /^https?:/.test(a.image) ? `<img src="${echapper(a.image)}" alt="" loading="lazy">` : '';
    return `<a class="art-ligne" href="${adresse(a)}">
      <span class="vignette">${image || echapper((a.titre || '?').trim()[0] || '?')}</span>
      <span class="art-centre"><span class="art-titre">${echapper(a.titre || 'Sans titre')}</span>
        ${a.resume ? `<span class="art-resume">${echapper(a.resume)}</span>` : ''}
        <span class="art-meta">${puceFamille(a.famille)}${(a.libelles || []).map((l) => `<span class="libelle">${echapper(l)}</span>`).join('')}${puceEtat(a)}</span></span>
      <span class="art-droite">${a.statut === 'publie' ? dateCourte(a.publieLe) : `modifié le ${dateCourte(a.modifieLe)}`}</span>
    </a>`;
  };
  const dessiner = () => {
    const f = filtre.toLocaleLowerCase('fr');
    const garde = (a) => !f || `${a.titre} ${a.resume}`.toLocaleLowerCase('fr').includes(f);
    const vus = publies.filter(garde);
    const libs = [...new Set([...LIBELLES_CONNUS, ...publies.flatMap((a) => a.libelles || [])])];
    contenu.innerHTML = `
      <div class="titre"><h1>Articles</h1><span class="resume">${famille ? echapper(FAMILLES[famille]) : 'toutes les familles'}${libelle ? ` · « ${echapper(libelle)} »` : ''} · les plus récents d'abord</span></div>
      <div class="barre-outils">
        <div class="filtres">${[['', 'Toutes'], ...Object.entries(FAMILLES)].map(([k, t]) => `<a class="filtre${famille === k ? ' actif' : ''}" href="${lienFiltre(k, libelle)}">${echapper(t)}</a>`).join('')}</div>
        ${redacteur() ? '<a class="btn principal" href="#/articles/nouveau">+ Nouvel article</a>' : ''}
      </div>
      <div class="barre-outils"><input class="art-recherche" type="search" placeholder="Filtrer les titres et résumés affichés…" value="${echapper(filtre)}" aria-label="Filtrer"></div>
      <div class="libelles-filtre">Libellés : ${libs.map((l) => `<a class="${libelle === l ? 'actif' : ''}" href="${lienFiltre(famille, libelle === l ? '' : l)}">${echapper(l)}</a>`).join('')}</div>
      ${travail.length ? `<details class="bloc travail" open><summary>Brouillons et articles retirés · ${travail.length} <small>(rédacteurs seulement)</small></summary>
        <div class="liste-fils">${travail.filter(garde).map(ligne).join('') || '<p class="vide">Aucun.</p>'}</div></details>` : ''}
      <div class="liste-fils">${vus.map(ligne).join('') || '<p class="vide">Aucun article.</p>'}</div>
      ${suite ? '<button class="plus" type="button" data-plus>Articles plus anciens</button>' : ''}`;
    const champ = contenu.querySelector('.art-recherche');
    champ.addEventListener('input', () => { filtre = champ.value; const pos = champ.selectionStart; dessiner(); const c = contenu.querySelector('.art-recherche'); c.focus(); c.setSelectionRange(pos, pos); });
    contenu.querySelector('[data-plus]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await charger(suite); dessiner(); } catch (err) { e.target.textContent = messageErreur(err); }
    });
  };
  dessiner();
}

// ---------- Lecture ----------
async function trouverArticle(cle) {
  const { db, F } = await firebase();
  if (slugValide(cle)) {
    const q = F.query(F.collection(db, 'articles'), F.where('slug', '==', cle), F.where('statut', '==', 'publie'), F.limit(1));
    const snap = await avecDelai(F.getDocsFromServer(q));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  try {
    const d = await avecDelai(F.getDocFromServer(F.doc(db, `articles/${cle}`)));
    return d.exists() ? { id: d.id, ...d.data() } : null;
  } catch (e) { if (e.code === 'permission-denied') return null; throw e; }
}

async function vueLecture(contenu, cle) {
  contenu.innerHTML = '<p class="message">Chargement…</p>';
  let a; let assainir;
  try { [a, assainir] = await Promise.all([trouverArticle(cle), assainisseur()]); } catch (e) { contenu.innerHTML = erreurHtml(e); return; }
  if (!a) { contenu.innerHTML = '<p class="message">Article introuvable. <a href="#/articles">Tous les articles</a></p>'; return; }
  document.title = `${a.titre || 'Article'} — Alfamous`;
  const sources = (a.sources || []).filter((s) => s && (s.titre || s.url));
  contenu.innerHTML = `<a class="retour" href="#/articles">← Articles</a>
    <article class="art-page">
      <div class="art-meta">${puceFamille(a.famille)}${(a.libelles || []).map((l) => `<a class="libelle" href="#/articles?libelle=${encodeURIComponent(l)}">${echapper(l)}</a>`).join('')}
        <span>${echapper(a.auteurNom)}${a.publieLe ? ` · publié le ${dateCourte(a.publieLe)}` : ''}${a.republieLe ? ` · mis à jour le ${dateCourte(a.republieLe)}` : ''}</span>${puceEtat(a)}</div>
      <h1>${echapper(a.titre || 'Sans titre')}</h1>
      ${a.resume ? `<p class="chapeau">${echapper(a.resume)}</p>` : ''}
      ${redacteur() ? `<p class="actions-art">${proprio(a) ? `<a class="btn principal" href="#/article/${encodeURIComponent(a.id)}/modifier">Modifier</a>` : '<span class="aide">Article d\'un autre rédacteur : lecture seule.</span>'}
        ${a.nbVersions ? `<button class="btn" type="button" data-historique>Historique (${a.nbVersions} version${a.nbVersions > 1 ? 's' : ''})</button>` : ''}</p>` : ''}
      ${a.image && /^https?:/.test(a.image) ? `<img class="couverture" src="${echapper(a.image)}" alt="">` : ''}
      <div class="corps-art">${a.statut === 'brouillon' ? '<p class="aide">Brouillon jamais publié : le texte de travail est dans l\'éditeur.</p>' : assainir(a.corps)}</div>
      ${(a.versets || []).length ? `<div class="pied-art"><span>Versets cités :</span>${a.versets.map((r) => `<a class="lien-cible" href="${lienRequete(r)}">${echapper(r)}</a>`).join('')}</div>` : ''}
      ${sources.length ? `<div class="pied-art sources-art"><b>Sources</b><ul>${sources.map((s) => `<li>${s.url && /^https?:/.test(s.url) ? `<a href="${echapper(s.url)}" target="_blank" rel="noopener noreferrer">${echapper(s.titre || s.url)}</a>` : echapper(s.titre)}${s.note ? ` — ${echapper(s.note)}` : ''}</li>`).join('')}</ul></div>` : ''}
    </article>
    ${a.statut === 'publie' ? `<div class="bloc article-coms"><section class="commentaires" data-com-type="article" data-com-cle="${echapper(a.id)}"><p class="aide">Chargement…</p></section></div>` : ''}`;
  lierVersets(contenu.querySelector('.corps-art'));
  if (a.statut === 'publie') afficherCommentaires(contenu.querySelector('.commentaires'));
  contenu.querySelector('[data-historique]')?.addEventListener('click', () => fenetreHistorique(a, null));
}

// Blocs de versets insérés par l'éditeur (data-ref) : la référence ouvre la lecture du verset.
function lierVersets(racine) {
  racine?.querySelectorAll('.verset-bloc[data-ref]').forEach((b) => {
    const ref = b.dataset.ref;
    if (/^\d{1,3}:\d{1,3}$/.test(ref) && !b.querySelector('.refv')) b.insertAdjacentHTML('afterbegin', `<a class="refv" href="${lienRequete(ref)}">${ref}</a>`);
  });
}

// ---------- Historique des versions ----------
async function fenetreHistorique(a, surRestaurer) {
  ouvrirFenetre('<h2>Historique des versions</h2><p class="aide">Chargement…</p>');
  let versions; let assainir;
  try {
    const { db, F } = await firebase();
    const snap = await avecDelai(F.getDocsFromServer(F.collection(db, `articles/${a.id}/versions`)));
    versions = snap.docs.map((d) => ({ n: Number(d.id), ...d.data() })).sort((x, y) => y.n - x.n);
    assainir = await assainisseur();
  } catch (e) { ouvrirFenetre(`<h2>Historique</h2>${erreurHtml(e)}`); return; }
  if (!versions.length) { ouvrirFenetre('<h2>Historique</h2><p>Aucune version enregistrée.</p><div class="fenetre-bas"><button class="btn" data-fermer>Fermer</button></div>'); return; }
  const montrer = (v) => {
    ouvrirFenetre(`<h2>Historique des versions</h2>
      <div class="versions"><div class="v-liste">${versions.map((x) => `<button type="button" class="${x.n === v.n ? 'actif' : ''}" data-v="${x.n}">Version ${x.n}${x.publiee ? ' · <b>publiée</b>' : ''}<br><small>${dateCourte(x.le)} · ${echapper(x.parNom)}</small></button>`).join('')}</div>
      <div><h3 class="v-titre">${echapper(v.titre || 'Sans titre')}</h3><div class="corps-art apercu-version">${assainir(v.corps)}</div>
      ${surRestaurer ? '<p class="fenetre-bas"><button class="btn principal" type="button" data-restaurer>Restaurer dans le brouillon</button></p><p class="aide">Restaurer remplace le texte de l\'éditeur ; rien n\'est publié avant « Publier ».</p>' : ''}</div></div>`);
    const f = document.querySelector('#fenetre');
    f.classList.add('large');
    f.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => montrer(versions.find((x) => x.n === Number(b.dataset.v)))));
    f.querySelector('[data-restaurer]')?.addEventListener('click', () => { surRestaurer(v); fermerFenetre(); });
  };
  montrer(versions[0]);
}

// ---------- Éditeur ----------
const MODELE = () => ({
  titre: '', famille: 'racines', libelles: [], resume: '', image: null, corps: '',
  contexte: { versets: [], sources: [], fichiers: [] },
});
const cleLocale = (id) => `alfamous-article-${id || 'nouveau'}`;
const lireLocal = (id) => { try { return JSON.parse(localStorage.getItem(cleLocale(id)) || 'null'); } catch { return null; } };
const ecrireLocal = (id, d) => { try { localStorage.setItem(cleLocale(id), JSON.stringify({ ...d, t: Date.now() })); } catch { /* plein */ } };
const effacerLocal = (id) => { try { localStorage.removeItem(cleLocale(id)); } catch { /* rien */ } };

async function vueEditeur(contenu, id) {
  if (!redacteur()) { contenu.innerHTML = '<p class="message">Réservé aux rédacteurs (modérateurs et admins), connectés.</p>'; return; }
  contenu.innerHTML = '<p class="message">Chargement…</p>';
  let a = null; let travail = MODELE(); let assainir;
  try {
    assainir = await assainisseur();
    if (id) {
      const { db, F } = await firebase();
      const [s1, s2] = await Promise.all([
        avecDelai(F.getDocFromServer(F.doc(db, `articles/${id}`))),
        avecDelai(F.getDocFromServer(F.doc(db, `articles/${id}/atelier/brouillon`))),
      ]);
      if (!s1.exists()) { contenu.innerHTML = '<p class="message">Article introuvable.</p>'; return; }
      a = { id, ...s1.data() };
      if (!proprio(a)) { contenu.innerHTML = `<p class="message">Cet article appartient à ${echapper(a.auteurNom)} : un modérateur le lit mais ne le modifie pas. <a href="${adresse(a)}">Lire</a></p>`; return; }
      // Atelier absent (création interrompue, ou article importé) : repris du document public.
      travail = s2.exists() ? { ...MODELE(), ...s2.data() }
        : { ...MODELE(), titre: a.titre, famille: a.famille, libelles: a.libelles || [], resume: a.resume || '', image: a.image, corps: a.corps || '',
          contexte: { versets: (a.versets || []).map((ref) => ({ ref, cite: true, note: '' })), sources: (a.sources || []).map((s) => ({ ...s, publique: true })), fichiers: [] } };
      travail.contexte = { versets: [], sources: [], fichiers: [], ...(travail.contexte || {}) };
    }
  } catch (e) { contenu.innerHTML = erreurHtml(e); return; }

  // Copie locale plus récente que le brouillon enregistré (coupure, fermeture) : proposée.
  const local = lireLocal(id);
  const majLe = travail.majLe?.toMillis?.() || 0;
  const proposerLocal = local && local.t > majLe + 1000 && (local.corps !== travail.corps || local.titre !== travail.titre);

  const publie = a?.statut === 'publie';
  const jamaisPublie = !a || a.statut === 'brouillon';
  contenu.innerHTML = `<a class="retour" href="${a ? adresse(a) : '#/articles'}">← ${a ? 'Retour à l\'article' : 'Articles'}</a>
    ${proposerLocal ? `<div class="bandeau-local">Une copie locale plus récente (${new Date(local.t).toLocaleString('fr-CA')}) existe sur ce navigateur. <button class="btn" type="button" data-local="reprendre">La reprendre</button> <button class="lien-bouton" type="button" data-local="ignorer">L'ignorer</button></div>` : ''}
    <div class="atelier">
      <form class="editeur editeur-article" autocomplete="off">
        <div class="fil-meta">${a ? `${puceEtat(a) || '<span class="etat publie">publié</span>'}<span>créé le ${dateCourte(a.creeLe)}</span>${a.nbVersions ? `<span>${a.nbVersions} version${a.nbVersions > 1 ? 's' : ''}</span>` : ''}` : '<span class="etat brouillon">nouveau</span>'}</div>
        <div class="ed-champs">
          <label class="plein">Titre<input type="text" name="titre" maxlength="${LIMITES.titre}" required placeholder="Titre de l'article"></label>
          <label>Famille<select name="famille">${Object.entries(FAMILLES).map(([k, t]) => `<option value="${k}">${echapper(t)}</option>`).join('')}</select></label>
          <label>Libellés <small>(virgules, 10 au plus)</small><input type="text" name="libelles" list="libelles-connus" placeholder="Les mots du Coran, Société"></label>
          <datalist id="libelles-connus">${LIBELLES_CONNUS.map((l) => `<option value="${echapper(l)}">`).join('')}</datalist>
          <label class="plein">Résumé <small>(liste, page publique ; ${LIMITES.resume} caractères)</small><input type="text" name="resume" maxlength="${LIMITES.resume}"></label>
          <label>Image de couverture <small>(adresse)</small><span class="ligne-image"><input type="text" name="image" placeholder="https://…"><button class="btn" type="button" data-couverture title="Envoyer une image">Envoyer…</button></span></label>
          <label>Adresse <small>${jamaisPublie ? '(fixée à la première publication)' : '(fixée)'}</small><input type="text" name="slug" ${jamaisPublie ? '' : 'disabled'} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="proposée à partir du titre"></label>
        </div>
        <div class="barre-ed" role="toolbar" aria-label="Mise en forme">
          <button type="button" data-cmd="formatBlock" data-val="h2" title="Titre de section">T2</button>
          <button type="button" data-cmd="formatBlock" data-val="h3" title="Sous-titre">T3</button>
          <button type="button" data-cmd="formatBlock" data-val="p" title="Paragraphe">¶</button>
          <button type="button" data-cmd="bold" title="Gras"><b>G</b></button>
          <button type="button" data-cmd="italic" title="Italique"><i>I</i></button>
          <button type="button" data-cmd="formatBlock" data-val="blockquote" title="Citation">❝</button>
          <button type="button" data-cmd="insertUnorderedList" title="Liste">• Liste</button>
          <button type="button" data-cmd="insertOrderedList" title="Liste numérotée">1. Liste</button>
          <button type="button" data-action="lien" title="Lien">🔗</button>
          <button type="button" data-action="image" title="Image (envoyée dans Storage)">🖼 Image</button>
          <button type="button" data-action="tableau" title="Tableau 2 × 2">▦</button>
          <button type="button" data-action="encadre" title="Encadré">▭</button>
          <button type="button" data-action="rtl" title="Paragraphe de droite à gauche (arabe)">⇐ RTL</button>
          <button type="button" data-cmd="removeFormat" title="Effacer la mise en forme">⌫</button>
          <span class="sep"></span>
          <button type="button" data-action="verset" title="Insère l'arabe et la translittération copiés des données">+ Verset</button>
          <button type="button" data-action="importer" title="Word (.docx), HTML, Markdown ou texte">📄 Importer un fichier</button>
          <span class="modes"><button type="button" data-mode="visuel" class="actif">Visuel</button><button type="button" data-mode="html">HTML</button></span>
        </div>
        <div class="zone-ed corps-art" contenteditable="true" spellcheck="true"></div>
        <textarea class="zone-ed zone-html" spellcheck="false" hidden aria-label="Code HTML de l'article"></textarea>
        <input type="file" name="fichier" accept=".docx,.html,.htm,.md,.txt" hidden>
        <input type="file" name="image-fichier" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
        <div class="ed-etat"><span data-etat>${a ? `Brouillon privé${travail.majLe ? ` · enregistré le ${dateCourte(travail.majLe)}` : ''}` : 'Nouveau brouillon (privé)'} · copie locale automatique</span><span>HTML assaini à l'enregistrement : ni &lt;style&gt; ni &lt;script&gt;</span></div>
        <p class="form-msg" role="alert"></p>
        <div class="actions-ed">
          <div class="gauche">
            <button type="button" class="btn" data-act="enregistrer">Enregistrer le brouillon</button>
            ${a ? '<button type="button" class="btn" data-act="version">Enregistrer une version</button><button type="button" class="btn" data-act="historique">Historique</button>' : ''}
            <button type="button" class="btn" data-act="apercu">Aperçu</button>
          </div>
          <div class="droite">
            ${publie ? '<button type="button" class="btn" data-act="retirer">Retirer</button>' : ''}
            <button type="button" class="btn principal" data-act="publier">${publie ? 'Publier les modifications' : a?.statut === 'retire' ? 'Republier' : 'Publier'}</button>
          </div>
        </div>
      </form>
      <aside class="contexte" aria-label="Contexte"></aside>
    </div>`;

  const form = contenu.querySelector('.editeur-article');
  const zone = form.querySelector('.zone-ed[contenteditable]');
  const zoneHtml = form.querySelector('.zone-html');
  const msg = form.querySelector('.form-msg');
  const etat = form.querySelector('[data-etat]');
  let mode = 'visuel';
  let slugTouche = !jamaisPublie;

  // État → formulaire
  const remplir = (t) => {
    form.titre.value = t.titre || '';
    form.famille.value = FAMILLES[t.famille] ? t.famille : 'racines';
    form.libelles.value = (t.libelles || []).join(', ');
    form.resume.value = t.resume || '';
    form.image.value = t.image || '';
    zone.innerHTML = assainir(t.corps || '');
    zoneHtml.value = t.corps || '';
    lierVersets(zone);
  };
  remplir(travail);
  form.slug.value = a?.slug || (jamaisPublie ? slugifier(travail.titre) : '');
  if (a?.slug) slugTouche = true;

  // Formulaire → état (HTML assaini)
  const corpsActuel = () => assainir(mode === 'html' ? zoneHtml.value : zone.innerHTML)
    .replace(/<a class="refv"[^>]*>[^<]*<\/a>/g, ''); // liens ajoutés à l'affichage seulement
  const lire = () => ({
    titre: form.titre.value.trim().slice(0, LIMITES.titre),
    famille: form.famille.value,
    libelles: nettoyerLibelles(form.libelles.value.split(',')),
    resume: form.resume.value.trim().slice(0, LIMITES.resume),
    image: form.image.value.trim() || null,
    corps: corpsActuel(),
    contexte: travail.contexte,
  });

  // Copie locale (toutes les 30 s et à chaque frappe, avec un délai)
  let minuterie = null;
  const sauverLocal = () => { clearTimeout(minuterie); minuterie = setTimeout(() => ecrireLocal(a?.id, lire()), 1500); };
  form.addEventListener('input', sauverLocal);
  const intervalle = setInterval(() => { if (!document.body.contains(form)) { clearInterval(intervalle); return; } ecrireLocal(a?.id, lire()); }, 30000);
  form.titre.addEventListener('input', () => { if (!slugTouche) form.slug.value = slugifier(form.titre.value); });
  form.slug.addEventListener('input', () => { slugTouche = true; });
  contenu.querySelector('[data-local="reprendre"]')?.addEventListener('click', (e) => {
    travail = { ...travail, ...local, contexte: local.contexte || travail.contexte }; remplir(travail); dessinerContexte();
    e.target.closest('.bandeau-local').remove();
  });
  contenu.querySelector('[data-local="ignorer"]')?.addEventListener('click', (e) => { effacerLocal(a?.id); e.target.closest('.bandeau-local').remove(); });

  // Modes Visuel / HTML
  form.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode === mode) return;
    if (b.dataset.mode === 'html') { zoneHtml.value = corpsActuel(); zone.hidden = true; zoneHtml.hidden = false; }
    else { zone.innerHTML = assainir(zoneHtml.value); lierVersets(zone); zoneHtml.hidden = true; zone.hidden = false; }
    mode = b.dataset.mode;
    form.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('actif', x === b));
    form.querySelectorAll('.barre-ed [data-cmd], .barre-ed [data-action]:not([data-action="importer"]):not([data-action="verset"])').forEach((x) => { x.disabled = mode === 'html'; });
  }));

  // Insérer du HTML (assaini) au curseur, ou à la fin
  let selection = null;
  const memoriser = () => { const s = getSelection(); if (s.rangeCount && zone.contains(s.anchorNode)) selection = s.getRangeAt(0).cloneRange(); };
  zone.addEventListener('keyup', memoriser); zone.addEventListener('mouseup', memoriser); zone.addEventListener('blur', memoriser);
  const inserer = (html) => {
    const propre = assainir(html);
    if (mode === 'html') { zoneHtml.setRangeText(propre, zoneHtml.selectionStart, zoneHtml.selectionEnd, 'end'); sauverLocal(); return; }
    zone.focus();
    const s = getSelection();
    if (selection) { s.removeAllRanges(); s.addRange(selection); }
    if (!s.rangeCount || !zone.contains(s.anchorNode)) { zone.insertAdjacentHTML('beforeend', propre); }
    else document.execCommand('insertHTML', false, propre);
    lierVersets(zone); sauverLocal();
  };
  // Collage : HTML assaini (les styles de Word ou d'une page web ne passent pas)
  zone.addEventListener('paste', (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (!html) return;
    e.preventDefault();
    document.execCommand('insertHTML', false, assainir(html));
  });

  // Barre d'outils
  form.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => {
    zone.focus(); if (selection) { const s = getSelection(); s.removeAllRanges(); s.addRange(selection); }
    document.execCommand(b.dataset.cmd, false, b.dataset.val ? `<${b.dataset.val}>` : null);
    memoriser(); sauverLocal();
  }));
  const actions = {
    lien: () => {
      const url = prompt('Adresse du lien (https://…)');
      if (url && /^https?:\/\//.test(url)) { zone.focus(); if (selection) { const s = getSelection(); s.removeAllRanges(); s.addRange(selection); } document.execCommand('createLink', false, url); sauverLocal(); }
    },
    tableau: () => inserer('<table><tbody><tr><th>Colonne 1</th><th>Colonne 2</th></tr><tr><td>…</td><td>…</td></tr></tbody></table><p></p>'),
    encadre: () => inserer('<div class="encadre"><p>Texte de l\'encadré</p></div><p></p>'),
    rtl: () => {
      const s = getSelection(); let n = s.anchorNode;
      while (n && n !== zone && !(n.nodeType === 1 && /^(P|H2|H3|LI|BLOCKQUOTE|DIV)$/.test(n.tagName))) n = n.parentNode;
      if (n && n !== zone) { if (n.getAttribute('dir') === 'rtl') n.removeAttribute('dir'); else { n.setAttribute('dir', 'rtl'); n.setAttribute('lang', 'ar'); } sauverLocal(); }
    },
    verset: () => fenetreVerset((ref, html) => { inserer(html); ajouterVerset(ref, true); }),
    importer: () => form.fichier.click(),
    image: () => { cibleImage = 'texte'; form['image-fichier'].click(); },
  };
  let cibleImage = 'texte';
  form.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.action]?.()));
  form.querySelector('[data-couverture]').addEventListener('click', () => { cibleImage = 'couverture'; form['image-fichier'].click(); });

  // Il faut un identifiant d'article pour envoyer un fichier dans Storage : l'article est créé au besoin.
  async function assurerArticle() {
    if (a) return a;
    await enregistrer({ silencieux: true });
    return a;
  }
  async function envoyer(fichier, dossier) {
    const art = await assurerArticle();
    const { st, S } = await stockage();
    const nom = `${Date.now().toString(36)}-${fichier.name.replace(/[^\w.-]+/g, '_').slice(-60)}`;
    const r = S.ref(st, `articles/${art.id}/${dossier}/${nom}`);
    await S.uploadBytes(r, fichier, { contentType: fichier.type || 'application/octet-stream' });
    return { url: dossier === 'images' ? await S.getDownloadURL(r) : null, chemin: r.fullPath, nom: fichier.name, type: fichier.type, taille: fichier.size };
  }
  form['image-fichier'].addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { msg.textContent = 'Image trop lourde (5 Mo au plus).'; return; }
    msg.textContent = 'Envoi de l\'image…';
    try {
      const { url } = await envoyer(f, 'images');
      if (cibleImage === 'couverture') form.image.value = url;
      else inserer(`<p><img src="${echapper(url)}" alt=""></p>`);
      msg.textContent = '';
      sauverLocal();
    } catch (err) { msg.textContent = `Image non envoyée : ${messageErreur(err)}`; }
  });

  // Importer un fichier (Word, HTML, Markdown, texte)
  form.fichier.addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    msg.textContent = `Lecture de « ${f.name} »…`;
    try {
      let html; let bilan = '';
      if (/\.docx$/i.test(f.name)) {
        const r = await versDocx(await f.arrayBuffer(), async (image) => (await envoyer(image, 'images')).url);
        html = r.html; bilan = r.bilan;
      } else if (/\.md$/i.test(f.name)) html = markdownVersHtml(await f.text());
      else if (/\.html?$/i.test(f.name)) html = await f.text();
      else html = texteVersHtml(await f.text());
      const propre = assainir(html);
      msg.textContent = '';
      ouvrirFenetre(`<h2>Importer « ${echapper(f.name)} »</h2>
        <p>${echapper(bilan || `${texteBrut(propre).length.toLocaleString('fr-CA')} caractères lus.`)} Couleurs, polices et mises en page ne sont pas reprises.</p>
        <label class="choix"><input type="radio" name="mode-import" value="remplacer" checked> Remplacer le texte de l'éditeur</label>
        <label class="choix"><input type="radio" name="mode-import" value="inserer"> Insérer à l'endroit du curseur</label>
        <label class="choix"><input type="checkbox" name="garder" checked> Ranger le fichier d'origine dans le contexte (privé)</label>
        <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button type="button" class="btn principal" data-importer-ok>Importer</button></div>`);
      document.querySelector('[data-importer-ok]').addEventListener('click', async () => {
        const fen = document.querySelector('#fenetre');
        const remplacer = fen.querySelector('[name="mode-import"]:checked').value === 'remplacer';
        const garder = fen.querySelector('[name="garder"]').checked;
        fermerFenetre();
        if (remplacer) { zone.innerHTML = propre; zoneHtml.value = propre; lierVersets(zone); } else inserer(propre);
        sauverLocal();
        if (garder) {
          try { const r = await envoyer(f, 'fichiers'); travail.contexte.fichiers.push({ chemin: r.chemin, nom: r.nom, type: r.type, taille: r.taille }); dessinerContexte(); sauverLocal(); }
          catch (err) { msg.textContent = `Fichier d'origine non rangé : ${messageErreur(err)}`; }
        }
      });
    } catch (err) { msg.textContent = `Import impossible : ${messageErreur(err)}`; }
  });

  // ---------- Panneau Contexte (étape 3a : versets, sources, fichiers) ----------
  const panneau = contenu.querySelector('.contexte');
  function ajouterVerset(ref, cite) {
    if (!travail.contexte.versets.some((v) => v.ref === ref)) travail.contexte.versets.push({ ref, cite, note: '' });
    else if (cite) travail.contexte.versets.find((v) => v.ref === ref).cite = true;
    dessinerContexte(); sauverLocal();
  }
  function dessinerContexte() {
    const c = travail.contexte;
    panneau.innerHTML = `<h2>Contexte <small>privé · sert à écrire</small></h2>
      <details class="ctx" open><summary>Versets<span class="n">${c.versets.length}</span></summary><div class="ctx-corps">
        ${c.versets.map((v, i) => `<div class="ctx-item"><div><a class="ref" href="${lienRequete(v.ref)}" target="_blank">${echapper(v.ref)}</a>
          <label class="cite"><input type="checkbox" data-cite="${i}" ${v.cite ? 'checked' : ''}> cité (affiché sous le verset)</label>
          <input class="note-ctx" type="text" data-note-v="${i}" value="${echapper(v.note || '')}" placeholder="note"></div>
          <div class="actions"><button type="button" data-inserer-v="${i}">insérer</button><button type="button" data-retirer-v="${i}">retirer</button></div></div>`).join('') || '<p class="aide">Aucun verset. « + Verset » en insère un et l\'ajoute ici.</p>'}
        <div class="ctx-ajout"><input type="text" data-ajout-v placeholder="2:183 ou 2:183-187"><button type="button" class="btn" data-ajout-v-ok>Ajouter</button></div>
      </div></details>
      <details class="ctx" ${c.sources.length ? 'open' : ''}><summary>Sources et liens<span class="n">${c.sources.length}</span></summary><div class="ctx-corps">
        ${c.sources.map((s, i) => `<div class="ctx-item"><div>${s.url ? `<a href="${echapper(s.url)}" target="_blank" rel="noopener noreferrer">${echapper(s.titre || s.url)}</a>` : echapper(s.titre)}
          ${s.note ? `<div class="petit">${echapper(s.note)}</div>` : ''}<label class="cite"><input type="checkbox" data-pub-s="${i}" ${s.publique ? 'checked' : ''}> publiée en bas de l'article</label></div>
          <div class="actions"><button type="button" data-retirer-s="${i}">retirer</button></div></div>`).join('') || '<p class="aide">Aucune source.</p>'}
        <div class="ctx-ajout ctx-source"><input type="text" data-s-titre placeholder="Titre"><input type="text" data-s-url placeholder="https://… (facultatif)"><input type="text" data-s-note placeholder="Note (facultative)"><button type="button" class="btn" data-ajout-s>Ajouter</button></div>
      </div></details>
      <details class="ctx" ${c.fichiers.length ? 'open' : ''}><summary>Fichiers<span class="n">${c.fichiers.length}</span></summary><div class="ctx-corps">
        ${c.fichiers.map((f, i) => `<div class="ctx-item"><div>📄 <a href="#" data-ouvrir-f="${i}">${echapper(f.nom)}</a> <span class="petit">${Math.ceil((f.taille || 0) / 1024)} Ko · privé</span></div></div>`).join('') || '<p class="aide">Les fichiers importés (Word…) sont rangés ici.</p>'}
      </div></details>
      <p class="aide ctx-suite">Racines, lexique, forum, notes, vérification et « Dossier pour Claude » : étape suivante.</p>`;
  }
  dessinerContexte();
  panneau.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.cite !== undefined) travail.contexte.versets[t.dataset.cite].cite = t.checked;
    if (t.dataset.noteV !== undefined) travail.contexte.versets[t.dataset.noteV].note = t.value.slice(0, 500);
    if (t.dataset.pubS !== undefined) travail.contexte.sources[t.dataset.pubS].publique = t.checked;
    sauverLocal();
  });
  panneau.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.retirerV !== undefined) { travail.contexte.versets.splice(Number(t.dataset.retirerV), 1); dessinerContexte(); sauverLocal(); }
    if (t.dataset.retirerS !== undefined) { travail.contexte.sources.splice(Number(t.dataset.retirerS), 1); dessinerContexte(); sauverLocal(); }
    if (t.dataset.insererV !== undefined) { const ref = travail.contexte.versets[t.dataset.insererV].ref; inserer(await blocVerset(ref)); }
    if (t.dataset.ajoutVOk !== undefined) {
      const champ = panneau.querySelector('[data-ajout-v]');
      const refs = await developperRefs(champ.value);
      if (!refs.length) { champ.setCustomValidity('Référence attendue : 2:183 ou 2:183-187'); champ.reportValidity(); return; }
      for (const r of refs) ajouterVerset(r, true);
    }
    if (t.dataset.ajoutS !== undefined) {
      const titre = panneau.querySelector('[data-s-titre]').value.trim(); const url = panneau.querySelector('[data-s-url]').value.trim();
      if (!titre && !url) return;
      if (url && !/^https?:\/\//.test(url)) { panneau.querySelector('[data-s-url]').setCustomValidity('Adresse https://…'); panneau.querySelector('[data-s-url]').reportValidity(); return; }
      travail.contexte.sources.push({ titre: titre.slice(0, 300), url: url.slice(0, 500), note: panneau.querySelector('[data-s-note]').value.trim().slice(0, 500), publique: true });
      dessinerContexte(); sauverLocal();
    }
    if (t.dataset.ouvrirF !== undefined) {
      e.preventDefault();
      try { const { st, S } = await stockage(); open(await S.getDownloadURL(S.ref(st, travail.contexte.fichiers[t.dataset.ouvrirF].chemin)), '_blank', 'noopener'); }
      catch (err) { msg.textContent = messageErreur(err); }
    }
  });

  // ---------- Enregistrer, versions, publier, retirer ----------
  const champsPublics = (d) => {
    const { versets, sourates } = champsCites(d.contexte);
    return {
      titre: d.titre, famille: d.famille, libelles: d.libelles, resume: d.resume, image: d.image, corps: d.corps,
      versets, sourates, racines: (d.contexte.racines || []).slice(0, 100), lexique: (d.contexte.lexique || []).slice(0, 100),
      sources: (d.contexte.sources || []).filter((s) => s.publique).map(({ titre, url, note }) => ({ titre, url, note })).slice(0, 50),
      liens: (d.contexte.liens || []).slice(0, 20),
    };
  };
  const occupe = (oui) => form.querySelectorAll('.actions-ed button').forEach((b) => { b.disabled = oui; });

  async function enregistrer({ silencieux = false } = {}) {
    const d = lire();
    if (d.corps.length > LIMITES.corps) throw new Error('Texte trop long (300 000 caractères au plus).');
    if (d.image && (d.image.length > 300 || !/^https?:\/\//.test(d.image))) throw new Error('Image de couverture : adresse https://… de 300 caractères au plus.');
    const { db, F } = await firebase();
    const ts = F.serverTimestamp();
    const atelier = { titre: d.titre, famille: d.famille, libelles: d.libelles, resume: d.resume, image: d.image, corps: d.corps, contexte: d.contexte, majLe: ts, majPar: session.utilisateur.uid };
    if (!a) {
      // Création en deux requêtes : l'article, puis son atelier (docs/MODELE-DONNEES.md).
      const ref = F.doc(F.collection(db, 'articles'));
      const pub = { ...champsPublics({ ...d, corps: '' }), versets: [], sourates: [], sources: [] };
      await avecDelai(F.setDoc(ref, {
        ...pub, slug: null, statut: 'brouillon', auteurUid: session.utilisateur.uid, auteurNom: session.nom,
        creeLe: ts, modifieLe: ts, publieLe: null, republieLe: null, nbVersions: 0,
      }));
      a = { id: ref.id, statut: 'brouillon', slug: null, nbVersions: 0, auteurUid: session.utilisateur.uid, auteurNom: session.nom };
      await avecDelai(F.setDoc(F.doc(db, `articles/${a.id}/atelier/brouillon`), atelier));
      effacerLocal(null);
      history.replaceState(null, '', `#/article/${a.id}/modifier`);
    } else {
      await avecDelai(F.setDoc(F.doc(db, `articles/${a.id}/atelier/brouillon`), atelier));
      // Brouillon jamais publié : titre, famille… tenus à jour pour la liste des rédacteurs.
      if (a.statut === 'brouillon') {
        await avecDelai(F.updateDoc(F.doc(db, `articles/${a.id}`), { titre: d.titre, famille: d.famille, libelles: d.libelles, resume: d.resume, modifieLe: ts }));
      }
    }
    travail = { ...travail, ...d };
    effacerLocal(a.id);
    etat.textContent = `Brouillon privé · enregistré à ${new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`;
    if (!silencieux) msg.textContent = '';
    return d;
  }

  async function enregistrerVersion() {
    const d = await enregistrer();
    const { db, F } = await firebase();
    const snap = await avecDelai(F.getDocFromServer(F.doc(db, `articles/${a.id}`)));
    const art = snap.data();
    const n = art.nbVersions + 1;
    const lot = F.writeBatch(db);
    lot.set(F.doc(db, `articles/${a.id}/versions/${n}`), {
      titre: d.titre, corps: d.corps, resume: d.resume, famille: d.famille, libelles: d.libelles,
      le: F.serverTimestamp(), parUid: session.utilisateur.uid, parNom: session.nom, publiee: false,
    });
    lot.update(F.doc(db, `articles/${a.id}`), art.statut === 'brouillon' ? { nbVersions: n, modifieLe: F.serverTimestamp() } : { nbVersions: n });
    await avecDelai(lot.commit());
    a.nbVersions = n;
    return n;
  }

  async function publier() {
    const d = lire();
    if (!d.titre) throw new Error('Un titre est nécessaire pour publier.');
    if (!texteBrut(d.corps)) throw new Error('Le texte est vide.');
    await enregistrer({ silencieux: true });
    const { db, F } = await firebase();
    const art = (await avecDelai(F.getDocFromServer(F.doc(db, `articles/${a.id}`)))).data();
    const premiere = !art.slug;
    const slug = premiere ? form.slug.value.trim() : art.slug;
    if (premiere) {
      if (!slugValide(slug)) throw new Error('Adresse invalide : minuscules, chiffres et tirets (3 à 100 caractères).');
      const pris = await avecDelai(F.getDocFromServer(F.doc(db, `slugs/${slug}`)));
      if (pris.exists()) throw new Error(`L'adresse « ${slug} » est déjà prise : choisissez-en une autre.`);
    }
    const n = art.nbVersions + 1;
    const ts = F.serverTimestamp();
    const pub = champsPublics(d);
    const lot = F.writeBatch(db);
    lot.update(F.doc(db, `articles/${a.id}`), {
      ...pub, statut: 'publie', modifieLe: ts, nbVersions: n,
      ...(premiere ? { slug, publieLe: ts } : { republieLe: ts }),
    });
    lot.set(F.doc(db, `articles/${a.id}/versions/${n}`), {
      titre: pub.titre, corps: pub.corps, resume: pub.resume, famille: pub.famille, libelles: pub.libelles,
      le: ts, parUid: session.utilisateur.uid, parNom: session.nom, publiee: true,
    });
    if (premiere) lot.set(F.doc(db, `slugs/${slug}`), { article: a.id });
    await avecDelai(lot.commit());
    return slug;
  }

  form.querySelector('.actions-ed').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    msg.style.color = ''; msg.textContent = '';
    const act = b.dataset.act;
    if (act === 'apercu') {
      const d = lire();
      ouvrirFenetre(`<h2>Aperçu</h2><article class="art-page"><div class="art-meta">${puceFamille(d.famille)}${d.libelles.map((l) => `<span class="libelle">${echapper(l)}</span>`).join('')}</div>
        <h1>${echapper(d.titre || 'Sans titre')}</h1>${d.resume ? `<p class="chapeau">${echapper(d.resume)}</p>` : ''}<div class="corps-art">${d.corps}</div></article>`);
      document.querySelector('#fenetre').classList.add('large');
      lierVersets(document.querySelector('#fenetre .corps-art'));
      return;
    }
    if (act === 'historique') { fenetreHistorique(a, (v) => { remplir({ ...lire(), titre: v.titre, corps: v.corps, resume: v.resume, famille: v.famille, libelles: v.libelles }); sauverLocal(); msg.textContent = `Version ${v.n} restaurée dans l'éditeur (pas encore enregistrée).`; }); return; }
    if (act === 'publier') {
      const nbCites = champsCites(travail.contexte).versets.length;
      ouvrirFenetre(`<h2>${publie ? 'Publier les modifications' : 'Publier l\'article'}</h2>
        <p>${publie ? 'Le brouillon remplace la version en ligne ; une version « publiée » est enregistrée.'
          : `L'article devient lisible par tous${jamaisPublie ? `, à l'adresse <code>#/article/${echapper(form.slug.value.trim())}</code>, qui ne changera plus` : ''}.`}</p>
        ${nbCites ? `<p class="aide">${nbCites} verset${nbCites > 1 ? 's' : ''} marqué${nbCites > 1 ? 's' : ''} « cité » : affichage sous les versets à l'étape suivante.</p>` : ''}
        <p class="aide">La page publique indexable sera produite au déploiement (étape 6).</p>
        <p class="form-msg" role="alert"></p>
        <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button type="button" class="btn principal" data-publier-ok>Publier</button></div>`);
      const ok = document.querySelector('[data-publier-ok]');
      ok.addEventListener('click', async () => {
        ok.disabled = true;
        try { const slug = await publier(); fermerFenetre(); location.hash = `#/article/${encodeURIComponent(slug)}`; }
        catch (err) { document.querySelector('#fenetre .form-msg').textContent = messageErreur(err); ok.disabled = false; }
      });
      return;
    }
    if (act === 'retirer') {
      ouvrirFenetre(`<h2>Retirer l'article</h2><p>Il ne sera plus lu que par les rédacteurs ; son adresse et ses commentaires sont gardés. Vous pourrez le republier.</p>
        <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button type="button" class="btn danger-plein" data-retirer-ok>Retirer</button></div>`);
      document.querySelector('[data-retirer-ok]').addEventListener('click', async (ev) => {
        ev.target.disabled = true;
        try {
          const { db, F } = await firebase();
          await avecDelai(F.updateDoc(F.doc(db, `articles/${a.id}`), { statut: 'retire', modifieLe: F.serverTimestamp() }));
          fermerFenetre(); location.hash = `#/article/${encodeURIComponent(a.id)}`;
        } catch (err) { ev.target.disabled = false; ouvrirFenetre(`<h2>Retrait impossible</h2>${erreurHtml(err)}`); }
      });
      return;
    }
    occupe(true);
    try {
      if (act === 'enregistrer') { await enregistrer(); msg.style.color = 'var(--discret)'; msg.textContent = 'Brouillon enregistré (privé).'; }
      if (act === 'version') { const n = await enregistrerVersion(); msg.style.color = 'var(--discret)'; msg.textContent = `Version ${n} enregistrée.`; }
    } catch (err) { msg.textContent = messageErreur(err); } finally { occupe(false); }
  });
}

// ---------- Versets copiés des données (jamais tapés à la main) ----------
async function developperRefs(texte) {
  const m = String(texte).trim().match(/^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/);
  if (!m) return [];
  const s = Number(m[1]); const de = Number(m[2]); const a = Number(m[3] || m[2]);
  const sour = (await D.sourates()).find((x) => x.n === s);
  if (!sour || de < 1 || a < de || a > sour.versets || a - de > 50) return [];
  return Array.from({ length: a - de + 1 }, (_, i) => `${s}:${de + i}`);
}
async function blocVerset(ref) {
  const [s, v] = ref.split(':').map(Number);
  const x = (await D.texte(s)).versets.find((e) => e.v === v);
  if (!x) throw new Error(`Verset ${ref} introuvable.`);
  return `<div class="verset-bloc" data-ref="${ref}"><p class="ar" lang="ar" dir="rtl">${echapper(x.ar)}</p><p class="tr">${echapper(x.tr)}</p></div><p></p>`;
}
function fenetreVerset(surChoix) {
  ouvrirFenetre(`<h2>Insérer un verset</h2>
    <p class="aide">L'arabe et la translittération sont copiés des données d'Alfamous (donnees/texte), jamais tapés à la main.</p>
    <form data-verset-form><label>Référence<input name="ref" required placeholder="19:26 ou 2:183-185" autocomplete="off"></label>
      <div class="apercu-verset"></div><p class="form-msg" role="alert"></p>
      <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button class="btn principal">Insérer</button></div></form>`);
  const f = document.querySelector('[data-verset-form]');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const refs = await developperRefs(f.ref.value);
      if (!refs.length) { f.querySelector('.form-msg').textContent = 'Référence inconnue (exemples : 19:26, 2:183-185).'; return; }
      const blocs = await Promise.all(refs.map(blocVerset));
      fermerFenetre();
      refs.forEach((r, i) => surChoix(r, blocs[i]));
    } catch (err) { f.querySelector('.form-msg').textContent = messageErreur(err); }
  });
}

