// Commentaires Alfamous sous les versets (maquette validée le 23 nov. 2026, docs/maquettes/commentaires.html),
// et définitions du lexique (même modèle : type « lexique », clé = entrée ; docs/maquettes/lexique.html).
// - Bouton à droite de ⌃ / ⌄ : fermé par défaut, ouvre et ferme les commentaires de CE verset.
// - Les plus récents en premier ; la liste défile si elle est longue.
// - Écrire dès le niveau 1 ; modifier le sien (historique) ; signaler ; masquer (2+) ; supprimer (3).
// Modèle et règles : docs/MODELE-DONNEES.md, firestore.rules.
import { firebase, avecDelai } from './firebase.js';
import { session, surChangement, demanderConnexion, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, enrichir, dateCourte, initiale, messageErreur, TEXTE_MAX } from './commentaires-format.js';
import { ligneForum } from './notes.js';
import { ajouterLimite } from './limite.js';

const lienRequete = (q) => `#/q/${encodeURIComponent(q)}`;
const ICONE_BULLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';
const nombres = new Map(); // « type|cle » → nombre de commentaires
const listes = new Map(); // « type|cle » → commentaires chargés (pour les actions)
const brouillons = new Map();

// ---------- Bouton sous le verset ----------
export function boutonCommentaires(cle, type = 'verset') {
  return `<button type="button" class="bouton-com" data-com-type="${type}" data-com-cle="${echapper(cle)}" aria-expanded="false">${ICONE_BULLE}<span>Commentaires</span></button>`;
}

function libelleBouton(b) {
  const k = `${b.dataset.comType}|${b.dataset.comCle}`;
  const n = nombres.get(k);
  const ouvert = b.getAttribute('aria-expanded') === 'true';
  b.classList.toggle('a-des', n > 0);
  b.querySelector('span').textContent = ouvert ? 'Fermer'
    : n === undefined ? 'Commentaires' : n ? `${n} commentaire${n > 1 ? 's' : ''}` : 'Commenter';
}

// Nombre de commentaires, demandé seulement pour les boutons visibles à l'écran.
const observateur = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entrees) => {
  for (const e of entrees) {
    if (!e.isIntersecting) continue;
    observateur.unobserve(e.target);
    compter(e.target);
  }
}, { rootMargin: '200px' }) : null;

async function compter(b) {
  const { comType: type, comCle: cle } = b.dataset;
  const k = `${type}|${cle}`;
  if (!nombres.has(k)) {
    try {
      const { db, F } = await firebase();
      const q = F.query(F.collection(db, 'commentaires'), F.where('type', '==', type), F.where('cle', '==', cle));
      nombres.set(k, (await avecDelai(F.getCountFromServer(q))).data().count);
    } catch { return; } // pas de nombre : le bouton reste « Commentaires »
  }
  document.querySelectorAll(`.bouton-com[data-com-type="${type}"][data-com-cle="${CSS.escape(cle)}"]`).forEach(libelleBouton);
}

function surveiller(racine) {
  racine.querySelectorAll('.bouton-com:not([data-vu])').forEach((b) => {
    b.dataset.vu = '1';
    if (observateur) observateur.observe(b); else compter(b);
  });
}

// ---------- Section des commentaires ----------
const zoneDe = (b) => b.closest('.verset, .lexique')?.querySelector(':scope > .commentaires');

async function basculer(b) {
  const carte = b.closest('.verset, .lexique');
  const ouvert = b.getAttribute('aria-expanded') === 'true';
  if (ouvert) {
    zoneDe(b)?.remove();
    b.setAttribute('aria-expanded', 'false');
  } else {
    carte.insertAdjacentHTML('beforeend', `<section class="commentaires" data-com-type="${b.dataset.comType}" data-com-cle="${echapper(b.dataset.comCle)}"><p class="aide">Chargement…</p></section>`);
    b.setAttribute('aria-expanded', 'true');
    await charger(zoneDe(b));
  }
  libelleBouton(b);
}

