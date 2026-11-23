// Lexique (phase 3, maquette acceptée le 23 nov. 2026 : docs/maquettes/lexique.html).
// Routes : #/lexique (liste) et #/lexique/<clé> (fiche d'une entrée).
//
// Une entrée n'est pas un document à part : ses définitions sont des commentaires de type « lexique »
// (clé = mot, racine ou expression, enregistrée sans voyelles). La liste est donc construite à partir
// de toutes les définitions, lues une fois par visite (environ 360 documents ; à revoir au-delà de
// quelques milliers). Publier, modifier, signaler, masquer : même code que les commentaires de versets.
import * as D from './donnees.js';
import { firebase, avecDelai } from './firebase.js';
import { session, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, messageErreur, TEXTE_MAX } from './commentaires-format.js';
import { afficherCommentaires, publierCommentaire } from './commentaires.js';
import { normaliserCle, estRacine, racinesProches, grouperEntrees, filtrerEntrees, CLE_MAX } from './lexique-outils.js';
import { estArabe } from './arabe.js';

const lienRequete = (q) => `#/q/${encodeURIComponent(q)}`;
export const lienEntree = (cle) => `#/lexique/${encodeURIComponent(cle)}`;
const pluriel = (n, mot) => `${n.toLocaleString('fr-CA')} ${mot}${n > 1 ? 's' : ''}`;
const arabeOuTexte = (t) => (estArabe(t) ? `<span class="ar" lang="ar">${echapper(t)}</span>` : `« ${echapper(t)} »`);

// ---------- Données ----------
let definitions = null; // Promise<[{ id, cle, texte, creeLe, masque }]>
const nombres = new Map(); // clé → nombre de définitions (requêtes de comptage)

export function toutesLesDefinitions() {
  if (!definitions) {
    definitions = (async () => {
      const { db, F } = await firebase();
      const q = F.query(F.collection(db, 'commentaires'), F.where('type', '==', 'lexique'));
      const snap = await avecDelai(F.getDocsFromServer(q), 15000);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    })().catch((e) => { definitions = null; throw e; });
  }
  return definitions;
}

// Nombre de définitions d'une clé (encadré des résultats, fiche d'un mot) : une requête de comptage,
// sans charger tout le lexique.
export async function nombreDefinitions(cle) {
  if (definitions) {
    const liste = await definitions.catch(() => null);
    if (liste) return liste.filter((d) => d.cle === cle).length;
  }
  if (!nombres.has(cle)) {
    const { db, F } = await firebase();
    const q = F.query(F.collection(db, 'commentaires'), F.where('type', '==', 'lexique'), F.where('cle', '==', cle));
    nombres.set(cle, (await avecDelai(F.getCountFromServer(q))).data().count);
  }
  return nombres.get(cle);
}

// Clés du lexique (suggestions sous le champ de recherche).
export async function clesLexique() {
  return [...new Set((await toutesLesDefinitions()).map((d) => d.cle))];
}

document.addEventListener('commentaire-publie', (e) => {
  if (e.detail?.type !== 'lexique') return;
  definitions = null;
  nombres.delete(e.detail.cle);
});

// ---------- Liste ----------
let filtre = 'toutes';
let saisie = '';

