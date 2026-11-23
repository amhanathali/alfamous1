// Alfamous1 — interface de lecture et de recherche ; comptes et commentaires (phase 2).
import * as D from './donnees.js';
import {
  analyserRequete, chercherMots, chercherRacines, amisRacine, trierAmis,
  declinaisons, statistiquesRacines, repartitionParSourate,
} from './recherche.js';
import { NOMS_SOURATES } from './sourates.js';
import { initCompte, surChangement } from './compte.js';
import { initNotes, routeNotes, menuNotes } from './notes.js';
import { initCommentaires, boutonCommentaires } from './commentaires.js';

const $ = (sel, racine = document) => racine.querySelector(sel);
const contenu = $('#contenu');
const fiche = $('#fiche-mot');
const PAR_PAGE = 50;

const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lienRequete = (q) => `#/q/${encodeURIComponent(q)}`;
const nomSourate = (s) => NOMS_SOURATES[s - 1] || ['', ''];
const pluriel = (n, mot) => `${n.toLocaleString('fr-CA')} ${mot}${n > 1 ? 's' : ''}`;

const preferences = {
  lire(cle, defaut) { try { return localStorage.getItem(cle) ?? defaut; } catch { return defaut; } },
  ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch { /* navigation privée */ } },
};

let traductionActive = null; // { id, nom, carte: Map « s:v » → texte }
let nbVersets = []; // nombre de versets par sourate (index = numéro de sourate)

// Verset voisin (précédent : sens = -1, suivant : sens = 1), en passant d'une sourate à l'autre.
function voisin(s, v, sens) {
  if (sens < 0) return v > 1 ? [s, v - 1] : s > 1 ? [s - 1, nbVersets[s - 1]] : null;
  return v < nbVersets[s] ? [s, v + 1] : s < 114 ? [s + 1, 1] : null;
}
const ICONE_HAUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const ICONE_BAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const options = () => ({
  motEntier: $('#mot-entier').checked,
  contigus: $('#contigus').checked,
  dansTraduction: $('#source').value === 'traduction' && !!traductionActive,
});

// ---------- Liste de versets ----------
// items : [{ s, v, positions?, dansTraduction? }]
async function afficherVersets(items, { titre, resume, avant = '', surligner = true, cible = null, vide = 'Aucun verset ne correspond.' }) {
  const zone = cible || contenu;
  if (!cible) zone.innerHTML = `<div class="titre">${titre}<span class="resume">${resume || ''}</span></div>${avant}`;
  zone.insertAdjacentHTML('beforeend', '<div class="liste"></div>');
  const liste = zone.querySelector('.liste:last-of-type');
  if (!items.length) { liste.innerHTML = `<p class="message">${vide}</p>`; return; }
  let affiches = 0;
  const suite = async () => {
    const lot = items.slice(affiches, affiches + PAR_PAGE);
    affiches += lot.length;
    const sourates = [...new Set(lot.map((x) => x.s))];
    const [textes, motsS] = await Promise.all([
      Promise.all(sourates.map(D.texte)),
      Promise.all(sourates.map((s) => D.mots(s).catch(() => null))),
    ]);
    const parS = new Map(sourates.map((s, i) => [s, { t: textes[i], m: motsS[i] }]));
    liste.insertAdjacentHTML('beforeend', lot.map((it) => {
      const { t, m } = parS.get(it.s);
      const x = t.versets.find((y) => y.v === it.v);
      return x ? carteVerset(it.s, x, m?.versets[it.v], surligner ? it : null) : '';
    }).join(''));
    zone.querySelector('.plus')?.remove();
    if (affiches < items.length) {
      liste.insertAdjacentHTML('afterend', `<button class="plus">Afficher ${Math.min(PAR_PAGE, items.length - affiches)} versets de plus (${items.length - affiches} restants)</button>`);
      zone.querySelector('.plus').onclick = suite;
    }
  };
  await suite();
}

function surlignerMots(texte, positions, attributs = () => '') {
  const set = new Set(positions || []);
  return texte.split(/\s+/).map((w, i) => `<span class="mot${set.has(i) ? ' surligne' : ''}"${attributs(i)}>${echapper(w)}</span>`).join(' ');
}

