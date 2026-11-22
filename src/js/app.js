// Alfamous1 — interface de lecture et de recherche (phase 1, sans connexion).
import * as D from './donnees.js';
import { analyserRequete, chercherMot, occurrencesRacine, amisRacine, repartitionParSourate } from './recherche.js';
import { NOMS_SOURATES } from './sourates.js';

const $ = (sel) => document.querySelector(sel);
const contenu = $('#contenu');
const fiche = $('#fiche-mot');
const PAR_PAGE = 50;

const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lienRequete = (q) => `#/q/${encodeURIComponent(q)}`;
const nomSourate = (s) => NOMS_SOURATES[s - 1] || ['', ''];

const preferences = {
  lire(cle, defaut) { try { return localStorage.getItem(cle) ?? defaut; } catch { return defaut; } },
  ecrire(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch { /* navigation privée */ } },
};

let traductionActive = null; // Map « s:v » → texte

// ---------- Affichage d'une liste de versets ----------
// items : [{ s, v, positions? }]
async function afficherVersets(items, { titre, resume, surligner = true }) {
  contenu.innerHTML = `<div class="titre">${titre}<span class="resume">${resume || ''}</span></div><div id="liste"></div>`;
  const liste = $('#liste');
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
      return x ? carteVerset(it.s, x, m?.versets[it.v], surligner ? it.positions : null) : '';
    }).join(''));
    $('#plus')?.remove();
    if (affiches < items.length) {
      liste.insertAdjacentHTML('afterend', `<button id="plus" class="plus">Afficher ${Math.min(PAR_PAGE, items.length - affiches)} versets de plus (${items.length - affiches} restants)</button>`);
      $('#plus').onclick = suite;
    }
  };
  if (!items.length) { liste.innerHTML = '<p class="message">Aucun résultat.</p>'; return; }
  await suite();
}

function carteVerset(s, x, motsVerset, positions) {
  const motsAr = x.ar.split(/\s+/);
  const alignes = motsVerset && motsVerset.length === motsAr.length;
  const surl = new Set(positions || []);
  const ar = motsAr.map((w, i) => {
    const cls = `mot${surl.has(i) ? ' surligne' : ''}`;
    return alignes ? `<span class="${cls}" tabindex="0" data-ref="${s}:${x.v}:${i}">${echapper(w)}</span>` : `<span class="${cls}">${echapper(w)}</span>`;
  }).join(' ');
  const trad = traductionActive?.get(`${s}:${x.v}`);
  return `<article class="verset">
    <div class="verset-entete"><a class="ref" href="${lienRequete(`${s}:${x.v}`)}">${s}:${x.v}</a><span>${echapper(nomSourate(s)[1])} · page ${x.page ?? '?'}</span></div>
    <p class="ar" lang="ar">${ar}</p>
    <p class="tr">${echapper(x.tr)}</p>
    ${trad ? `<p class="trad">${echapper(trad)}</p>` : ''}
  </article>`;
}

// ---------- Fiche d'un mot (au clic) ----------
async function ouvrirFiche(ref) {
  const [s, v, i] = ref.split(':').map(Number);
  const m = await D.mots(s);
  const w = m.versets[v]?.[i];
  if (!w) return;
  const [tr, racine, ar, sens] = w;
  fiche.innerHTML = `<button class="fermer" aria-label="Fermer">×</button>
    <p class="ar" lang="ar">${echapper(ar)}</p>
    <dl>
      <dt>Lecture</dt><dd><em>${echapper(tr)}</em></dd>
      <dt>Racine</dt><dd><a href="${lienRequete(`r:${racine}`)}" lang="ar" class="ar" style="font-size:22px">${echapper(racine)}</a></dd>
      <dt>Sens</dt><dd>${echapper(sens) || '—'}</dd>
      <dt>Position</dt><dd>${s}:${v}, mot ${i + 1}</dd>
    </dl>`;
  fiche.hidden = false;
  fiche.querySelector('.fermer').onclick = () => { fiche.hidden = true; };
}
contenu.addEventListener('click', (e) => { const el = e.target.closest('.mot[data-ref]'); if (el) ouvrirFiche(el.dataset.ref); });
contenu.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const el = e.target.closest('.mot[data-ref]'); if (el) ouvrirFiche(el.dataset.ref); } });
fiche.addEventListener('click', (e) => { if (e.target.closest('a')) fiche.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fiche.hidden = true; });

