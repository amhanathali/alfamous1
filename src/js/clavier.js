// Clavier arabe à l'écran.
// Une icône collée à chaque champ de saisie de texte (champs texte, zones de texte, éditeur d'article)
// ouvre un clavier arabe compact : flottant et déplaçable par sa barre du haut, ou ancré en bas de l'écran.
// Trois pages (lettres ; chiffres et symboles ; voyelles et signes). Ancrage et position sont gardés dans le
// navigateur. Tant qu'il est ouvert, le clavier du système est masqué (inputmode="none" sur le champ) ;
// à la fermeture, l'attribut d'avant est remis et le champ reprend le focus, ce qui ramène le clavier du système.
// Les champs sont décorés par champs.js (MutationObserver) : appeler equiperClavier(champ) suffit.

const ICONE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/></svg>';
const ICONE_ANCRER = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="15" width="16" height="5" rx="1"/><path d="M12 4v8M8.5 8.5 12 12l3.5-3.5"/></svg>';
const ICONE_DETACHER = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M8 19h8"/></svg>';

// Page des lettres : disposition arabe usuelle (PC) et hamzas portées.
export const RANGEES = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط', 'ذ'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'أ', 'إ', 'آ'],
];
// Page « chiffres et symboles » (de gauche à droite).
export const SYMBOLES = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['(', ')', '[', ']', '{', '}', '<', '>', '|', '\\', '/', '*'],
  [':', ';', '.', ',', '!', '?', '"', "'", '_', '+', '@', '#'],
];
// Page « voyelles et signes » : voyelles brèves et signes, chiffres arabes, ponctuation arabe, derniers symboles.
export const SIGNES = [
  ['َ', 'ُ', 'ِ', 'ً', 'ٌ', 'ٍ', 'ّ', 'ْ', 'ٰ', 'ٱ', 'ـ', 'لا'],
  ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '٠', '،', '؛'],
  ['؟', '«', '»', '…', '·', '%', '٪', '&', '~', '^', '$', '`'],
];
const PAGES = { arabe: RANGEES, symboles: SYMBOLES, signes: SIGNES };
const LIBELLES = { arabe: ['أبج', 'Lettres arabes'], symboles: ['123', 'Chiffres et symboles'], signes: ['◌َ', 'Voyelles et signes'] };
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

// Préférences d'affichage (par navigateur) : ancré ou flottant, position du clavier flottant.
const pref = {
  lire(cle) { try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; } },
  ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* navigation privée */ } },
};

let panneau = null;
let cible = null; // champ relié au clavier ouvert
let modeAvant = null; // valeur d'inputmode avant l'ouverture (null = absent)
let page = 'arabe';
let ancre = false;

const boutonDe = (champ) => champ?._boutonClavier || null;

