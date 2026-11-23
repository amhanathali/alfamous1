// Historique des recherches (phase 3) : liste sous le champ de recherche.
// - Visiteur : gardé dans ce navigateur seulement.
// - Connecté : synchronisé sur toutes ses machines (décision de l'auteur, 23 nov. 2026) dans le document
//   privé historiques/{uid} (lu et écrit par son seul titulaire ; firestore.rules), fusionné avec la copie locale.
// 50 recherches au plus, la plus récente en premier ; ensuite les clés du lexique qui commencent par la saisie.
import { firebase, avecDelai } from './firebase.js';
import { session, surChangement } from './compte.js';
import { echapper } from './commentaires-format.js';
import { estArabe } from './arabe.js';
import { fusionnerHistoriques } from './historique-outils.js';

const $ = (s) => document.querySelector(s);
let liste = []; // [{ q, t }] — t = millisecondes
let proprietaire = null; // uid ou 'visiteur'
let attente = null; // minuterie d'envoi
let derniereLecture = 0;
let clesLexique = async () => [];
let avantSession = []; // recherches faites avant que le compte soit connu (chargement de la page)

const cleLocale = () => `historique:${proprietaire || 'visiteur'}`;
function lireLocal() {
  try { const l = JSON.parse(localStorage.getItem(cleLocale()) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}
function ecrireLocal() { try { localStorage.setItem(cleLocale(), JSON.stringify(liste)); } catch { /* navigation privée */ } }

// Lire le document distant, fusionner, réécrire s'il manque quelque chose d'un côté ou de l'autre.
async function synchroniser({ effacer = false } = {}) {
  const uid = session.utilisateur?.uid;
  if (!uid || uid !== proprietaire) return;
  try {
    const { db, F } = await firebase();
    const ref = F.doc(db, `historiques/${uid}`);
    await avecDelai(F.runTransaction(db, async (tr) => {
      const snap = await tr.get(ref);
      const distant = snap.exists() ? snap.data().recherches || [] : [];
      const fusion = effacer ? [] : fusionnerHistoriques(liste, distant);
      if (uid !== proprietaire) return;
      liste = fusion;
      if (effacer || JSON.stringify(fusion) !== JSON.stringify(distant)) {
        tr.set(ref, { recherches: fusion, majLe: F.serverTimestamp() });
      }
    }));
    derniereLecture = Date.now();
    ecrireLocal();
  } catch (e) { console.warn('Historique non synchronisé :', e?.code || e); }
}

const programmer = () => { clearTimeout(attente); attente = setTimeout(synchroniser, 1500); };

export function noterRecherche(q) {
  q = String(q || '').trim().slice(0, 200);
  if (!q) return;
  const item = { q, t: Date.now() };
  if (!session.pret) avantSession.push(item);
  liste = fusionnerHistoriques([item], liste);
  ecrireLocal();
  if (session.utilisateur) programmer();
}

function changerProprietaire() {
  const uid = session.utilisateur?.uid || 'visiteur';
  if (uid === proprietaire) return;
  proprietaire = uid;
  liste = fusionnerHistoriques(avantSession, lireLocal());
  avantSession = [];
  derniereLecture = 0;
  if (uid !== 'visiteur') synchroniser();
}

// ---------- Liste sous le champ ----------
let actif = -1;
let tape = false; // à l'arrivée dans le champ : toutes les recherches récentes ; ensuite, filtrées par la saisie

async function dessiner() {
  const zone = $('#historique');
  const saisie = tape ? $('#requete').value.trim() : '';
  const q = saisie.toLowerCase();
  const recentes = liste.filter((x) => !q || x.q.toLowerCase().includes(q)).slice(0, 12);
  let lexique = [];
  if (saisie) {
    try { lexique = (await clesLexique()).filter((k) => k.startsWith(saisie) && k !== saisie).sort((a, b) => a.localeCompare(b, 'ar')).slice(0, 8); } catch { /* lexique indisponible */ }
  }
  if ((tape && $('#requete').value.trim() !== saisie) || document.activeElement !== $('#requete')) return; // saisie changée entre-temps
  const ligne = (q2, href, note) => `<a href="${href}" data-historique="${echapper(q2)}" role="option"><span dir="ltr" class="${estArabe(q2) ? 'police-ar' : ''}">${echapper(q2)}</span><small>${note}</small></a>`;
  const note = session.utilisateur ? 'toutes vos machines' : 'ce navigateur';
  zone.innerHTML = (recentes.length ? `<h4>Recherches récentes <button type="button" data-historique-effacer>Effacer</button></h4>
      ${recentes.map((x) => ligne(x.q, `#/q/${encodeURIComponent(x.q)}`, note)).join('')}` : '')
    + (lexique.length ? `<h4>Lexique</h4>${lexique.map((k) => ligne(k, `#/lexique/${encodeURIComponent(k)}`, 'entrée du lexique')).join('')}` : '');
  zone.hidden = !zone.innerHTML;
  actif = -1;
}

function fermer() { $('#historique').hidden = true; actif = -1; }

function deplacer(sens) {
  const items = [...$('#historique').querySelectorAll('a')];
  if (!items.length) return;
  actif = (actif + sens + items.length) % items.length;
  items.forEach((a, i) => a.classList.toggle('actif', i === actif));
  items[actif].scrollIntoView({ block: 'nearest' });
}

export function initHistorique({ lexique } = {}) {
  if (lexique) clesLexique = lexique;
  const champ = $('#requete');
  champ.insertAdjacentHTML('afterend', '<div id="historique" class="historique" role="listbox" hidden></div>');
  champ.setAttribute('aria-controls', 'historique');
  champ.addEventListener('focus', () => {
    tape = false;
    // Une autre machine a pu ajouter des recherches : relecture au plus une fois par minute.
    if (session.utilisateur && Date.now() - derniereLecture > 60000) synchroniser().then(dessiner);
    dessiner();
  });
  champ.addEventListener('input', () => { tape = true; dessiner(); });
  champ.addEventListener('blur', () => setTimeout(fermer, 150));
  champ.addEventListener('keydown', (e) => {
    if ($('#historique').hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); deplacer(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); deplacer(-1); }
    else if (e.key === 'Escape') { fermer(); }
    else if (e.key === 'Enter' && actif >= 0) {
      e.preventDefault();
      const a = $('#historique').querySelectorAll('a')[actif];
      fermer(); champ.blur(); location.hash = a.getAttribute('href');
    }
  });
  $('#historique').addEventListener('mousedown', (e) => e.preventDefault()); // garder le champ actif
  $('#historique').addEventListener('click', (e) => {
    if (e.target.closest('[data-historique-effacer]')) {
      liste = []; ecrireLocal();
      if (session.utilisateur) synchroniser({ effacer: true });
      dessiner(); return;
    }
    if (e.target.closest('a')) { fermer(); champ.blur(); }
  });
  changerProprietaire();
  surChangement(changerProprietaire);
}