async function charger(zone) {
  if (!zone) return;
  const { comType: type, comCle: cle } = zone.dataset;
  const k = `${type}|${cle}`;
  try {
    const { db, F } = await firebase();
    const q = F.query(F.collection(db, 'commentaires'), F.where('type', '==', type), F.where('cle', '==', cle), F.orderBy('creeLe', 'desc'));
    const snap = await avecDelai(F.getDocsFromServer(q)); // jamais le cache : émulateur éteint = erreur visible
    const liste = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Modérateurs : texte des commentaires masqués et nombre de signalements.
    if (session.niveau >= 2) {
      await Promise.all(liste.map(async (c) => {
        const [prive, sig] = await Promise.all([
          c.masque ? F.getDoc(F.doc(db, `commentaires/${c.id}/prive/texte`)).catch(() => null) : null,
          F.getCountFromServer(F.collection(db, `commentaires/${c.id}/signalements`)).catch(() => null),
        ]);
        c.textePrive = prive?.data()?.texte;
        c.signalements = sig?.data().count || 0;
      }));
    }
    listes.set(k, liste);
    nombres.set(k, liste.length);
    dessiner(zone, liste);
  } catch (e) {
    zone.innerHTML = `<p class="aide erreur">Commentaires indisponibles : ${echapper(messageErreur(e))}</p>`;
  }
  document.querySelectorAll(`.bouton-com[data-com-type="${type}"][data-com-cle="${CSS.escape(cle)}"]`).forEach(libelleBouton);
}

function dessiner(zone, liste) {
  const { comType: type, comCle: cle } = zone.dataset;
  const k = `${type}|${cle}`;
  const n = session.niveau;
  const uid = session.utilisateur?.uid;
  const lexique = type === 'lexique';
  const cible = lexique ? `« ${cle} »` : cle;
  const nbMasques = liste.filter((c) => c.masque).length;

  const items = liste.map((c) => {
    const moi = uid && c.auteurUid === uid;
    const acts = [];
    if (c.nbVersions > 1 && (!c.masque || n >= 2)) acts.push(`<button data-com-act="historique" data-id="${c.id}">Historique (${c.nbVersions} versions)</button>`);
    if (moi && !c.masque && n >= 1) acts.push(`<button data-com-act="modifier" data-id="${c.id}">Modifier</button>`);
    if (n === 1 && !moi && !c.masque) acts.push(`<button data-com-act="signaler" data-id="${c.id}">Signaler</button>`);
    if (n >= 2) acts.push(c.masque ? `<button data-com-act="demasquer" data-id="${c.id}">Démasquer</button>` : `<button data-com-act="masquer" data-id="${c.id}">Masquer</button>`);
    if (n >= 3) acts.push(`<button class="danger" data-com-act="supprimer" data-id="${c.id}">Supprimer définitivement</button>`);
    if (n >= 2 && c.signalements) acts.push(`<span class="signal">⚑ ${c.signalements} signalement${c.signalements > 1 ? 's' : ''}</span>`);

    let corps;
    if (c.masque && n < 2) corps = `<p class="com-texte placeholder">${lexique ? 'Définition masquée' : 'Commentaire masqué'} par un modérateur.</p>`;
    else if (c.masque) corps = `<p class="com-texte barre">${enrichir(c.textePrive ?? '', lienRequete)}</p>
        <span class="bandeau-masque">Masqué par ${echapper(c.masque.parNom)} le ${dateCourte(c.masque.le)} — les autres ne voient que la mention « Commentaire masqué »</span>`;
    else corps = `<p class="com-texte">${enrichir(c.texte, lienRequete)}</p>`;

    return `<div class="com${c.masque ? ' masque' : ''}" data-id="${c.id}">
      <div class="avatar" aria-hidden="true">${echapper(initiale(c.auteurNom))}</div>
      <div class="com-corps">
        <div class="com-meta"><span class="auteur">${echapper(c.auteurNom)}</span>${moi ? '<span class="toi">vous</span>' : ''}
          <span>${dateCourte(c.creeLe)}</span>${c.nbVersions > 1 ? `<span title="Modifié le ${dateCourte(c.modifieLe)}">· modifié</span>` : ''}</div>
        ${corps}
        ${acts.length ? `<div class="com-actions">${acts.join('')}</div>` : ''}
      </div></div>`;
  }).join('');

  const ecrire = !session.utilisateur
    ? `<div class="ecrire connexion">Pour écrire ${lexique ? 'une définition' : 'un commentaire'}, connectez-vous avec un compte au courriel vérifié.<br>
        <button type="button" class="btn principal" data-compte="connexion">Se connecter</button>
        <button type="button" class="btn" data-compte="inscription">Créer un compte</button></div>`
    : n < 1
      ? '<div class="ecrire connexion">Vérifiez votre courriel pour pouvoir écrire. <button type="button" class="lien-bouton" data-compte="verifier">Que faire ?</button></div>'
      : `<form class="ecrire" data-com-form>
          <textarea name="texte" maxlength="${TEXTE_MAX}" required placeholder="${lexique ? 'Votre définition de' : 'Votre commentaire sur'} ${echapper(cible)}… (renvois possibles : 2:255, r:أحد)">${echapper(brouillons.get(k) || '')}</textarea>
          <div class="ecrire-bas"><span>Publié tout de suite, signé « ${echapper(session.nom)} ». Vous pourrez le modifier, pas le supprimer.</span>
          <span><span data-compteur>${(brouillons.get(k) || '').length}</span> / ${TEXTE_MAX.toLocaleString('fr-CA')}
          <button class="btn principal">Publier</button></span></div>
          <p class="form-msg" role="alert"></p>
        </form>`;

  const fem = lexique ? 'e' : '';
  zone.innerHTML = `<div class="com-entete"><h3>${lexique ? 'Définitions' : 'Commentaires Alfamous'} · ${liste.length}</h3>
      <span class="discret">${liste.length > 1 ? `les plus récent${fem}s en premier` : ''}${nbMasques ? ` · dont ${nbMasques} masqué${fem}${nbMasques > 1 ? 's' : ''}` : ''}</span></div>
    ${liste.length ? `<div class="com-liste">${items}</div>` : `<p class="aide">${lexique ? 'Aucune définition pour l\'instant.' : 'Aucun commentaire pour l\'instant.'}</p>`}
    ${ecrire}
    ${zone.dataset.forum !== 'non' ? '<div class="forum-verset"></div>' : ''}`;
  if (zone.dataset.forum !== 'non') ligneForum(zone.querySelector('.forum-verset'), cle, type);
}