function touche(c) {
  const marque = MARQUE.test(c);
  const attr = c.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<button type="button" tabindex="-1" data-touche="${attr}" aria-label="${attr}"${marque ? ' class="marque"' : ''}>${marque ? `◌${c}` : c.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</button>`;
}

function creerPanneau() {
  panneau = document.createElement('div');
  panneau.className = 'clavier-ar';
  panneau.setAttribute('role', 'group');
  panneau.setAttribute('aria-label', 'Clavier arabe');
  panneau.hidden = true;
  panneau.innerHTML = `<div class="clavier-titre" data-poignee title="Glisser pour déplacer le clavier">
      <span class="clavier-nom">Clavier arabe</span>
      <span class="clavier-poignee" aria-hidden="true"></span>
      <button type="button" tabindex="-1" data-action="ancrer" class="clavier-outil"></button>
      <button type="button" tabindex="-1" data-action="fermer" class="clavier-outil clavier-fermer" title="Fermer le clavier arabe (retour au clavier du système)" aria-label="Fermer le clavier arabe">×</button>
    </div>
    <div class="clavier-rangees">
      ${Object.entries(PAGES).map(([nom, rangees]) => `<div class="clavier-page ${nom}" data-page="${nom}"${nom === 'arabe' ? ' lang="ar"' : ''}>${rangees.map((r) => `<div class="clavier-rangee">${r.map(touche).join('')}</div>`).join('')}</div>`).join('')}
      <div class="clavier-rangee clavier-bas">
        <button type="button" tabindex="-1" data-action="page" data-vers="symboles" class="clavier-page-bouton"></button>
        <button type="button" tabindex="-1" data-action="page" data-vers="signes" class="clavier-page-bouton"></button>
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
    if (!cible.isConnected) {
      // Champ redessiné sans que le focus ait été vu passer : on reprend le champ actif qui l'a remplacé.
      const actif = document.activeElement;
      if (actif && actif !== document.body && accepteClavier(actif) && !actif.disabled) suivre(actif);
      else { fermer(false); return; }
    }
    if (b.dataset.action === 'fermer') { fermer(true); return; }
    if (b.dataset.action === 'ancrer') { ancrer(!ancre); return; }
    if (b.dataset.action === 'page') { changerPage(page === b.dataset.vers ? 'arabe' : b.dataset.vers); return; }
    if (document.activeElement !== cible) cible.focus({ preventScroll: true });
    if (b.dataset.touche != null) inserer(cible, b.dataset.touche);
    else if (b.dataset.action === 'arriere') effacerArriere(cible);
    else if (b.dataset.action === 'entree') entree(cible);
  });
  brancherDeplacement(panneau.querySelector('[data-poignee]'));
  window.addEventListener('resize', () => { if (!panneau.hidden && !ancre) placer(positionActuelle()); majMarge(); });
  document.body.append(panneau);
  changerPage('arabe');
  ancrer(pref.lire('clavierAncre') === true, false);
}

// Pages : chacun des deux boutons du bas mène à sa page, ou ramène aux lettres si l'on y est déjà.
function changerPage(nom) {
  page = nom;
  for (const p of panneau.querySelectorAll('[data-page]')) p.hidden = p.dataset.page !== nom;
  for (const b of panneau.querySelectorAll('[data-action="page"]')) {
    const vers = page === b.dataset.vers ? 'arabe' : b.dataset.vers;
    b.textContent = LIBELLES[vers][0];
    b.title = LIBELLES[vers][1];
    b.setAttribute('aria-label', LIBELLES[vers][1]);
  }
}

// Ancré : pleine largeur en bas, la page garde de la place dessous. Flottant : petite fenêtre déplaçable.
function ancrer(oui, enregistrer = true) {
  ancre = oui;
  if (enregistrer) pref.ecrire('clavierAncre', oui);
  panneau.classList.toggle('ancre', oui);
  const b = panneau.querySelector('[data-action="ancrer"]');
  b.innerHTML = oui ? ICONE_DETACHER : ICONE_ANCRER;
  b.title = oui ? 'Détacher (clavier flottant, déplaçable)' : 'Ancrer en bas de l\'écran';
  b.setAttribute('aria-label', b.title);
  panneau.querySelector('[data-poignee]').title = oui ? '' : 'Glisser pour déplacer le clavier';
  majMarge();
  if (oui) { panneau.style.left = ''; panneau.style.top = ''; } else if (!panneau.hidden) { placer(pref.lire('clavierPosition')); if (cible) eviter(cible); }
}

function majMarge() {
  const ouvert = !!panneau && !panneau.hidden;
  document.body.classList.toggle('clavier-ouvert', ouvert && ancre);
  if (ouvert) document.documentElement.style.setProperty('--hauteur-clavier', `${panneau.offsetHeight}px`);
}

