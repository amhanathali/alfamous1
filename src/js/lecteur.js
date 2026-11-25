// Écouter et suivre la lecture — fenêtre de lecture et suivi du verset dans la page.
// Maquette : docs/maquettes/lecteur.html ; cadrage : docs/LECTURE-AUDIO.md.
// La fenêtre est attachée à <body> (hors de #contenu) : elle reste ouverte quand on change d'onglet.
import * as D from './donnees.js';
import { analyserRequete } from './recherche.js';
import { NOMS_SOURATES } from './sourates.js';
import { creerLecteur, departDepuisSaisie, versetVoisin, RECITATION } from './lecteur-outils.js';

const ICONE_LIRE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>';
const ICONE_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
const trait = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nombre = (x) => String(x).replace('.', ',');
const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Bouton « écouter » placé à côté de la référence de chaque verset (carteVerset dans app.js).
export function boutonEcouter(s, v) {
  return `<button type="button" class="ecouter" data-ecouter="${s}:${v}" aria-label="Écouter à partir du verset ${s}:${v}" title="Écouter à partir de ce verset">${ICONE_LIRE}</button>`;
}

let lecteur = null;
let fenetre = null;
let contenu = null;
let naviguer = (hash) => { location.hash = hash; };
let nbVersets = null;
let origine = 'recherche'; // 'sourate' | 'page' | 'recherche' : vue d'où la lecture a été lancée
let attenteSuivi = null;   // minuterie du suivi après un rendu de la page
let forcerSuivi = false;   // départ demandé dans « Reprendre à » ou « Aller au verset » : la page doit suivre
const preferences = {
  lire(cle, defaut) { try { return localStorage.getItem(cle) ?? defaut; } catch { return defaut; } },
  ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch { /* navigation privée */ } },
};