// ---------- Actions ----------
const trouver = (zone, id) => listes.get(`${zone.dataset.comType}|${zone.dataset.comCle}`)?.find((c) => c.id === id);
const signature = () => ({ par: session.utilisateur.uid, parNom: session.nom });

// Publier un commentaire (verset) ou une définition (lexique), avec le compteur de la limite de fréquence.
// L'événement « commentaire-publie » prévient le lexique (liste à recharger).
export async function publierCommentaire(type, cle, texte) {
  const { db, F } = await firebase();
  const lot = F.writeBatch(db);
  lot.set(F.doc(F.collection(db, 'commentaires')), {
    type, cle, auteurUid: session.utilisateur.uid, auteurNom: session.nom, texte,
    creeLe: F.serverTimestamp(), modifieLe: null, nbVersions: 1, masque: null,
  });
  await ajouterLimite(lot, db, F, session);
  await avecDelai(lot.commit());
  nombres.delete(`${type}|${cle}`);
  document.dispatchEvent(new CustomEvent('commentaire-publie', { detail: { type, cle } }));
}

// Afficher directement les commentaires d'une zone (fiche d'une entrée du lexique).
export const afficherCommentaires = (zone) => charger(zone);

async function publier(form) {
  const zone = form.closest('.commentaires');
  const texte = form.texte.value.trim();
  const msg = form.querySelector('.form-msg');
  if (!texte) return;
  const bouton = form.querySelector('.principal');
  bouton.disabled = true; msg.textContent = '';
  try {
    await publierCommentaire(zone.dataset.comType, zone.dataset.comCle, texte);
    brouillons.delete(`${zone.dataset.comType}|${zone.dataset.comCle}`);
    await charger(zone);
  } catch (e) { msg.textContent = messageErreur(e); bouton.disabled = false; }
}

