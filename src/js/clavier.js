// Clavier arabe à l'écran.
// Une icône collée à chaque champ de saisie de texte (champs texte, zones de texte, éditeur d'article)
// ouvre un clavier arabe en bas de l'écran, avec une page « chiffres et symboles ». Tant qu'il est ouvert,
// le clavier du système est masqué (inputmode="none" sur le champ) ; à la fermeture, l'attribut d'avant est
// remis et le champ reprend le focus, ce qui ramène le clavier du système.
// Les champs sont décorés par champs.js (MutationObserver) : appeler equiperClavier(champ) suffit.

const ICONE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/></svg>';

// Page arabe : disposition usuelle (PC), hamzas portées, voyelles brèves et signes.
export const RANGEES = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط', 'ذ'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'أ', 'إ', 'آ'],
  ['َ', 'ُ', 'ِ', 'ً', 'ٌ', 'ٍ', 'ّ', 'ْ', 'ٱ', 'ٰ', 'ـ', '،'],
];
// Page « chiffres et symboles » (de gauche à droite).
export const SYMBOLES = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['(', ')', '[', ']', '{', '}', '<', '>', '|', '\\', '/', '*'],
  [':', ';', '.', ',', '!', '?', '"', "'", '_', '+', '@', '#'],
  ['%', '&', '~', '^', '$', '«', '»', '؟', '؛', '…', '·', '`'],
];
const MARQUE = /^[ً-ْٰ]$/; // voyelles et signes : montrés sur un cercle pointillé

const TYPES_TEXTE = ['text', 'search'];
const editable = (el) => el.isContentEditable || el.getAttribute?.('contenteditable') === 'true';

// Champs qui reçoivent l'icône : tous les champs texte (pas courriel, mot de passe, nombre…), les zones de texte
// éditables et l'éditeur d'article. Exclus : lecteur audio (références seulement), code HTML et dossier pour Claude
// (spellcheck="false" sur une zone de texte), data-sans-clavier.
export function accepteClavier(el) {
  if (!el?.closest || el.closest('.lecteur, .clavier-ar') || el.hasAttribute('data-sans-clavier')) return false;
  if (el.tagName === 'TEXTAREA') return !el.readOnly && el.getAttribute('spellcheck') !== 'false';
  if (el.tagName === 'INPUT') return TYPES_TEXTE.includes(el.type) && !el.readOnly && !el.hidden;
  return el.getAttribute('contenteditable') === 'true';
}

// Insère du texte à la place de la sélection (respecte maxlength) ; renvoie false si rien n'a changé.
export function inserer(champ, texte) {
  if (editable(champ)) return document.execCommand('insertText', false, texte);
  const debut = champ.selectionStart ?? champ.value.length;
  const fin = champ.selectionEnd ?? debut;
  if (champ.maxLength > 0 && champ.value.length - (fin - debut) + texte.length > champ.maxLength) return false;
  champ.setRangeText(texte, debut, fin, 'end');
  champ.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// Efface la sélection, sinon le caractère avant le curseur.
export function effacerArriere(champ) {
  if (editable(champ)) return document.execCommand('delete');
  let debut = champ.selectionStart ?? champ.value.length;
  const fin = champ.selectionEnd ?? debut;
  if (debut === fin) { if (!debut) return false; debut -= 1; }
  champ.setRangeText('', debut, fin, 'end');
  champ.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

let panneau = null;
let cible = null; // champ relié au clavier ouvert
let modeAvant = null; // valeur d'inputmode avant l'ouverture (null = absent)

const boutonDe = (champ) => champ?._boutonClavier || null;

function touche(c) {
  const marque = MARQUE.test(c);
  return `<button type="button" tabindex="-1" data-touche="${c.replace(/"/g, '&quot;')}" aria-label="${c.replace(/"/g, '&quot;')}"${marque ? ' class="marque"' : ''}>${marque ? `◌${c}` : c.replace(/</g, '&lt;')}</button>`;
}

function creerPanneau() {
  panneau = document.createElement('div');
  panneau.className = 'clavier-ar';
  panneau.setAttribute('role', 'group');
  panneau.setAttribute('aria-label', 'Clavier arabe');
  panneau.hidden = true;
  panneau.innerHTML = `<div class="clavier-rangees">
      <div class="clavier-page" data-page="arabe">${RANGEES.map((r) => `<div class="clavier-rangee" lang="ar">${r.map(touche).join('')}</div>`).join('')}</div>
      <div class="clavier-page symboles" data-page="symboles" hidden>${SYMBOLES.map((r) => `<div class="clavier-rangee">${r.map(touche).join('')}</div>`).join('')}</div>
      <div class="clavier-rangee clavier-bas">
        <button type="button" tabindex="-1" data-action="fermer" class="clavier-fermer" title="Fermer le clavier arabe (retour au clavier du système)" aria-label="Fermer le clavier arabe">×</button>
        <button type="button" tabindex="-1" data-action="page" class="clavier-page-bouton" title="Chiffres et symboles" aria-label="Chiffres et symboles">123</button>
        <button type="button" tabindex="-1" data-touche="+" title="Terme suivant (recherche)">+</button>
        <button type="button" tabindex="-1" data-touche=" " aria-label="Espace">espace</button>
        <button type="button" tabindex="-1" data-action="arriere" title="Effacer" aria-label="Effacer">⌫</button>
        <button type="button" tabindex="-1" data-action="entree" title="Entrée" aria-label="Entrée">↵</button>
      </div></div>`;
  // Garder le focus dans le champ pendant la frappe.
  panneau.addEventListener('mousedown', (e) => e.preventDefault());
  panneau.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !cible) return;
    if (!cible.isConnected) { fermer(false); return; }
    if (b.dataset.action === 'fermer') { fermer(true); return; }
    if (b.dataset.action === 'page') { changerPage(); return; }
    if (document.activeElement !== cible) cible.focus({ preventScroll: true });
    if (b.dataset.touche != null) inserer(cible, b.dataset.touche);
    else if (b.dataset.action === 'arriere') effacerArriere(cible);
    else if (b.dataset.action === 'entree') entree(cible);
  });
  document.body.append(panneau);
}