// Vue affichée dans l'onglet Lecture : 'sourate' (sourate ou plage de versets), 'page', 'recherche', ou null (autre onglet).
function vueCourante() {
  const h = location.hash;
  if (h === '' || h === '#' || h === '#/') return 'recherche';
  const m = h.match(/^#\/q\/(.*)$/);
  if (!m) return null;
  const r = analyserRequete(decodeURIComponent(m[1]));
  if (r.type === 'sourate' || r.type === 'versets') return 'sourate';
  if (r.type === 'page') return 'page';
  return 'recherche';
}

function construireFenetre() {
  fenetre = document.createElement('section');
  fenetre.className = 'lecteur';
  fenetre.id = 'lecteur';
  fenetre.hidden = true;
  fenetre.setAttribute('role', 'region');
  fenetre.setAttribute('aria-label', 'Lecture audio');
  fenetre.innerHTML = `
    <div class="lecteur-plein">
      <div class="lecteur-tete">
        <span class="lecteur-ref" data-l="ref"></span>
        <span class="lecteur-sourate" data-l="sourate"></span>
        <button type="button" class="lecteur-icone" data-l="reduire" aria-label="Réduire la fenêtre de lecture" title="Réduire">${trait('M6 9l6 6 6-6')}</button>
        <button type="button" class="lecteur-icone" data-l="fermer" aria-label="Fermer et arrêter la lecture" title="Fermer (arrête la lecture)">${trait('M6 6l12 12M18 6L6 18')}</button>
      </div>
      <div class="lecteur-texte"><p class="ar" lang="ar" dir="rtl" data-l="ar"></p><p class="tr" data-l="tr"></p></div>
      <div class="lecteur-hors-page" data-l="hors-page" hidden>
        <span>Ce verset n'est pas affiché dans la page.</span>
        <button type="button" data-l="aller">Aller au verset</button>
      </div>
      <div class="lecteur-commandes">
        <button type="button" class="lecteur-icone" data-l="prec" aria-label="Verset précédent" title="Verset précédent">${trait('M7 6v12M18 6l-8 6 8 6z')}</button>
        <button type="button" class="lecteur-jouer" data-l="jouer"></button>
        <button type="button" class="lecteur-icone" data-l="suiv" aria-label="Verset suivant" title="Verset suivant">${trait('M17 6v12M6 6l8 6-8 6z')}</button>
        <button type="button" class="lecteur-vitesse" data-l="vitesse" title="Vitesse (clic pour changer)"></button>
      </div>
      <p class="lecteur-etat" data-l="etat" role="status"></p>
      <form class="lecteur-reprendre" data-l="form" novalidate>
        <label for="lecteur-saisie">Reprendre à</label>
        <input id="lecteur-saisie" type="text" autocomplete="off" spellcheck="false" dir="auto" placeholder="3.14 · 3 · p 3" aria-describedby="lecteur-erreur">
        <button type="submit">Lire</button>
      </form>
      <p class="lecteur-erreur" id="lecteur-erreur" data-l="erreur" role="alert" hidden></p>
      <p class="lecteur-source">Récitation : ${echapper(RECITATION.nom)} · ${echapper(RECITATION.source)}</p>
    </div>
    <div class="lecteur-pastille">
      <button type="button" class="lecteur-jouer" data-l="jouer2"></button>
      <span class="lecteur-ref" data-l="ref2"></span>
      <button type="button" class="lecteur-icone" data-l="agrandir" aria-label="Agrandir la fenêtre de lecture" title="Agrandir">${trait('M6 15l6-6 6 6')}</button>
      <button type="button" class="lecteur-icone" data-l="fermer2" aria-label="Fermer et arrêter la lecture" title="Fermer (arrête la lecture)">${trait('M6 6l12 12M18 6L6 18')}</button>
    </div>
    <p class="lecteur-annonce" aria-live="polite" data-l="annonce"></p>`;
  document.body.append(fenetre);
}
const el = (nom) => fenetre.querySelector(`[data-l="${nom}"]`);

function reduire(oui) {
  fenetre.classList.toggle('reduit', oui);
  document.body.classList.toggle('lecteur-reduit', oui);
  (oui ? el('agrandir') : el('reduire')).focus();
}
function ouvrir() {
  fenetre.hidden = false;
  document.body.classList.add('lecteur-ouvert');
}
function fermer() {
  lecteur.arreter();
  fenetre.hidden = true;
  fenetre.classList.remove('reduit');
  document.body.classList.remove('lecteur-ouvert', 'lecteur-reduit');
  marquer(null);
}

// ---------- Mise à jour de la fenêtre ----------
let dernierVerset = '';
async function majFenetre(etat) {
  if (etat.s == null) return;
  const cle = `${etat.s}:${etat.v}`;
  for (const b of [el('jouer'), el('jouer2')]) {
    b.innerHTML = etat.enLecture ? ICONE_PAUSE : ICONE_LIRE;
    b.setAttribute('aria-label', etat.enLecture ? 'Pause' : 'Lecture');
    b.title = etat.enLecture ? 'Pause' : 'Lecture';
  }
  el('vitesse').textContent = `${nombre(etat.vitesse)}×`;
  el('vitesse').setAttribute('aria-label', `Vitesse de lecture : ${nombre(etat.vitesse)} fois`);
  el('prec').disabled = cle === '1:1';
  el('suiv').disabled = cle === '114:6';
  el('etat').textContent = etat.message;
  if (cle === dernierVerset) return;
  dernierVerset = cle;
  el('ref').textContent = el('ref2').textContent = cle;
  const [ar, lat] = NOMS_SOURATES[etat.s - 1] || ['', ''];
  el('sourate').textContent = `${lat} · ${ar}`;
  el('annonce').textContent = `Verset ${cle}`;
  suivre(etat.s, etat.v);
  try {
    const t = await D.texte(etat.s);
    if (dernierVerset !== cle) return; // un autre verset a été demandé entre-temps
    const x = t.versets.find((y) => y.v === etat.v);
    el('ar').textContent = x?.ar || '';
    el('tr').textContent = x?.tr || '';
  } catch { el('ar').textContent = ''; el('tr').textContent = ''; }
}

// ---------- Suivi dans la page ----------
function marquer(carte) {
  for (const c of document.querySelectorAll('.verset.en-lecture')) if (c !== carte) c.classList.remove('en-lecture');
  if (carte) carte.classList.add('en-lecture');
}
function carteDe(s, v) { return contenu.querySelector(`.verset[data-cle="${s}:${v}"]`); }

// Cherche le verset en cours dans la page ; s'il n'y est pas, applique la règle décidée par l'auteur :
// lecture lancée depuis une sourate ou une page → la page suit ; depuis une recherche → « Aller au verset ».
// La page ne suit que si elle suivait déjà (verset précédent affiché) : si l'on consulte une autre sourate
// pendant l'écoute, elle n'est pas ramenée de force.
async function suivre(s, v, { naviguerSiAbsent = true } = {}) {
  const vue = vueCourante();
  if (!vue) { el('hors-page').hidden = true; return; } // autre onglet : la page ne bouge pas
  const carte = carteDe(s, v);
  if (carte) {
    el('hors-page').hidden = true;
    marquer(carte);
    clearTimeout(attenteSuivi);
    // Après le rendu (le routeur remonte en haut de page à la fin) : le verset est placé entre l'en-tête
    // (fixe en haut) et la fenêtre de lecture (en bas), avec un défilement minimal.
    attenteSuivi = setTimeout(() => {
      const racine = document.documentElement.style;
      const entete = document.querySelector('.entete');
      const fixe = entete && getComputedStyle(entete).position === 'sticky';
      racine.setProperty('--marge-haut-lecture', `${(fixe ? entete.offsetHeight : 0) + 12}px`);
      racine.setProperty('--marge-bas-lecture', `${fenetre.hidden ? 12 : window.innerHeight - fenetre.getBoundingClientRect().top + 12}px`);
      carte.scrollIntoView({ block: 'nearest', behavior: reduitMouvement() ? 'auto' : 'smooth' });
    }, 80);
    return;
  }
  marquer(null);
  const avant = versetVoisin(nbVersets, s, v, -1);
  const suivait = forcerSuivi || (avant && carteDe(...avant));
  forcerSuivi = false;
  if (!naviguerSiAbsent || !suivait || origine === 'recherche' || vue === 'recherche') { el('hors-page').hidden = false; return; }
  el('hors-page').hidden = true;
  // Même sourate, liste incomplète : charger les versets suivants (bouton « Afficher … versets de plus »).
  const plus = contenu.querySelector('button.plus');
  const derniere = [...contenu.querySelectorAll('.verset[data-cle]')].pop();
  if (plus && derniere && derniere.dataset.cle.split(':')[0] === String(s)) { plus.click(); return; }
  if (origine === 'page') {
    const t = await D.texte(s);
    const page = t.versets.find((y) => y.v === v)?.page;
    if (page) { naviguer(`#/q/${encodeURIComponent(`p ${page}`)}`); return; }
  }
  naviguer(versDepuis(s, v));
}
const versDepuis = (s, v) => `#/q/${v === 1 ? s : `${s}:${v}-${nbVersets[s]}`}`;

// ---------- Initialisation ----------
export async function initLecteur({ contenu: zone, naviguer: nav }) {
  contenu = zone;
  if (nav) naviguer = nav;
  construireFenetre();
  const sourates = await D.sourates();
  nbVersets = [0, ...sourates.map((x) => x.versets)];
  const audio = new Audio();
  audio.preload = 'auto';
  const precharge = new Audio();
  precharge.preload = 'auto';
  precharge.muted = true;
  lecteur = creerLecteur({ audio, precharge, nbVersets, surChangement: majFenetre });
  const vitesse = Number(preferences.lire('lecteurVitesse', '1'));
  lecteur.regleVitesse(vitesse);

  // Bouton « écouter » d'un verset (délégation : les cartes sont redessinées à chaque recherche).
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ecouter]');
    if (!b) return;
    const [s, v] = b.dataset.ecouter.split(':').map(Number);
    origine = vueCourante() || 'recherche';
    dernierVerset = '';
    ouvrir();
    lecteur.jouerDepuis(s, v); // dans le geste de l'utilisateur (Safari)
  });

  for (const nom of ['jouer', 'jouer2']) el(nom).addEventListener('click', () => lecteur.basculer());
  el('prec').addEventListener('click', () => lecteur.aller(-1));
  el('suiv').addEventListener('click', () => lecteur.aller(1));
  el('vitesse').addEventListener('click', () => { lecteur.vitesseSuivante(); preferences.ecrire('lecteurVitesse', String(lecteur.etat.vitesse)); });
  el('reduire').addEventListener('click', () => reduire(true));
  el('agrandir').addEventListener('click', () => reduire(false));
  el('fermer').addEventListener('click', fermer);
  el('fermer2').addEventListener('click', fermer);
  el('aller').addEventListener('click', () => {
    const { s, v } = lecteur.etat;
    origine = 'sourate';
    el('hors-page').hidden = true;
    naviguer(versDepuis(s, v));
  });
  fenetre.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !fenetre.classList.contains('reduit')) { e.stopPropagation(); reduire(true); }
  });

  // « Reprendre à » : même règles que le champ de recherche.
  el('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = el('form').querySelector('input');
    // L'élément audio a déjà été « débloqué » par le bouton écouter qui a ouvert la fenêtre :
    // la lecture peut donc démarrer après l'attente (iPhone compris).
    const r = await departDepuisSaisie(champ.value, { sourates, texte: D.texte });
    el('erreur').textContent = r.erreur || '';
    el('erreur').hidden = !r.erreur;
    if (r.erreur) return;
    // « p 3 » suit les pages ; « 3 » ou « 3.14 » suit la sourate.
    origine = analyserRequete(champ.value).type === 'page' ? 'page' : 'sourate';
    champ.value = '';
    forcerSuivi = true;
    dernierVerset = '';
    lecteur.jouerDepuis(r.s, r.v);
  });

  // Quand la page est redessinée (recherche, retour à l'onglet Lecture, versets de plus) : retrouver le verset.
  new MutationObserver(() => {
    const { s, v } = lecteur.etat;
    if (fenetre.hidden || s == null) return;
    const carte = carteDe(s, v);
    if (carte && !carte.classList.contains('en-lecture')) suivre(s, v, { naviguerSiAbsent: false });
    else if (!carte) { marquer(null); el('hors-page').hidden = !vueCourante(); }
  }).observe(contenu, { childList: true, subtree: true });
}