function boutonsVoisins(s, v) {
  const avant = voisin(s, v, -1); const apres = voisin(s, v, 1);
  const bouton = (cible, sens, icone, libelle) => (cible
    ? `<button type="button" class="voisin" data-voisin="${sens}" title="Afficher le verset ${libelle} (${cible.join(':')})" aria-label="Afficher le verset ${libelle} ${cible.join(':')}">${sens < 0 ? icone : ''}<span>${cible.join(':')}</span>${sens > 0 ? icone : ''}</button>`
    : '');
  return `<div class="voisins">${bouton(avant, -1, ICONE_HAUT, 'précédent')}${bouton(apres, 1, ICONE_BAS, 'suivant')}</div>`;
}

function carteVerset(s, x, motsVerset, resultat, contexte = false) {
  const nbMots = x.ar.split(/\s+/).length;
  const cliquable = motsVerset && motsVerset.length === nbMots;
  const posAr = resultat && !resultat.dansTraduction ? resultat.positions : null;
  const ar = surlignerMots(x.ar, posAr, (i) => (cliquable ? ` tabindex="0" data-ref="${s}:${x.v}:${i}"` : ''));
  const trad = traductionActive?.carte.get(`${s}:${x.v}`);
  const tradHtml = trad ? (resultat?.dansTraduction ? surlignerMots(trad, resultat.positions) : echapper(trad)) : '';
  return `<article class="verset${contexte ? ' contexte' : ''}" data-cle="${s}:${x.v}">
    <div class="verset-entete"><a class="ref" href="${lienRequete(`${s}:${x.v}`)}">${s}:${x.v}</a><span>${echapper(nomSourate(s)[1])} · page ${x.page ?? '?'}</span></div>
    <p class="ar" lang="ar">${ar}</p>
    <p class="tr">${echapper(x.tr)}</p>
    ${trad ? `<p class="trad"><span class="trad-source" title="Commentaire traditionnel, cité pour la comparaison">${echapper(traductionActive.nom)} (tradition)</span> ${tradHtml}</p>` : ''}
    <div class="verset-pied">${nbVersets.length ? boutonsVoisins(s, x.v) : '<span></span>'}${boutonCommentaires(`${s}:${x.v}`)}</div>
  </article>`;
}

// Afficher le verset précédent ou suivant juste au-dessus ou au-dessous de la carte.
contenu.addEventListener('click', async (e) => {
  const bouton = e.target.closest('[data-voisin]');
  if (!bouton) return;
  const carte = bouton.closest('.verset');
  const [s, v] = carte.dataset.cle.split(':').map(Number);
  const sens = Number(bouton.dataset.voisin);
  const cible = voisin(s, v, sens);
  if (!cible) return;
  const cle = cible.join(':');
  const adjacente = sens < 0 ? carte.previousElementSibling : carte.nextElementSibling;
  if (adjacente?.dataset?.cle === cle) { adjacente.classList.remove('eclair'); void adjacente.offsetWidth; adjacente.classList.add('eclair'); return; }
  bouton.disabled = true;
  try {
    const [t, m] = await Promise.all([D.texte(cible[0]), D.mots(cible[0]).catch(() => null)]);
    const x = t.versets.find((y) => y.v === cible[1]);
    carte.insertAdjacentHTML(sens < 0 ? 'beforebegin' : 'afterend', carteVerset(cible[0], x, m?.versets[cible[1]], null, true));
    const nouvelle = sens < 0 ? carte.previousElementSibling : carte.nextElementSibling;
    nouvelle.classList.add('eclair');
    if (sens < 0) nouvelle.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } finally { bouton.disabled = false; }
});

