// Clavier arabe à l'écran.
// Une icône collée aux champs où l'on tape de l'arabe (champ de recherche, champs « dir=auto », zones de texte)
// ouvre un clavier arabe en bas de l'écran. Tant qu'il est ouvert, le clavier du système est masqué
// (inputmode="none" sur le champ) ; à la fermeture, l'attribut d'avant est remis et le champ reprend le focus,
// ce qui ramène le clavier du système.
// Les champs sont décorés par champs.js (MutationObserver) : appeler equiperClavier(champ) suffit.

const ICONE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/></svg>';

// Disposition arabe usuelle (PC), plus les hamzas portées et les voyelles brèves.
export const RANGEES = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط', 'ذ'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'أ', 'إ', 'آ'],
  ['َ', 'ُ', 'ِ', 'ً', 'ٌ', 'ٍ', 'ّ', 'ْ', 'ٱ', 'ٰ', 'ـ', '،'],
];
const MARQUE = /^[ً-ْٰ]$/; // voyelles et signes : montrés sur un cercle pointillé

// Champs qui reçoivent l'icône : le champ de recherche, les champs texte « dir=auto » et les zones de texte
// éditables (sauf celles du code HTML ou du dossier pour Claude, marquées spellcheck="false").
export function accepteClavier(el) {
  if (!el || el.closest('.lecteur, .clavier-ar') || el.hasAttribute('data-sans-clavier')) return false;
  if (el.id === 'requete') return true;
  if (el.tagName === 'TEXTAREA') return !el.readOnly && el.getAttribute('spellcheck') !== 'false';
  if (el.tagName === 'INPUT') return el.getAttribute('dir') === 'auto' && ['text', 'search'].includes(el.type);
  return false;
}

// Insère du texte à la place de la sélection (respecte maxlength) ; renvoie false si rien n'a changé.
export function inserer(champ, texte) {
  const debut = champ.selectionStart ?? champ.value.length;
  const fin = champ.selectionEnd ?? debut;
  if (champ.maxLength > 0 && champ.value.length - (fin - debut) + texte.length > champ.maxLength) return false;
  champ.setRangeText(texte, debut, fin, 'end');
  champ.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// Efface la sélection, sinon le caractère avant le curseur.
export function effacerArriere(champ) {
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

function creerPanneau() {
  panneau = document.createElement('div');
  panneau.className = 'clavier-ar';
  panneau.setAttribute('role', 'group');
  panneau.setAttribute('aria-label', 'Clavier arabe');
  panneau.hidden = true;
  const touche = (c) => `<button type="button" tabindex="-1" data-touche="${c}" aria-label="${c}"${MARQUE.test(c) ? ' class="marque"' : ''}>${MARQUE.test(c) ? `◌${c}` : c}</button>`;
  panneau.innerHTML = `<div class="clavier-rangees">
      ${RANGEES.map((r) => `<div class="clavier-rangee" lang="ar">${r.map(touche).join('')}</div>`).join('')}
      <div class="clavier-rangee clavier-bas">
        <button type="button" tabindex="-1" data-action="fermer" class="clavier-fermer" title="Fermer le clavier arabe (retour au clavier du système)" aria-label="Fermer le clavier arabe">×</button>
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
    if (document.activeElement !== cible) cible.focus({ preventScroll: true });
    if (b.dataset.touche != null) inserer(cible, b.dataset.touche);
    else if (b.dataset.action === 'arriere') effacerArriere(cible);
    else if (b.dataset.action === 'entree') entree(cible);
  });
  document.body.append(panneau);
}

function entree(champ) {
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
  const barre = champ.tagName === 'TEXTAREA' && champ.nextElementSibling?.classList.contains('outils-champ') ? champ.nextElementSibling : null;
  if (champ.id === 'requete') {
    champ.parentElement.append(bouton); // .recherche .champ est déjà positionné
  } else if (barre) {
    bouton.insertAdjacentHTML('beforeend', '<span>Clavier ar</span>');
    barre.prepend(bouton);
  } else {
    const enveloppe = document.createElement('span');
    enveloppe.className = champ.tagName === 'TEXTAREA' ? 'avec-clavier zone' : 'avec-clavier';
    champ.before(enveloppe);
    enveloppe.append(champ, bouton);
  }
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