// ---------- Vues ----------
async function vueAccueil() {
  const liste = await D.sourates();
  contenu.innerHTML = `<p class="intro">Cherchez un verset (<a href="${lienRequete('2:255')}">2:255</a>), une sourate, une page,
    un mot en arabe ou en lettres latines, ou une racine (<a href="${lienRequete('رحم')}" lang="ar">رحم</a>).
    Cliquez sur un mot arabe pour voir sa lecture, sa racine et son sens.</p>
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
  await afficherVersets(items, { titre: `<h1>${s}. ${echapper(lat)} <span class="ar" lang="ar">${echapper(ar)}</span></h1>`, resume: plage, surligner: false });
  if (info.basmala && de === 1) $('#liste').insertAdjacentHTML('afterbegin', '<p class="basmala ar" lang="ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>');
  const nav = `<nav class="nav">${s > 1 ? `<a href="${lienRequete(String(s - 1))}">← ${s - 1}. ${echapper(nomSourate(s - 1)[1])}</a>` : '<span></span>'}
    ${s < 114 ? `<a href="${lienRequete(String(s + 1))}">${s + 1}. ${echapper(nomSourate(s + 1)[1])} →</a>` : ''}</nav>`;
  contenu.insertAdjacentHTML('beforeend', nav);
}

async function vuePage(p) {
  if (p < 1 || p > 604) return message('Les pages vont de 1 à 604.');
  const liste = await D.sourates();
  const concernees = liste.filter((x) => x.pageDebut <= p && x.pageFin >= p).map((x) => x.n);
  const textes = await Promise.all(concernees.map(D.texte));
  const items = textes.flatMap((t) => t.versets.filter((x) => x.page === p).map((x) => ({ s: t.sourate, v: x.v })));
  await afficherVersets(items, { titre: `<h1>Page ${p}</h1>`, resume: `${items.length} versets`, surligner: false });
  contenu.insertAdjacentHTML('beforeend', `<nav class="nav">${p > 1 ? `<a href="${lienRequete(`p ${p - 1}`)}">← page ${p - 1}</a>` : '<span></span>'}${p < 604 ? `<a href="${lienRequete(`p ${p + 1}`)}">page ${p + 1} →</a>` : ''}</nav>`);
}

async function vueMot(mot, langue) {
  message('Recherche dans les 6 236 versets…');
  const motEntier = $('#mot-entier').checked;
  const resultats = chercherMot(await D.toutLeTexte(), mot, langue, { motEntier });
  const occurrences = resultats.reduce((t, r) => t + r.positions.length, 0);
  await afficherVersets(resultats, {
    titre: `<h1>${langue === 'ar' ? `<span class="ar" lang="ar">${echapper(mot)}</span>` : `« ${echapper(mot)} »`}</h1>`,
    resume: `${occurrences} occurrence${occurrences > 1 ? 's' : ''} dans ${resultats.length} verset${resultats.length > 1 ? 's' : ''}${motEntier ? ' · mot entier' : ' · partie de mot'}`,
  });
}

async function vueRacine(racine, aussiMot) {
  const index = await D.racines();
  if (!index[racine]) return message(`La racine « ${echapper(racine)} » n'est pas dans l'index. <a href="${lienRequete(racine + ' ')}">Chercher comme mot</a>`);
  message('Calcul des racines voisines…');
  const occ = occurrencesRacine(index, racine);
  const { amis, contigus } = amisRacine(occ, await D.tousLesMots(), racine, 30);
  const rep = repartitionParSourate(occ);
  const max = Math.max(...rep.map((x) => x.n));
  const parS = new Map(rep.map((x) => [x.s, x.n]));
  const puces = (l) => l.map((a) => `<a class="puce" href="${lienRequete(`r:${a.racine}`)}" title="${a.versets} versets">${echapper(a.racine)}<small>${a.versets}</small></a>`).join('');
  await afficherVersets(occ.versets, {
    titre: `<h1 class="ar racine-titre" lang="ar">${echapper(racine)}</h1>`,
    resume: `racine · ${occ.total} occurrences dans ${occ.versets.length} versets et ${rep.length} sourates${aussiMot ? ` · <a href="${lienRequete(racine + ' ')}">chercher comme mot</a>` : ''}`,
  });
  $('#liste').insertAdjacentHTML('beforebegin', `<div class="panneaux">
    <section class="panneau"><h2>Amis — racines présentes dans les mêmes versets</h2><div class="puces" lang="ar">${puces(amis)}</div></section>
    <section class="panneau"><h2>Amis contigus — racines des mots voisins</h2><div class="puces" lang="ar">${puces(contigus)}</div></section>
    <section class="panneau" style="grid-column:1/-1"><h2>Répartition par sourate</h2>
      <div class="repartition">${Array.from({ length: 114 }, (_, i) => { const n = parS.get(i + 1) || 0; return `<span title="Sourate ${i + 1} : ${n}" style="height:${n ? Math.max(4, (n / max) * 100) : 0}%"></span>`; }).join('')}</div>
      <div class="repartition-legende"><span>1</span><span>57</span><span>114</span></div></section>
  </div>`);
}

function message(html) { contenu.innerHTML = `<p class="message">${html}</p>`; }

// ---------- Routage (#/q/…) ----------
async function router() {
  fiche.hidden = true;
  const m = location.hash.match(/^#\/q\/(.*)$/);
  const q = m ? decodeURIComponent(m[1]) : '';
  $('#requete').value = q.trim();
  try {
    if (!q.trim()) return await vueAccueil();
    const index = await D.racines();
    // Un espace final force la recherche comme mot (lien « chercher comme mot »).
    const r = q.endsWith(' ') ? analyserRequete(q) : analyserRequete(q, new Set(Object.keys(index)));
    document.title = `${q.trim()} — Alfamous`;
    if (r.type === 'versets') return await vueSourate(r.sourate, r.de, r.a);
    if (r.type === 'sourate') return await vueSourate(r.sourate);
    if (r.type === 'page') return await vuePage(r.page);
    if (r.type === 'racine') return await vueRacine(r.racine, r.aussiMot);
    if (r.type === 'mot') return await vueMot(r.mot, r.langue);
  } catch (e) {
    console.error(e);
    message(`<span class="erreur">Erreur de chargement : ${echapper(e.message)}</span>`);
  } finally {
    window.scrollTo(0, 0);
  }
}

$('#formulaire').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#requete').value.trim();
  const cible = lienRequete(q);
  if (location.hash === cible) router(); else location.hash = cible;
});
$('#mot-entier').checked = preferences.lire('motEntier', '0') === '1';
$('#mot-entier').addEventListener('change', (e) => { preferences.ecrire('motEntier', e.target.checked ? '1' : '0'); router(); });
$('#theme').addEventListener('click', () => {
  const sombre = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'sombre'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const nouveau = sombre ? 'clair' : 'sombre';
  document.documentElement.dataset.theme = nouveau;
  preferences.ecrire('theme', nouveau);
});

// Traductions : seulement celles dont le fichier tanzil a été déployé.
async function initTraductions() {
  try {
    const [{ traductions }, deployees] = await Promise.all([D.langues(), D.traductionsDisponibles()]);
    const select = $('#traduction');
    const dispo = traductions.filter((x) => x.actif && deployees.includes(x.id));
    if (!dispo.length) return;
    select.insertAdjacentHTML('beforeend', dispo.map((t) => `<option value="${t.id}">${echapper(t.nom)} (${t.langue})</option>`).join(''));
    select.closest('label').hidden = false;
    select.value = preferences.lire('traduction', '');
    const appliquer = async () => {
      traductionActive = select.value ? await D.traduction(select.value).catch(() => null) : null;
      preferences.ecrire('traduction', select.value);
    };
    await appliquer();
    select.addEventListener('change', async () => { await appliquer(); router(); });
  } catch { /* pas de traductions déployées */ }
}

window.addEventListener('hashchange', router);
initTraductions().finally(router);