// ---------- Fiche d'un mot (au clic) ----------
async function ouvrirFiche(ref) {
  const [s, v, i] = ref.split(':').map(Number);
  const [m, t] = await Promise.all([D.mots(s), D.texte(s)]);
  const w = m.versets[v]?.[i];
  if (!w) return;
  const [tr, racineMot, ar, sens] = w;
  const racine = t.versets.find((x) => x.v === v)?.racines[i] || racineMot;
  fiche.innerHTML = `<button class="fermer" aria-label="Fermer">×</button>
    <p class="ar" lang="ar">${echapper(ar)}</p>
    <dl>
      <dt>Lecture</dt><dd><em>${echapper(tr)}</em></dd>
      <dt>Racine</dt><dd><a href="${lienRequete(`r:${racine}`)}" lang="ar" class="ar lien-racine">${echapper(racine)}</a></dd>
      <dt>Sens</dt><dd>${echapper(sens) || '—'}</dd>
      <dt>Position</dt><dd>${s}:${v}, mot ${i + 1}</dd>
    </dl>
    <p class="fiche-actions"><a href="${lienRequete(`m:${ar}`)}">Chercher ce mot</a></p>`;
  fiche.hidden = false;
  $('.fermer', fiche).onclick = () => { fiche.hidden = true; };
}
contenu.addEventListener('click', (e) => { const el = e.target.closest('.mot[data-ref]'); if (el) ouvrirFiche(el.dataset.ref); });
contenu.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const el = e.target.closest('.mot[data-ref]'); if (el) ouvrirFiche(el.dataset.ref); } });
fiche.addEventListener('click', (e) => { if (e.target.closest('a')) fiche.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fiche.hidden = true; });

// ---------- Vues simples ----------
async function vueAccueil() {
  const liste = await D.sourates();
  contenu.innerHTML = `<div class="intro">
      <p>Cherchez un verset (<a href="${lienRequete('2:255')}">2:255</a>), une sourate, une page (<a href="${lienRequete('p 50')}">p 50</a>),
      un ou plusieurs mots en arabe ou en lettres latines, ou une ou plusieurs racines.</p>
      <ul>
        <li><b>Plusieurs termes</b> : séparez-les par un espace ou « + ». Les versets affichés contiennent <b>tous</b> les termes.
          Exemples : <a href="${lienRequete('رحم غفر')}" lang="ar">رحم غفر</a> (deux racines), <a href="${lienRequete('رحمن رحيم')}" lang="ar">رحمن رحيم</a> (deux mots).</li>
        <li><b>Mots contigus</b> : les termes doivent se suivre (dans n'importe quel ordre).</li>
        <li><b>Mot entier</b> : le mot doit être exactement le terme, et pas seulement le contenir.</li>
        <li>Préfixes : <code>r:</code> force la recherche par racine, <code>m:</code> par mot.
          Les lettres ا و ي non tapées sont ignorées, comme dans l'ancienne application (« كتب » trouve ٱلْكِتَـٰبُ).</li>
        <li>Cliquez sur un mot arabe pour voir sa lecture, sa racine et son sens. <a href="#/stats">Statistiques des racines</a>.</li>
      </ul></div>
    <div class="grille-sourates">${liste.map((x) => `<a href="${lienRequete(String(x.n))}">
      <span class="n">${x.n}</span><span>${echapper(nomSourate(x.n)[1])}</span><span class="ar" lang="ar">${echapper(nomSourate(x.n)[0])}</span></a>`).join('')}</div>`;
}

async function vueSourate(s, de = 1, a = null) {
  const liste = await D.sourates();
  const info = liste.find((x) => x.n === s);
  if (!info) return message(`La sourate ${s} n'existe pas (1 à 114).`);
  const fin = Math.min(a ?? info.versets, info.versets);
  if (de < 1 || de > info.versets) return message(`La sourate ${s} compte ${info.versets} versets.`);
  const items = [];
  for (let v = de; v <= fin; v++) items.push({ s, v });
  const [ar, lat] = nomSourate(s);
  const plage = de === 1 && fin === info.versets ? `${info.versets} versets · pages ${info.pageDebut}–${info.pageFin}` : `versets ${de}${fin > de ? `–${fin}` : ''} sur ${info.versets}`;
  const basmala = info.basmala && de === 1 ? '<p class="basmala ar" lang="ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>' : '';
  await afficherVersets(items, { titre: `<h1>${s}. ${echapper(lat)} <span class="ar" lang="ar">${echapper(ar)}</span></h1>`, resume: plage, avant: basmala, surligner: false });
  contenu.insertAdjacentHTML('beforeend', `<nav class="nav">${s > 1 ? `<a href="${lienRequete(String(s - 1))}">← ${s - 1}. ${echapper(nomSourate(s - 1)[1])}</a>` : '<span></span>'}
    ${s < 114 ? `<a href="${lienRequete(String(s + 1))}">${s + 1}. ${echapper(nomSourate(s + 1)[1])} →</a>` : ''}</nav>`);
}