function formulaireModification(zone, c) {
  const el = zone.querySelector(`.com[data-id="${c.id}"] .com-corps`);
  el.querySelector('.com-texte').outerHTML = `<form class="ecrire" data-com-edition="${c.id}">
      <textarea name="texte" maxlength="${TEXTE_MAX}" required>${echapper(c.texte)}</textarea>
      <div class="ecrire-bas"><span>L'ancienne version reste dans l'historique.</span>
      <span><button type="button" class="btn" data-com-act="annuler">Annuler</button> <button class="btn principal">Enregistrer</button></span></div>
      <p class="form-msg" role="alert"></p></form>`;
  el.querySelector('.com-actions')?.remove();
  el.querySelector('textarea').focus();
}

async function enregistrer(form) {
  const zone = form.closest('.commentaires');
  const c = trouver(zone, form.dataset.comEdition);
  const texte = form.texte.value.trim();
  const msg = form.querySelector('.form-msg');
  if (!texte || texte === c.texte) { await charger(zone); return; }
  try {
    const { db, F } = await firebase();
    const lot = F.writeBatch(db);
    lot.set(F.doc(db, `commentaires/${c.id}/versions/${c.nbVersions}`), { texte: c.texte, le: c.modifieLe ?? c.creeLe });
    lot.update(F.doc(db, `commentaires/${c.id}`), { texte, modifieLe: F.serverTimestamp(), nbVersions: c.nbVersions + 1 });
    await avecDelai(lot.commit());
    changement(zone);
    await charger(zone);
  } catch (e) { msg.textContent = messageErreur(e); }
}

async function historique(zone, c) {
  const { db, F } = await firebase();
  const snap = await avecDelai(F.getDocs(F.collection(db, `commentaires/${c.id}/versions`)));
  const anciennes = snap.docs.map((d) => ({ n: Number(d.id), ...d.data() })).sort((a, b) => b.n - a.n);
  const actuelle = { n: c.nbVersions, texte: c.masque ? c.textePrive ?? '' : c.texte, le: c.modifieLe ?? c.creeLe };
  ouvrirFenetre(`<h2>Historique du commentaire</h2>
    ${[actuelle, ...anciennes].map((v, i) => `<div class="version${i === 0 ? ' actuelle' : ''}">
      <small>Version ${v.n} · ${dateCourte(v.le)}${i === 0 ? ' · affichée' : ''}</small>${enrichir(v.texte, lienRequete)}</div>`).join('')}
    <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button></div>`);
}

async function masquer(zone, c) {
  const { db, F } = await firebase();
  const lot = F.writeBatch(db);
  lot.set(F.doc(db, `commentaires/${c.id}/prive/texte`), { texte: c.texte });
  lot.update(F.doc(db, `commentaires/${c.id}`), { texte: '', masque: { ...signature(), le: F.serverTimestamp() } });
  await avecDelai(lot.commit());
}

async function demasquer(zone, c) {
  const { db, F } = await firebase();
  const lot = F.writeBatch(db);
  lot.delete(F.doc(db, `commentaires/${c.id}/prive/texte`));
  lot.update(F.doc(db, `commentaires/${c.id}`), { texte: c.textePrive, masque: null });
  await avecDelai(lot.commit());
}

function confirmerSuppression(c) {
  ouvrirFenetre(`<h2>Supprimer définitivement ?</h2>
    <p>Le commentaire de <b>${echapper(c.auteurNom)}</b>, son historique et ses signalements seront effacés. Cette action ne peut pas être annulée.</p>
    <p class="aide">Pour le retirer de façon réversible, utilisez plutôt « Masquer ».</p>
    <p class="form-msg" role="alert"></p>
    <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button>
      <button type="button" class="btn danger-plein" data-com-confirmer="supprimer" data-id="${c.id}">Supprimer</button></div>`);
}

async function supprimer(id) {
  const { db, F } = await firebase();
  const lot = F.writeBatch(db);
  for (const sous of ['versions', 'signalements', 'prive']) {
    const snap = await F.getDocs(F.collection(db, `commentaires/${id}/${sous}`));
    snap.docs.forEach((d) => lot.delete(d.ref));
  }
  lot.delete(F.doc(db, `commentaires/${id}`));
  await avecDelai(lot.commit());
}

