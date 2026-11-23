// Sélection et copie de versets (phase 3, maquette docs/maquettes/lexique.html).
// Une case « Choisir » sur chaque verset ; la sélection est gardée en changeant de page (et au rechargement,
// le temps de la session du navigateur) ; barre en bas : Aperçu · Copier · Vider.
// Copie en texte simple et en texte mis en forme (Word, courriel).
import * as D from './donnees.js';
import { ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper } from './commentaires-format.js';
import { composerCopie, trierReferences } from './selection-outils.js';

const $ = (s) => document.querySelector(s);
const OPTIONS_DEFAUT = { tr: true, trad: false, lien: false };
let choisis = [];
let options = { ...OPTIONS_DEFAUT };
let traductionActive = () => null; // { nom, carte } fourni par app.js

try { choisis = JSON.parse(sessionStorage.getItem('selection') || '[]'); } catch { choisis = []; }
try { options = { ...OPTIONS_DEFAUT, ...JSON.parse(localStorage.getItem('copie:options') || '{}') }; } catch { /* défaut */ }
const garder = () => { try { sessionStorage.setItem('selection', JSON.stringify(choisis)); } catch { /* navigation privée */ } };
const garderOptions = () => { try { localStorage.setItem('copie:options', JSON.stringify(options)); } catch { /* idem */ } };

export const caseChoisir = (ref) => `<label class="choisir" title="Ajouter ce verset à la sélection à copier">
  <input type="checkbox" data-choisir="${ref}"${choisis.includes(ref) ? ' checked' : ''}> Choisir</label>`;

function majCartes() {
  document.querySelectorAll('[data-choisir]').forEach((c) => {
    c.checked = choisis.includes(c.dataset.choisir);
    c.closest('.verset')?.classList.toggle('choisi', c.checked);
  });
}

function majBarre() {
  const barre = $('#barre-copie');
  barre.hidden = !choisis.length;
  if (!choisis.length) return;
  const n = choisis.length;
  const liste = choisis.length > 6 ? `${choisis.slice(0, 6).join(', ')}…` : choisis.join(', ');
  barre.querySelector('.gauche').innerHTML = `<b>${n}</b> verset${n > 1 ? 's' : ''} choisi${n > 1 ? 's' : ''} <small>(${liste})</small>`;
}

const majTout = () => { majCartes(); majBarre(); };

async function versets() {
  const sourates = [...new Set(choisis.map((r) => Number(r.split(':')[0])))];
  const textes = new Map(await Promise.all(sourates.map(async (s) => [s, await D.texte(s)])));
  const trad = traductionActive();
  return choisis.map((ref) => {
    const [s, v] = ref.split(':').map(Number);
    const x = textes.get(s).versets.find((y) => y.v === v);
    return { ref, ar: x.ar, tr: x.tr, trad: trad?.carte.get(ref) || null };
  });
}

const baseLien = () => `${location.origin}${location.pathname}`;

async function apercu() {
  const liste = await versets();
  const trad = traductionActive();
  const { texte } = composerCopie(liste, { ...options, nomTrad: trad?.nom, base: baseLien() });
  ouvrirFenetre(`<h2>Copier ${liste.length} verset${liste.length > 1 ? 's' : ''}</h2>
    <div class="options-copie">
      <label><input type="checkbox" checked disabled> Référence</label>
      <label><input type="checkbox" checked disabled> Texte arabe</label>
      <label><input type="checkbox" data-option="tr"${options.tr ? ' checked' : ''}> Translittération</label>
      <label title="${trad ? '' : 'Choisissez d\'abord un commentaire dans « Comparer avec »'}"><input type="checkbox" data-option="trad"${options.trad ? ' checked' : ''}${trad ? '' : ' disabled'}>
        Commentaire traditionnel${trad ? ` (${echapper(trad.nom)})` : ' (aucun choisi)'}</label>
      <label><input type="checkbox" data-option="lien"${options.lien ? ' checked' : ''}> Lien vers le verset</label>
    </div>
    <pre class="apercu-copie" dir="auto">${echapper(texte)}</pre>
    <p class="form-msg" role="status"></p>
    <div class="fenetre-bas"><span class="aide">Texte simple et texte mis en forme (Word, courriel)</span>
      <button type="button" class="btn principal" data-copie="copier">Copier</button></div>`);
}

async function copier(bouton) {
  const liste = await versets();
  const trad = traductionActive();
  const { texte, html } = composerCopie(liste, { ...options, nomTrad: trad?.nom, base: baseLien() });
  let ok = false;
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([texte], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
    } else await navigator.clipboard.writeText(texte);
    ok = true;
  } catch { ok = false; }
  const msg = `${ok ? '✓' : '✗'} ${ok ? `${liste.length} verset${liste.length > 1 ? 's' : ''} copié${liste.length > 1 ? 's' : ''}` : 'Copie refusée par le navigateur'}`;
  const zone = bouton.closest('dialog')?.querySelector('.form-msg');
  if (zone) zone.textContent = msg;
  else { const b = $('#barre-copie [data-copie="copier"]'); b.textContent = msg; setTimeout(() => { b.textContent = 'Copier'; }, 1800); }
}

export function initSelection({ traduction } = {}) {
  if (traduction) traductionActive = traduction;
  document.body.insertAdjacentHTML('beforeend', `<div id="barre-copie" class="barre-copie" hidden>
    <div class="barre-copie-in"><span class="gauche"></span>
      <span class="droite"><button type="button" class="btn" data-copie="apercu">Aperçu</button>
        <button type="button" class="btn principal" data-copie="copier">Copier</button>
        <button type="button" class="btn" data-copie="vider">Vider</button></span></div></div>`);
  document.addEventListener('change', (e) => {
    const c = e.target.closest('[data-choisir]');
    if (c) {
      const ref = c.dataset.choisir;
      choisis = c.checked ? trierReferences([...new Set([...choisis, ref])]) : choisis.filter((r) => r !== ref);
      garder(); majTout(); return;
    }
    const o = e.target.closest('[data-option]');
    if (o) { options[o.dataset.option] = o.checked; garderOptions(); apercu(); }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copie]');
    if (!b) return;
    if (b.dataset.copie === 'apercu') apercu();
    else if (b.dataset.copie === 'copier') copier(b);
    else if (b.dataset.copie === 'vider') { choisis = []; garder(); majTout(); fermerFenetre(); }
  });
  // Nouvelles cartes affichées : cocher celles déjà choisies.
  new MutationObserver(majCartes).observe($('#contenu'), { childList: true, subtree: true });
  majTout();
}