async function vuePage(p) {
  if (p < 1 || p > 604) return message('Les pages vont de 1 à 604.');
  const liste = await D.sourates();
  const concernees = liste.filter((x) => x.pageDebut <= p && x.pageFin >= p).map((x) => x.n);
  const textes = await Promise.all(concernees.map(D.texte));
  const items = textes.flatMap((t) => t.versets.filter((x) => x.page === p).map((x) => ({ s: t.sourate, v: x.v })));
  await afficherVersets(items, { titre: `<h1>Page ${p}</h1>`, resume: pluriel(items.length, 'verset'), surligner: false });
  contenu.insertAdjacentHTML('beforeend', `<nav class="nav">${p > 1 ? `<a href="${lienRequete(`p ${p - 1}`)}">← page ${p - 1}</a>` : '<span></span>'}${p < 604 ? `<a href="${lienRequete(`p ${p + 1}`)}">page ${p + 1} →</a>` : ''}</nav>`);
}

function modeTexte() {
  const o = options();
  return [o.motEntier ? 'mot entier' : 'partie de mot', o.contigus ? 'contigus' : null].filter(Boolean).join(' · ');
}

// Si « Mots contigus » ne donne rien, on indique combien de versets contiennent tous les termes.
function aideContigus(nbSansContigus) {
  if (!nbSansContigus) return 'Aucun verset ne correspond.';
  return `Aucun verset où ces termes <b>se suivent</b>. ${pluriel(nbSansContigus, 'verset')} les contien${nbSansContigus > 1 ? 'nent' : 't'} tous à des places différentes :
    <button class="lien-bouton" data-sans-contigus>décocher « Mots contigus »</button>.`;
}
contenu.addEventListener('click', (e) => {
  if (!e.target.closest('[data-sans-contigus]')) return;
  $('#contigus').checked = false;
  $('#contigus').dispatchEvent(new Event('change'));
});

function blocRepartition(resultats) {
  const rep = repartitionParSourate(resultats);
  if (!rep.length) return '';
  const max = Math.max(...rep.map((x) => x.n));
  const parS = new Map(rep.map((x) => [x.s, x.n]));
  return `<section class="panneau"><h2>Répartition par sourate — ${pluriel(rep.length, 'sourate')}</h2>
    <div class="repartition">${Array.from({ length: 114 }, (_, i) => { const n = parS.get(i + 1) || 0; return `<a href="${lienRequete(String(i + 1))}" title="Sourate ${i + 1} : ${n}" style="height:${n ? Math.max(4, (n / max) * 100) : 0}%"></a>`; }).join('')}</div>
    <div class="repartition-legende"><span>1</span><span>57</span><span>114</span></div></section>`;
}

// ---------- Recherche de mots ----------
async function vueMots(termes, langue) {
  message('Recherche dans les 6 236 versets…');
  const o = options();
  const dansTrad = langue === 'latin' && o.dansTraduction;
  const resultats = chercherMots(await D.toutLeTexte(), termes, langue, {
    motEntier: o.motEntier, contigus: o.contigus, source: dansTrad ? traductionActive.carte : 'coran',
  });
  const sans = o.contigus && !resultats.length
    ? chercherMots(await D.toutLeTexte(), termes, langue, { motEntier: o.motEntier, source: dansTrad ? traductionActive.carte : 'coran' }).length : 0;
  const occ = resultats.reduce((t, r) => t + r.positions.length, 0);
  const affichage = termes.map((t) => (langue === 'ar' ? `<span class="ar" lang="ar">${echapper(t)}</span>` : `« ${echapper(t)} »`)).join(' <span class="plus-terme">+</span> ');
  const ou = langue === 'ar' ? 'texte arabe' : dansTrad ? `commentaire traditionnel ${echapper(traductionActive.nom)}` : 'translittération';
  await afficherVersets(resultats, {
    titre: `<h1>${affichage}</h1>`,
    resume: `${pluriel(occ, 'mot')} surligné${occ > 1 ? 's' : ''} dans ${pluriel(resultats.length, 'verset')} · ${ou} · ${modeTexte()}`,
    avant: blocRepartition(resultats),
    vide: o.contigus ? aideContigus(sans) : undefined,
  });
}