// Clavier flottant : position ramenée dans la fenêtre ; par défaut, centré en bas.
const positionActuelle = () => (panneau.style.left ? { x: parseFloat(panneau.style.left), y: parseFloat(panneau.style.top) } : pref.lire('clavierPosition'));
function placer(pos) {
  const l = panneau.offsetWidth; const h = panneau.offsetHeight;
  const W = document.documentElement.clientWidth; const H = window.innerHeight;
  const x = pos ? pos.x : (W - l) / 2;
  const y = pos ? pos.y : H - h - 12;
  panneau.style.left = `${Math.round(Math.max(4, Math.min(x, W - l - 4)))}px`;
  panneau.style.top = `${Math.round(Math.max(4, Math.min(y, H - h - 4)))}px`;
}

// Ne pas cacher le champ : si le clavier flottant le recouvre, il se place juste dessous (ou dessus).
function eviter(champ) {
  const c = champ.getBoundingClientRect(); const p = panneau.getBoundingClientRect();
  if (c.bottom <= p.top || c.top >= p.bottom || c.right <= p.left || c.left >= p.right) return;
  const H = window.innerHeight;
  placer({ x: p.left, y: c.bottom + 8 + p.height <= H ? c.bottom + 8 : c.top - 8 - p.height });
}

// Déplacement à la souris ou au doigt par la barre du haut (clavier flottant seulement).
function brancherDeplacement(poignee) {
  let depart = null;
  poignee.addEventListener('pointerdown', (e) => {
    if (ancre || e.target.closest('button') || e.button > 0) return;
    const r = panneau.getBoundingClientRect();
    depart = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
    poignee.setPointerCapture?.(e.pointerId);
    panneau.classList.add('deplace');
    e.preventDefault();
  });
  poignee.addEventListener('pointermove', (e) => {
    if (depart?.id === e.pointerId) placer({ x: e.clientX - depart.dx, y: e.clientY - depart.dy });
  });
  const finir = (e) => {
    if (depart?.id !== e.pointerId) return;
    depart = null;
    panneau.classList.remove('deplace');
    pref.ecrire('clavierPosition', positionActuelle());
  };
  poignee.addEventListener('pointerup', finir);
  poignee.addEventListener('pointercancel', finir);
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
  const etaitFerme = panneau.hidden;
  if (etaitFerme) changerPage('arabe');
  panneau.hidden = false;
  majMarge();
  if (!champ.closest('.entete')) champ.scrollIntoView?.({ block: 'nearest' });
  if (!ancre) { if (etaitFerme) placer(pref.lire('clavierPosition')); eviter(champ); }
}

export function fermer(refocus = true) {
  if (!panneau || panneau.hidden) return;
  panneau.hidden = true;
  majMarge();
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

// Passer au champ qui remplace le champ relié (sans blur/focus : le champ vient d'être activé par l'écran).
export function suivre(nouveau) {
  delier(false);
  cible = nouveau;
  modeAvant = nouveau.getAttribute('inputmode');
  nouveau.setAttribute('inputmode', 'none');
  setTimeout(() => {
    if (cible !== nouveau) return;
    equiperClavier(nouveau);
    boutonDe(nouveau)?.setAttribute('aria-pressed', 'true');
    if (!ancre && !panneau.hidden) eviter(nouveau);
  }, 0);
}

export function initClavier() {
  // Focus sur un autre champ : le clavier le suit s'il est équipé, sinon il se ferme.
  document.addEventListener('focusin', (e) => {
    if (!cible || e.target === cible || panneau?.contains(e.target) || e.target.closest?.('.bouton-clavier')) return;
    if (e.target.dataset?.clavier && !e.target.disabled) { ouvrir(e.target); return; }
    // Champ redessiné à chaque frappe (filtres des Articles et des Membres) : l'ancien a disparu et le nouveau
    // reçoit le focus avant d'avoir son icône. Le clavier le suit : clavier du système masqué tout de suite,
    // icône posée juste après (le focus et le curseur sont gardés).
    if (!cible.isConnected && accepteClavier(e.target) && !e.target.disabled) { suivre(e.target); return; }
    fermer(false);
  });
  // Changement d'écran : le clavier se ferme sans rappeler le clavier du système.
  window.addEventListener('hashchange', () => fermer(false));
}