async function vueListe(contenu) {
  contenu.innerHTML = '<p class="message">Chargement du lexique…</p>';
  const [defs, racines] = await Promise.all([toutesLesDefinitions(), D.racines()]);
  const entrees = grouperEntrees(defs);
  const nbDefs = defs.filter((d) => !d.masque).length;
  contenu.innerHTML = `<div class="titre"><h1>Lexique</h1><span class="resume">${pluriel(entrees.length, 'entrée')} · ${pluriel(nbDefs, 'définition')}</span></div>
    <div class="barre-outils">
      <input id="filtre-lexique" class="filtre-lexique" type="search" dir="auto" autocomplete="off" spellcheck="false"
        placeholder="Chercher une clé ou un mot dans les définitions" value="${echapper(saisie)}" aria-label="Filtrer le lexique">
      ${session.niveau >= 1 ? '<button type="button" class="btn principal" data-lex="nouvelle">+ Nouvelle entrée</button>'
        : session.utilisateur ? '' : '<button type="button" class="lien-bouton" data-compte="connexion">Se connecter pour ajouter une entrée</button>'}
    </div>
    <div class="barre-outils">
      <div class="filtres">${[['toutes', 'Toutes'], ['racines', 'Racines du Coran'], ['autres', 'Expressions et autres']]
        .map(([k, l]) => `<button type="button" data-filtre-lex="${k}" class="${filtre === k ? 'actif' : ''}">${l}</button>`).join('')}</div>
      <span class="aide" id="lex-compte"></span>
    </div>
    <div class="liste-lex" id="liste-lex"></div>`;

  const dessiner = () => {
    let liste = filtrerEntrees(entrees, defs, saisie);
    if (filtre === 'racines') liste = liste.filter((e) => estRacine(e.cle, racines));
    else if (filtre === 'autres') liste = liste.filter((e) => !estRacine(e.cle, racines));
    contenu.querySelector('#lex-compte').textContent = liste.length === entrees.length ? 'ordre alphabétique arabe' : `${pluriel(liste.length, 'entrée')} sur ${entrees.length}`;
    contenu.querySelector('#liste-lex').innerHTML = liste.map((e) => {
      const racine = estRacine(e.cle, racines);
      const extrait = e.derniere ? e.derniere.texte.replace(/\s+/g, ' ').slice(0, 160) : 'Définition masquée par un modérateur.';
      return `<a class="lex-ligne" href="${lienEntree(e.cle)}">
        <span class="lex-cle"><span class="${estArabe(e.cle) ? 'ar' : ''}" lang="${estArabe(e.cle) ? 'ar' : 'fr'}">${echapper(e.cle)}</span>${racine ? '' : '<span class="etiquette">expression</span>'}</span>
        <span class="lex-droite"><b>${e.definitions}</b> définition${e.definitions > 1 ? 's' : ''}${racine ? `<br>${pluriel(racines[e.cle].length, 'occurrence')}` : ''}</span>
        <span class="lex-extrait" dir="auto">${echapper(extrait)}</span></a>`;
    }).join('') || `<p class="vide">${entrees.length ? 'Aucune entrée ne correspond.' : 'Le lexique est vide pour l\'instant.'}</p>`;
  };
  dessiner();
  const champ = contenu.querySelector('#filtre-lexique');
  champ.addEventListener('input', () => { saisie = champ.value; dessiner(); });
  contenu.querySelectorAll('[data-filtre-lex]').forEach((b) => b.addEventListener('click', () => {
    filtre = b.dataset.filtreLex;
    contenu.querySelectorAll('[data-filtre-lex]').forEach((x) => x.classList.toggle('actif', x === b));
    dessiner();
  }));
}

// ---------- Fiche d'une entrée ----------
let inverse = false;