// ---------- Recherche de racines ----------
async function vueRacines(termes) {
  const index = await D.racines();
  const inconnues = termes.filter((r) => !index[r]);
  if (inconnues.length) {
    return message(`${inconnues.map((r) => `« <span lang="ar">${echapper(r)}</span> »`).join(', ')} : racine inconnue.
      <a href="${lienRequete(`m:${termes.join(' ')}`)}">Chercher comme mot</a>`);
  }
  if (termes.length === 1) return vueRacine(termes[0]);
  message('Recherche des versets…');
  const { contigus } = options();
  const resultats = chercherRacines(await D.toutLeTexte(), termes, { contigus });
  const sans = contigus && !resultats.length ? chercherRacines(await D.toutLeTexte(), termes).length : 0;
  await afficherVersets(resultats, {
    vide: contigus ? aideContigus(sans) : undefined,
    titre: `<h1 lang="ar" class="ar">${termes.map((r) => `<a class="lien-racine-titre" href="${lienRequete(`r:${r}`)}">${echapper(r)}</a>`).join(' <span class="plus-terme">+</span> ')}</h1>`,
    resume: `racines · ${pluriel(resultats.length, 'verset')} contenant toutes ces racines${contigus ? ' (contiguës)' : ''} · <a href="${lienRequete(`m:${termes.join(' ')}`)}">chercher comme mots</a>`,
    avant: blocRepartition(resultats),
  });
}

function tableauAmis(liste, critere, limite) {
  const lignes = trierAmis(liste, critere).slice(0, limite);
  const th = (c, l, t) => `<th><button data-tri="${c}" class="${critere === c ? 'actif' : ''}" title="${t}">${l}</button></th>`;
  return `<table class="tableau"><thead><tr>${th('racine', 'Racine', 'Ordre alphabétique')}${th('n', 'N', 'Nombre de paires')}${th('versets', 'Versets', 'Versets communs')}${th('moyenne', 'Dist. moy.', 'Distance moyenne en mots')}<th>Dist. min</th>${th('lien', 'Lien', 'N / distance moyenne')}</tr></thead>
    <tbody>${lignes.map((a) => `<tr><td><a class="ar" lang="ar" href="${lienRequete(`r:${a.racine}`)}">${echapper(a.racine)}</a></td><td>${a.n}</td><td>${a.versets}</td><td>${a.moyenne.toFixed(2)}</td><td>${a.min}</td><td>${a.lien.toFixed(1)}</td></tr>`).join('')}</tbody></table>
    ${liste.length > limite ? `<button class="plus" data-tout>Afficher les ${liste.length} racines</button>` : ''}`;
}

