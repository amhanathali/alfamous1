// Onglet « Membres » (admins seulement ; maquette acceptée le 23 nov. 2026 : docs/maquettes/membres.html).
// Route : #/membres. Liste des inscrits, nombres de contributions, changement de niveau avec confirmation, journal.
// Tout passe par les Cloud Functions « membres » et « changerNiveau » (functions/index.js), qui vérifient que
// l'appelant est admin : la liste des comptes et le niveau ne sont jamais lisibles ni modifiables autrement.
import { firebase } from './firebase.js';
import { session, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, messageErreur } from './commentaires-format.js';

const NIVEAUX = ['0 · bloqué', '1 · membre', '2 · modérateur', '3 · admin'];
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const date = (ms) => (ms ? new Date(ms).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const dateHeure = (ms) => (ms ? new Date(ms).toLocaleString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const nb = (n) => (n === null || n === undefined ? '?' : n);

let donnees = null; // { membres, journal }
let filtre = 'tous';
let saisie = '';

async function appeler(nom, data) {
  const { fonctions, Fn } = await firebase();
  return (await Fn.httpsCallable(fonctions, nom, { timeout: 60000 })(data)).data;
}

function filtrer(liste) {
  const q = saisie.trim().toLowerCase();
  return liste.filter((m) => (!q || m.nom.toLowerCase().includes(q) || m.courriel.toLowerCase().includes(q))
    && (filtre === 'tous' || (filtre === 'admins' && m.niveau === 3) || (filtre === 'modos' && m.niveau === 2)
      || (filtre === 'bloques' && m.bloque) || (filtre === 'nonverifies' && !m.verifie)));
}

function celluleNiveau(m) {
  if (m.uid === session.utilisateur?.uid) return `<span title="Vous ne pouvez pas changer votre propre niveau">${NIVEAUX[m.niveau]}</span>`;
  if (!m.verifie) return '<span class="aide" title="Le niveau 1 arrive tout seul quand le courriel est vérifié">0 · en attente</span>';
  return `<select data-membre="${echapper(m.uid)}" aria-label="Niveau de ${echapper(m.nom || m.courriel)}">
    ${NIVEAUX.map((l, i) => `<option value="${i}"${i === m.niveau ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
}

function dessiner(contenu) {
  const { membres, journal } = donnees;
  const liste = filtrer(membres);
  const n = (k) => membres.filter((m) => m.niveau === k && m.verifie).length;
  contenu.innerHTML = `<div class="titre"><h1>Membres</h1>
      <span class="resume">${pluriel(membres.length, 'inscrit')} · ${pluriel(n(3), 'admin')} · ${pluriel(n(2), 'modérateur')} · plus récents en premier</span></div>
    <div class="barre-outils">
      <input id="filtre-membres" class="filtre-lexique" type="search" autocomplete="off" placeholder="Chercher un nom ou un courriel" value="${echapper(saisie)}" aria-label="Chercher un membre">
      <button type="button" class="btn" data-membres="recharger">Actualiser</button>
    </div>
    <div class="barre-outils"><div class="filtres">${[['tous', 'Tous'], ['admins', 'Admins'], ['modos', 'Modérateurs'], ['bloques', 'Bloqués'], ['nonverifies', 'Courriel non vérifié']]
      .map(([k, l]) => `<button type="button" data-filtre-membres="${k}" class="${filtre === k ? 'actif' : ''}">${l}</button>`).join('')}</div>
      <span class="aide">${liste.length === membres.length ? '' : `${liste.length} sur ${membres.length}`}</span></div>
    <table class="membres">
      <thead><tr><th>Membre</th><th>Courriel vérifié</th><th>Inscrit le</th><th>Dernière connexion</th>
        <th title="Commentaires de versets + définitions du lexique">Commentaires</th><th title="Fils publiés + réponses">Forum</th><th>Niveau</th></tr></thead>
      <tbody>${liste.map((m) => `<tr class="${m.bloque ? 'bloque' : ''}">
        <td data-l="Membre"><span class="nom">${echapper(m.nom || '(sans nom)')}</span>${m.uid === session.utilisateur?.uid ? ' <span class="toi">vous</span>' : ''}<span class="courriel">${echapper(m.courriel)}</span></td>
        <td data-l="Vérifié">${m.verifie ? '<span class="pastille ok">vérifié</span>' : '<span class="pastille non">non vérifié</span>'}</td>
        <td data-l="Inscrit le" class="date">${date(m.creeLe)}</td>
        <td data-l="Connexion" class="date">${date(m.vuLe)}</td>
        <td data-l="Commentaires" class="nombre" title="${nb(m.commentaires)} commentaire(s) de versets + ${nb(m.definitions)} définition(s) du lexique">${m.commentaires === null || m.definitions === null ? '?' : m.commentaires + m.definitions}</td>
        <td data-l="Forum" class="nombre" title="${nb(m.fils)} fil(s) publié(s) + ${nb(m.reponses)} réponse(s)">${m.fils === null || m.reponses === null ? '?' : m.fils + m.reponses}</td>
        <td data-l="Niveau" class="col-niveau">${celluleNiveau(m)}</td></tr>`).join('')
        || '<tr><td colspan="7" class="vide">Aucun membre ne correspond.</td></tr>'}</tbody></table>
    <section class="panneau journal-niveaux"><h2>Journal des changements de niveau</h2>
      ${journal.length ? journal.map((j) => `<p>${dateHeure(j.le)} · <b>${echapper(j.parNom)}</b> : ${echapper(j.cibleNom)} ${NIVEAUX[j.avant] ?? j.avant} → <b>${NIVEAUX[j.apres] ?? j.apres}</b></p>`).join('')
        : '<p>Aucun changement pour l\'instant.</p>'}</section>`;

  const champ = contenu.querySelector('#filtre-membres');
  champ.addEventListener('input', () => {
    saisie = champ.value;
    const p = champ.selectionStart;
    dessiner(contenu);
    const c = contenu.querySelector('#filtre-membres'); c.focus(); c.setSelectionRange(p, p);
  });
}

function confirmer(m, apres) {
  const nom = `<b>${echapper(m.nom || m.courriel)}</b>`;
  const quoi = apres === 0 ? `Bloquer ${nom} ? Il pourra encore lire, mais plus rien écrire ; ses sessions seront fermées. Ses contenus déjà publiés restent (à masquer à part si besoin).`
    : apres === 3 ? `Nommer ${nom} admin ? Il pourra tout supprimer et changer les niveaux des autres membres.`
      : apres === 2 ? `Nommer ${nom} modérateur ? Il pourra masquer les contenus et voir les signalements.`
        : `Remettre ${nom} simple membre ?`;
  ouvrirFenetre(`<h2>Changer le niveau</h2><p>${quoi}</p>
    <p class="aide">${NIVEAUX[m.niveau]} → ${NIVEAUX[apres]} · pris en compte au prochain rechargement de sa page.</p>
    <p class="form-msg" role="alert"></p>
    <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button>
      <button type="button" class="btn ${apres === 0 ? 'danger-plein' : 'principal'}" data-membres-confirmer="${echapper(m.uid)}" data-niveau="${apres}">Confirmer</button></div>`);
}

async function charger(contenu) {
  contenu.innerHTML = '<p class="message">Chargement des membres…</p>';
  try {
    donnees = await appeler('membres');
    dessiner(contenu);
  } catch (e) {
    contenu.innerHTML = `<p class="message erreur">Liste des membres indisponible : ${echapper(messageErreur(e))}</p>`;
  }
}

export async function routeMembres(contenu) {
  if (location.hash !== '#/membres') return false;
  document.title = 'Membres — Alfamous';
  if (!session.pret) { contenu.innerHTML = '<p class="message">Chargement…</p>'; return true; }
  if (session.niveau < 3) { contenu.innerHTML = '<p class="message">Réservé aux admins.</p>'; return true; }
  await charger(contenu);
  return true;
}

export function initMembres(contenu) {
  contenu.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filtre-membres]');
    if (f && donnees) { filtre = f.dataset.filtreMembres; dessiner(contenu); return; }
    if (e.target.closest('[data-membres="recharger"]')) charger(contenu);
  });
  contenu.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-membre]');
    if (!s || !donnees) return;
    const m = donnees.membres.find((x) => x.uid === s.dataset.membre);
    const apres = Number(s.value);
    s.value = String(m.niveau); // le menu ne change qu'après confirmation
    if (apres !== m.niveau) confirmer(m, apres);
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-membres-confirmer]');
    if (!b) return;
    const msg = b.closest('dialog')?.querySelector('.form-msg');
    b.disabled = true;
    try {
      await appeler('changerNiveau', { uid: b.dataset.membresConfirmer, niveau: Number(b.dataset.niveau) });
      fermerFenetre();
      await charger(contenu);
    } catch (err) {
      if (msg) msg.textContent = messageErreur(err);
      b.disabled = false;
    }
  });
}