function formulaireSignalement(c) {
  ouvrirFenetre(`<h2>Signaler ce commentaire</h2>
    <p>Le signalement va aux modérateurs, qui décident de le masquer ou non. L'auteur n'est pas prévenu.</p>
    <form data-com-signal="${c.id}">
      <label>Motif (facultatif)<textarea name="motif" maxlength="500" rows="3"></textarea></label>
      <p class="form-msg" role="alert"></p>
      <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button class="btn principal">Signaler</button></div>
    </form>`);
}

async function signaler(form) {
  const msg = form.querySelector('.form-msg');
  try {
    const { db, F } = await firebase();
    const lot = F.writeBatch(db);
    lot.set(F.doc(db, `commentaires/${form.dataset.comSignal}/signalements/${session.utilisateur.uid}`),
      { motif: form.motif.value.trim(), le: F.serverTimestamp() });
    await ajouterLimite(lot, db, F, session);
    await avecDelai(lot.commit());
    ouvrirFenetre('<h2>Merci</h2><p>Le signalement a été transmis aux modérateurs.</p><div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button></div>');
  } catch (e) {
    // Un deuxième signalement du même membre est refusé par les règles.
    msg.textContent = e?.code === 'permission-denied' ? 'Vous avez déjà signalé ce commentaire.' : messageErreur(e);
  }
}

const changement = (zone) => document.dispatchEvent(new CustomEvent('commentaire-publie', { detail: { type: zone.dataset.comType, cle: zone.dataset.comCle } }));

// Zone d'un commentaire dont la fenêtre est ouverte (pour recharger après l'action).
let zoneActive = null;

export function initCommentaires(contenu) {
  surveiller(contenu);
  new MutationObserver(() => surveiller(contenu)).observe(contenu, { childList: true, subtree: true });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.bouton-com');
    if (b) { basculer(b); return; }
    const conf = e.target.closest('[data-com-confirmer]');
    if (conf) {
      conf.disabled = true;
      try { await supprimer(conf.dataset.id); fermerFenetre(); if (zoneActive) { changement(zoneActive); await charger(zoneActive); } }
      catch (err) { conf.closest('dialog').querySelector('.form-msg').textContent = messageErreur(err); conf.disabled = false; }
      return;
    }
    const a = e.target.closest('[data-com-act]');
    if (!a) return;
    const zone = a.closest('.commentaires');
    if (a.dataset.comAct === 'annuler') { await charger(zone); return; }
    const c = trouver(zone, a.dataset.id);
    if (!c) return;
    zoneActive = zone;
    try {
      switch (a.dataset.comAct) {
        case 'modifier': return formulaireModification(zone, c);
        case 'historique': return await historique(zone, c);
        case 'signaler': return formulaireSignalement(c);
        case 'supprimer': return confirmerSuppression(c);
        case 'masquer': a.disabled = true; await masquer(zone, c); changement(zone); return await charger(zone);
        case 'demasquer': a.disabled = true; await demasquer(zone, c); changement(zone); return await charger(zone);
      }
    } catch (err) { a.disabled = false; ouvrirFenetre(`<h2>Action impossible</h2><p>${echapper(messageErreur(err))}</p><div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button></div>`); }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.matches('[data-com-form]')) { e.preventDefault(); publier(f); }
    else if (f.matches('[data-com-edition]')) { e.preventDefault(); enregistrer(f); }
    else if (f.matches('[data-com-signal]')) { e.preventDefault(); signaler(f); }
  });

  document.addEventListener('input', (e) => {
    const form = e.target.closest('[data-com-form]');
    if (!form) return;
    const zone = form.closest('.commentaires');
    brouillons.set(`${zone.dataset.comType}|${zone.dataset.comCle}`, e.target.value);
    form.querySelector('[data-compteur]').textContent = e.target.value.length;
  });

  // Connexion, déconnexion, vérification : les sections ouvertes sont redessinées.
  surChangement(() => document.querySelectorAll('.commentaires[data-com-cle]').forEach(charger));
}