async function vueRacine(R) {
  message('Calcul des statistiques de la racine…');
  const texte = await D.toutLeTexte();
  const resultats = chercherRacines(texte, [R]);
  const total = resultats.reduce((t, x) => t + x.positions.length, 0);
  const amis = amisRacine(texte, R).liste;
  const contigus = amisRacine(texte, R, { distanceMax: 1 }).liste;
  const dec = declinaisons(texte, R);
  const nbS = new Set(resultats.map((x) => x.s)).size;

  contenu.innerHTML = `<div class="titre"><h1 class="ar racine-titre" lang="ar">${echapper(R)}</h1>
      <span class="resume">racine · ${pluriel(total, 'occurrence')} dans ${pluriel(resultats.length, 'verset')} et ${pluriel(nbS, 'sourate')} · ${pluriel(dec.formes.length, 'forme')}
      · <a href="${lienRequete(`m:${R}`)}">chercher comme mot</a></span></div>
    ${blocRepartition(resultats)}
    <div class="onglets" role="tablist">
      <button role="tab" data-onglet="versets" class="actif">Versets</button>
      <button role="tab" data-onglet="amis">Amis <small>${amis.length}</small></button>
      <button role="tab" data-onglet="contigus">Amis contigus <small>${contigus.length}</small></button>
      <button role="tab" data-onglet="formes">Déclinaisons <small>${dec.formes.length}</small></button>
    </div>
    <div class="onglet" id="o-versets"></div>
    <div class="onglet" id="o-amis" hidden><p class="aide">Racines présentes dans les mêmes versets. N = nombre de paires (occurrence de ${echapper(R)}, mot ami) ; lien = N / distance moyenne. Cliquez un en-tête pour trier.</p><div class="t"></div></div>
    <div class="onglet" id="o-contigus" hidden><p class="aide">Racines des mots immédiatement voisins (distance 1).</p><div class="t"></div></div>
    <div class="onglet" id="o-formes" hidden></div>`;

  // Onglets
  contenu.querySelectorAll('[data-onglet]').forEach((b) => b.addEventListener('click', () => {
    contenu.querySelectorAll('[data-onglet]').forEach((x) => x.classList.toggle('actif', x === b));
    contenu.querySelectorAll('.onglet').forEach((o) => { o.hidden = o.id !== `o-${b.dataset.onglet}`; });
  }));
  // Tableaux d'amis triables
  const brancher = (id, liste) => {
    const zone = $(`#${id} .t`);
    let critere = 'lien'; let limite = 40;
    const dessiner = () => {
      zone.innerHTML = tableauAmis(liste, critere, limite);
      zone.querySelectorAll('[data-tri]').forEach((b) => b.addEventListener('click', () => { critere = b.dataset.tri; dessiner(); }));
      zone.querySelector('[data-tout]')?.addEventListener('click', () => { limite = Infinity; dessiner(); });
    };
    dessiner();
  };
  brancher('o-amis', amis);
  brancher('o-contigus', contigus);
  // Déclinaisons
  $('#o-formes').innerHTML = `<p class="aide">Formes du texte portant la racine, par fréquence.</p>
    <table class="tableau"><thead><tr><th>Forme</th><th>Lecture</th><th>Occurrences</th><th>Premier verset</th></tr></thead>
    <tbody>${dec.formes.map((f) => `<tr><td><a class="ar" lang="ar" href="${lienRequete(`m:${f.forme}`)}">${echapper(f.forme)}</a></td><td><em>${echapper(f.tr)}</em></td><td>${f.n}</td><td><a href="${lienRequete(f.premier)}">${f.premier}</a></td></tr>`).join('')}</tbody></table>`;
  // Versets
  await afficherVersets(resultats, { cible: $('#o-versets') });
}

// ---------- Statistiques de toutes les racines ----------
async function vueStats() {
  message('Calcul des statistiques…');
  const { total, racines } = statistiquesRacines(await D.toutLeTexte());
  const lettres = [...new Set(racines.map((r) => r.racine[0]))].sort((a, b) => a.localeCompare(b, 'ar'));
  contenu.innerHTML = `<div class="titre"><h1>Statistiques des racines</h1><span class="resume">${pluriel(racines.length, 'racine')} · ${pluriel(total, 'mot')}</span></div>
    <div class="lettres" lang="ar"><button data-l="" class="actif">tout</button>${lettres.map((l) => `<button data-l="${l}">${l}</button>`).join('')}</div>
    <table class="tableau"><thead><tr><th>#</th><th>Racine</th><th>Occurrences</th><th>Part</th></tr></thead><tbody id="stats-corps"></tbody></table>`;
  const dessiner = (l) => {
    $('#stats-corps').innerHTML = racines.map((r, i) => ({ ...r, rang: i + 1 })).filter((r) => !l || r.racine[0] === l)
      .map((r) => `<tr><td>${r.rang}</td><td><a class="ar" lang="ar" href="${lienRequete(`r:${r.racine}`)}">${echapper(r.racine)}</a></td><td>${r.n}</td><td>${(r.part * 100).toFixed(2)} %</td></tr>`).join('');
  };
  contenu.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => {
    contenu.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('actif', x === b));
    dessiner(b.dataset.l);
  }));
  dessiner('');
}

function message(html) { contenu.innerHTML = `<p class="message">${html}</p>`; }