async function vueEntree(contenu, cleBrute) {
  const cle = normaliserCle(cleBrute);
  if (!cle) { location.hash = '#/lexique'; return; }
  if (cle !== cleBrute) { location.replace(lienEntree(cle)); return; } // clé avec voyelles → forme enregistrée
  document.title = `${cle} — Lexique — Alfamous`;
  const racines = await D.racines();
  const racine = estRacine(cle, racines);
  let tete;
  if (racine) {
    const occ = racines[cle];
    const versets = new Set(occ.map((o) => o.split(':').slice(0, 2).join(':')));
    const sourates = new Set([...versets].map((v) => v.split(':')[0]));
    tete = `<div class="chiffres"><span><b>${occ.length.toLocaleString('fr-CA')}</b> occurrence${occ.length > 1 ? 's' : ''}</span>
        <span><b>${versets.size.toLocaleString('fr-CA')}</b> verset${versets.size > 1 ? 's' : ''}</span><span><b>${sourates.size}</b> sourate${sourates.size > 1 ? 's' : ''}</span></div>
      <div class="liens-entree"><a href="${lienRequete(`r:${cle}`)}">Voir les versets, les amis et les déclinaisons</a>
        <a href="${lienRequete(`m:${cle}`)}">Chercher comme mot</a></div>`;
  } else {
    tete = `<div class="liens-entree">${estArabe(cle) ? `<a href="${lienRequete(cle)}">Chercher dans le Coran</a>` : ''}</div>`;
  }
  const proches = racine || (estArabe(cle) && !/\s/.test(cle));
  contenu.innerHTML = `<a class="retour" href="#/lexique">← Tout le lexique</a>
    <section class="entree-tete">
      <div class="entree-haut">
        <div><h1 class="entree-cle" dir="auto"><span class="${estArabe(cle) ? 'ar' : ''}" lang="${estArabe(cle) ? 'ar' : 'fr'}">${echapper(cle)}</span></h1>
          <p class="aide">${racine ? 'Racine du Coran' : 'Entrée du lexique'}</p></div>
        <button type="button" class="btn" data-lex="copier-lien">Copier le lien</button>
      </div>
      ${tete}
      <p class="rappel">Le sens d'un mot se déduit de ses occurrences dans le Coran ; les définitions ci-dessous sont celles des membres.</p>
    </section>
    <div class="lexique bloc"><section class="commentaires" data-com-type="lexique" data-com-cle="${echapper(cle)}"><p class="aide">Chargement…</p></section></div>
    ${proches ? `<section class="bloc" id="proches"></section>` : ''}`;
  await Promise.all([
    afficherCommentaires(contenu.querySelector('.commentaires')),
    proches ? dessinerProches(contenu.querySelector('#proches'), cle, racines) : null,
  ]);
}

async function dessinerProches(zone, cle, racines) {
  const liste = racinesProches(cle, racines, { inverse });
  let avecEntree = new Set();
  try { avecEntree = new Set(await clesLexique()); } catch { /* lexique indisponible : pas de marque */ }
  const lettres = [...new Set([...cle])];
  const suites = inverse ? lettres.slice().reverse().join('') : lettres.join('');
  zone.innerHTML = `<h2>Racines proches (lettres communes) <small>${pluriel(liste.length, 'racine')}</small></h2>
    <div class="proches-opt"><span>Racines qui contiennent au moins deux lettres qui se suivent dans <span class="ar" lang="ar">${echapper(suites)}</span></span>
      <label><input type="checkbox" data-lex="inverse" ${inverse ? 'checked' : ''}> Sens inverse</label></div>
    ${liste.length ? `<div class="puces">${liste.map((r) => {
      const entree = avecEntree.has(r.racine);
      return `<a class="puce${entree ? ' avec-lex' : ''}" href="${entree ? lienEntree(r.racine) : lienRequete(`r:${r.racine}`)}"
        title="${entree ? 'Entrée du lexique' : 'Versets de la racine'}">${echapper(r.racine)}<small>${r.n}</small>${entree ? '<small class="pt">●</small>' : ''}</a>`;
    }).join('')}</div>` : '<p class="aide">Aucune racine proche.</p>'}
    <p class="legende">Le chiffre = occurrences dans le Coran · <span class="pt">●</span> = a une entrée au lexique (le clic ouvre l'entrée ; sinon, les versets).
      Rapprochement par les lettres seulement, pas par le sens.</p>`;
  zone.querySelector('[data-lex="inverse"]').addEventListener('change', (e) => { inverse = e.target.checked; dessinerProches(zone, cle, racines); });
}

// Nombre de racines proches (encadré des résultats).
export async function nombreProches(cle) {
  return racinesProches(cle, await D.racines()).length;
}

