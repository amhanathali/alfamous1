// Aides communes à tous les écrans (commentaires, lexique, notes, forum, articles, membres) :
//  - une icône devant les boutons « Modifier », « Supprimer… » et « Enregistrer… » ;
//  - sous chaque champ d'édition (textarea) : « Copier » et « Effacer » (avec « Annuler » pendant quelques secondes).
//  - une icône de clavier arabe collée à chaque champ de saisie de texte (clavier.js).
// Les écrans sont dessinés par plusieurs modules : un MutationObserver décore ce qui apparaît, sans toucher à leur code.

import { equiperClavier, initClavier } from './clavier.js';

const svg = (d) => `<svg class="icone-bouton" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
export const ICONES = {
  modifier: svg('M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4'),
  supprimer: svg('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6'),
  enregistrer: svg('M5 4h11l3 3v13H5zM8 4v5h8V4M8 20v-6h8v6'),
  copier: svg('M9 9h11v11H9zM5 15H4V4h11v1'),
  effacer: svg('M20 20H9L4 15l9-9 7 7-6 6M9 11l6 6'),
};

// Quelle icône pour ce bouton ? (d'après son libellé ; null = aucune)
export function iconePour(libelle) {
  const t = String(libelle || '').trim();
  if (/^Modifier\b/.test(t)) return 'modifier';
  if (/^Supprimer\b/.test(t)) return 'supprimer';
  if (/^Enregistrer\b/.test(t)) return 'enregistrer';
  return null;
}

function decorerBouton(b) {
  if (b.closest('.outils-champ, .lecteur')) return;
  const nom = iconePour(b.textContent);
  const actuelle = b.querySelector(':scope > svg.icone-bouton');
  if (!nom) { actuelle?.remove(); b.classList.remove('avec-icone'); return; }
  if (actuelle?.dataset.icone === nom) return;
  actuelle?.remove();
  b.insertAdjacentHTML('afterbegin', ICONES[nom]);
  b.querySelector(':scope > svg.icone-bouton').dataset.icone = nom;
  b.classList.add('avec-icone');
}

async function copier(texte) {
  try { await navigator.clipboard.writeText(texte); return true; } catch { /* repli ci-dessous */ }
  const t = document.createElement('textarea');
  t.value = texte; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.append(t); t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove();
  return ok;
}

function outillerChamp(champ) {
  if (champ.dataset.outils || champ.closest('.lecteur') || champ.hasAttribute('data-sans-outils')) return;
  champ.dataset.outils = '1';
  const barre = document.createElement('div');
  barre.className = 'outils-champ';
  const lecture = champ.readOnly;
  barre.innerHTML = `<button type="button" data-outil="copier" title="Copier le texte du champ">${ICONES.copier}<span>Copier</span></button>`
    + (lecture ? '' : `<button type="button" data-outil="effacer" title="Vider le champ">${ICONES.effacer}<span>Effacer</span></button>`)
    + '<span class="outils-etat" role="status"></span>';
  champ.after(barre);
  const etat = barre.querySelector('.outils-etat');
  let minuterie = null;
  let sauvegarde = null;
  const dire = (texte) => { etat.textContent = texte; clearTimeout(etat._t); etat._t = setTimeout(() => { etat.textContent = ''; }, 2500); };
  const changer = (valeur) => {
    champ.value = valeur;
    champ.dispatchEvent(new Event('input', { bubbles: true })); // compteurs et brouillons à jour
  };
  barre.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-outil]');
    if (!b) return;
    if (b.dataset.outil === 'copier') {
      if (!champ.value) { dire('Champ vide.'); return; }
      dire((await copier(champ.value)) ? 'Copié.' : 'Copie impossible.');
    } else if (b.dataset.outil === 'effacer') {
      if (!champ.value) { dire('Champ déjà vide.'); return; }
      sauvegarde = champ.value;
      changer('');
      b.dataset.outil = 'annuler';
      b.querySelector('span').textContent = 'Annuler';
      b.title = 'Remettre le texte effacé';
      dire('Effacé.');
      clearTimeout(minuterie);
      minuterie = setTimeout(() => { b.dataset.outil = 'effacer'; b.querySelector('span').textContent = 'Effacer'; b.title = 'Vider le champ'; sauvegarde = null; }, 8000);
      champ.focus();
    } else if (b.dataset.outil === 'annuler') {
      clearTimeout(minuterie);
      if (sauvegarde != null) changer(sauvegarde);
      sauvegarde = null;
      b.dataset.outil = 'effacer'; b.querySelector('span').textContent = 'Effacer'; b.title = 'Vider le champ';
      dire('Texte remis.');
      champ.focus();
    }
  });
}

function decorer(racine) {
  if (!(racine instanceof Element)) return;
  if (racine.matches('button')) decorerBouton(racine);
  racine.querySelectorAll('button').forEach(decorerBouton);
  if (racine.matches('textarea')) outillerChamp(racine);
  racine.querySelectorAll('textarea').forEach(outillerChamp);
  // Icône du clavier arabe, collée à chaque champ de saisie de texte (clavier.js).
  const CHAMPS = 'input, textarea, [contenteditable="true"]';
  if (racine.matches(CHAMPS)) equiperClavier(racine);
  racine.querySelectorAll(CHAMPS).forEach(equiperClavier);
}

export function initChamps() {
  initClavier();
  decorer(document.body);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') { const b = m.target.parentElement?.closest('button'); if (b) decorerBouton(b); continue; }
      const b = m.target.closest?.('button');
      if (b) decorerBouton(b);
      m.addedNodes.forEach((n) => decorer(n));
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