// ---------- Routage (#/q/…, #/stats) ----------
async function router() {
  fiche.hidden = true;
  menuNotes();
  // Mes Notes et forum (#/notes, #/note/…, #/forum, #/fil/…)
  if (/^#\/(notes|note\/|forum|fil\/)/.test(location.hash)) {
    $('#requete').value = ''; $('#effacer').hidden = true;
    try { await routeNotes(contenu); } catch (e) { erreur(e); } finally { window.scrollTo(0, 0); }
    return;
  }
  if (location.hash === '#/stats') { $('#requete').value = ''; $('#effacer').hidden = true; document.title = 'Statistiques — Alfamous'; return vueStats().catch(erreur); }
  const m = location.hash.match(/^#\/q\/(.*)$/);
  const q = m ? decodeURIComponent(m[1]).trim() : '';
  $('#requete').value = q;
  $('#effacer').hidden = !q;
  try {
    if (!q) { document.title = "Alfamous — l'atelier du codex"; return await vueAccueil(); }
    document.title = `${q} — Alfamous`;
    const r = analyserRequete(q, new Set(Object.keys(await D.racines())));
    if (r.type === 'versets') return await vueSourate(r.sourate, r.de, r.a);
    if (r.type === 'sourate') return await vueSourate(r.sourate);
    if (r.type === 'page') return await vuePage(r.page);
    if (r.type === 'racines') return await vueRacines(r.termes);
    if (r.type === 'mots') return await vueMots(r.termes, r.langue);
  } catch (e) { erreur(e); } finally { window.scrollTo(0, 0); }
}
function erreur(e) { console.error(e); message(`<span class="erreur">Erreur : ${echapper(e.message)}</span>`); }

// Croix pour effacer le champ de recherche
const champ = $('#requete');
const majCroix = () => { $('#effacer').hidden = !champ.value; };
champ.addEventListener('input', majCroix);
$('#effacer').addEventListener('click', () => { champ.value = ''; majCroix(); champ.focus(); });
champ.addEventListener('keydown', (e) => { if (e.key === 'Escape' && champ.value) { e.stopPropagation(); champ.value = ''; majCroix(); } });

$('#formulaire').addEventListener('submit', (e) => {
  e.preventDefault();
  const cible = lienRequete($('#requete').value.trim());
  if (location.hash === cible) router(); else location.hash = cible;
});
for (const [id, cle] of [['mot-entier', 'motEntier'], ['contigus', 'contigus']]) {
  $(`#${id}`).checked = preferences.lire(cle, '0') === '1';
  $(`#${id}`).addEventListener('change', (e) => { preferences.ecrire(cle, e.target.checked ? '1' : '0'); router(); });
}
$('#source').addEventListener('change', (e) => { preferences.ecrire('source', e.target.value); router(); });
$('#theme').addEventListener('click', () => {
  const sombre = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'sombre'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const nouveau = sombre ? 'clair' : 'sombre';
  document.documentElement.dataset.theme = nouveau;
  preferences.ecrire('theme', nouveau);
});

// Commentaires traditionnels (traductions tanzil.net), cités seulement pour la comparaison.
// Seuls ceux dont le fichier a été déployé sont proposés.
async function initTraductions() {
  try {
    const [{ traductions }, deployees] = await Promise.all([D.langues(), D.traductionsDisponibles()]);
    const dispo = traductions.filter((x) => x.actif && deployees.includes(x.id));
    if (!dispo.length) return;
    const select = $('#traduction');
    select.insertAdjacentHTML('beforeend', dispo.map((t) => `<option value="${t.id}">${echapper(t.nom)} (${t.langue})</option>`).join(''));
    select.closest('label').hidden = false;
    select.value = preferences.lire('traduction', '');
    const appliquer = async () => {
      const t = dispo.find((x) => x.id === select.value);
      traductionActive = t ? { id: t.id, nom: t.nom, carte: await D.traduction(t.id) } : null;
      preferences.ecrire('traduction', select.value);
      const source = $('#source');
      source.closest('label').hidden = !traductionActive;
      source.querySelector('[value="traduction"]').textContent = traductionActive ? `le commentaire traditionnel (${traductionActive.nom})` : 'le commentaire traditionnel';
      if (!traductionActive) source.value = 'coran';
    };
    $('#source').value = preferences.lire('source', 'coran');
    await appliquer();
    select.addEventListener('change', async () => { await appliquer(); router(); });
  } catch { /* pas de traductions déployées */ }
}

window.addEventListener('hashchange', router);
initCommentaires(contenu);
initNotes(contenu);
initCompte();
// Connexion ou déconnexion : menu à jour ; Mes Notes et forum redessinés.
surChangement(() => { menuNotes(); if (/^#\/(notes|note\/|forum|fil\/)/.test(location.hash)) router(); });
Promise.all([
  initTraductions(),
  D.sourates().then((l) => { nbVersets = [0, ...l.map((x) => x.versets)]; }).catch(() => {}),
]).finally(router);