// ---------- Nouvelle entrée ----------
function fenetreNouvelle(cle = '', msg = '') {
  ouvrirFenetre(`<h2>Nouvelle entrée du lexique</h2>
    <form data-lex-nouvelle>
      <label>Clé : mot, racine ou expression (les voyelles seront retirées)
        <input name="cle" required maxlength="${CLE_MAX}" dir="auto" value="${echapper(cle)}" placeholder="بشر"></label>
      <label>Première définition
        <textarea name="texte" required maxlength="${TEXTE_MAX}" rows="6" placeholder="Texte simple ; renvois possibles : 2:255, r:أحد"></textarea></label>
      <p class="aide">Si la clé existe déjà, la définition s'ajoute à cette entrée. Publiée tout de suite, signée « ${echapper(session.nom)} ».</p>
      <p class="form-msg" role="alert">${echapper(msg)}</p>
      <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button class="btn principal">Publier</button></div>
    </form>`);
}

async function creerEntree(form) {
  const cle = normaliserCle(form.cle.value);
  const texte = form.texte.value.trim();
  const msg = form.querySelector('.form-msg');
  if (!cle) { msg.textContent = 'Indiquez une clé.'; return; }
  if (cle.length > CLE_MAX) { msg.textContent = `La clé dépasse ${CLE_MAX} caractères.`; return; }
  if (!texte) { msg.textContent = 'Écrivez la définition.'; return; }
  const bouton = form.querySelector('.principal');
  bouton.disabled = true; msg.textContent = '';
  try {
    await publierCommentaire('lexique', cle, texte);
    fermerFenetre();
    location.hash = lienEntree(cle);
  } catch (e) { msg.textContent = messageErreur(e); bouton.disabled = false; }
}

// ---------- Routage ----------
export async function routeLexique(contenu) {
  const m = location.hash.match(/^#\/lexique(?:\/(.*))?$/);
  if (!m) return false;
  try {
    if (m[1]) await vueEntree(contenu, decodeURIComponent(m[1]));
    else { document.title = 'Lexique — Alfamous'; await vueListe(contenu); }
  } catch (e) {
    contenu.innerHTML = `<p class="message erreur">Lexique indisponible : ${echapper(messageErreur(e))}</p>`;
  }
  return true;
}

export function initLexique() {
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-lex]');
    if (!b || b.dataset.lex === 'inverse') return;
    if (b.dataset.lex === 'nouvelle') fenetreNouvelle(saisie && !/[a-zà-ÿ]/i.test(saisie) ? saisie : '');
    if (b.dataset.lex === 'copier-lien') {
      try { await navigator.clipboard.writeText(location.href); b.textContent = 'Lien copié'; } catch { b.textContent = 'Copie impossible'; }
      setTimeout(() => { b.textContent = 'Copier le lien'; }, 1500);
    }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.matches('[data-lex-nouvelle]')) { e.preventDefault(); creerEntree(e.target); }
  });
}

// ---------- Encadré « Lexique » (résultats d'une racine, fiche d'un mot) ----------
export async function encadreLexique(zone, cle, { court = false } = {}) {
  if (!zone || !cle) return;
  try {
    const n = await nombreDefinitions(cle);
    const ar = arabeOuTexte(cle);
    if (n) {
      const proches = court ? 0 : await nombreProches(cle);
      zone.innerHTML = `<b>Lexique</b> : ${pluriel(n, 'définition')}${court ? '' : ` pour ${ar}`} · <a href="${lienEntree(cle)}">Ouvrir l'entrée</a>${proches ? ` · ${pluriel(proches, 'racine')} proche${proches > 1 ? 's' : ''}` : ''}`;
    } else {
      zone.innerHTML = `<b>Lexique</b> : pas encore d'entrée${court ? '' : ` pour ${ar}`}${session.niveau >= 1 ? ` · <a href="${lienEntree(cle)}">Proposer une définition</a>` : ` · <a href="${lienEntree(cle)}">Voir</a>`}`;
    }
    zone.hidden = false;
  } catch { zone.hidden = true; } // Firebase injoignable : pas d'encadré
}