// Bascule entre la page arabe et la page chiffres et symboles.
function changerPage(page) {
  const symboles = page ? page === 'symboles' : panneau.querySelector('[data-page="symboles"]').hidden;
  panneau.querySelector('[data-page="arabe"]').hidden = symboles;
  panneau.querySelector('[data-page="symboles"]').hidden = !symboles;
  const b = panneau.querySelector('[data-action="page"]');
  b.textContent = symboles ? 'أبج' : '123';
  b.title = symboles ? 'Lettres arabes' : 'Chiffres et symboles';
  b.setAttribute('aria-label', b.title);
}

function entree(champ) {
  if (editable(champ)) { document.execCommand('insertParagraph'); return; }
  if (champ.tagName === 'TEXTAREA') { inserer(champ, '\n'); return; }
  // Les écrans qui réagissent à Entrée l'écoutent sur keydown ; sinon on envoie le formulaire.
  const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
  if (champ.dispatchEvent(ev) && champ.form) champ.form.requestSubmit();
}

// Relier le clavier à un champ : clavier du système masqué. Quitter puis reprendre le focus
// oblige le téléphone à relire inputmode.
function relier(champ) {
  cible = champ;
  modeAvant = champ.getAttribute('inputmode');
  if (document.activeElement === champ) champ.blur();
  champ.setAttribute('inputmode', 'none');
  champ.focus({ preventScroll: true });
  boutonDe(champ)?.setAttribute('aria-pressed', 'true');
}

// Délier : l'inputmode d'avant est remis ; avec refocus, le clavier du système revient.
function delier(refocus) {
  const champ = cible;
  cible = null;
  if (!champ) return;
  if (modeAvant == null) champ.removeAttribute('inputmode'); else champ.setAttribute('inputmode', modeAvant);
  modeAvant = null;
  boutonDe(champ)?.setAttribute('aria-pressed', 'false');
  if (refocus && champ.isConnected && !champ.disabled) { champ.blur(); champ.focus({ preventScroll: true }); }
}

export function ouvrir(champ) {
  if (!panneau) creerPanneau();
  if (cible && cible !== champ) delier(false);
  if (cible !== champ) relier(champ);
  if (panneau.hidden) changerPage('arabe');
  panneau.hidden = false;
  document.body.classList.add('clavier-ouvert');
  document.documentElement.style.setProperty('--hauteur-clavier', `${panneau.offsetHeight}px`);
  if (!champ.closest('.entete')) champ.scrollIntoView?.({ block: 'nearest' });
}

export function fermer(refocus = true) {
  if (!panneau || panneau.hidden) return;
  panneau.hidden = true;
  document.body.classList.remove('clavier-ouvert');
  delier(refocus);
}

// Pose l'icône : dans le champ de recherche (déjà positionné), sinon dans une enveloppe autour du champ,
// à droite (champ d'une ligne) ou en haut à droite (zone de texte, éditeur).
export function equiperClavier(champ) {
  if (champ.dataset.clavier || !accepteClavier(champ)) return;
  champ.dataset.clavier = '1';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton-clavier';
  bouton.title = 'Clavier arabe';
  bouton.setAttribute('aria-label', 'Clavier arabe');
  bouton.setAttribute('aria-pressed', 'false');
  bouton.innerHTML = ICONE;
  champ._boutonClavier = bouton;
  bouton.addEventListener('mousedown', (e) => e.preventDefault());
  bouton.addEventListener('click', () => {
    if (champ.disabled) return;
    if (cible === champ && !panneau.hidden) fermer(true); else ouvrir(champ);
  });
  if (champ.id === 'requete') { champ.parentElement.append(bouton); return; }
  // Déplacer un champ lui fait perdre le focus : on le lui rend, curseur compris.
  const actif = document.activeElement === champ;
  const sel = actif && !editable(champ) ? [champ.selectionStart, champ.selectionEnd] : null;
  const zone = champ.tagName !== 'INPUT';
  champ.classList.add('a-clavier');
  const enveloppe = document.createElement(zone ? 'div' : 'span');
  enveloppe.className = zone ? 'avec-clavier zone' : 'avec-clavier';
  champ.before(enveloppe);
  enveloppe.append(champ, bouton);
  if (actif) { champ.focus({ preventScroll: true }); if (sel) champ.setSelectionRange(...sel); }
}

export function initClavier() {
  // Focus sur un autre champ : le clavier le suit s'il est équipé, sinon il se ferme.
  document.addEventListener('focusin', (e) => {
    if (!cible || e.target === cible || panneau?.contains(e.target) || e.target.closest?.('.bouton-clavier')) return;
    if (e.target.dataset?.clavier && !e.target.disabled) ouvrir(e.target);
    else fermer(false);
  });
  // Changement d'écran : le clavier se ferme sans rappeler le clavier du système.
  window.addEventListener('hashchange', () => fermer(false));
}
