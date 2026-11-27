// Tests du clavier arabe à l'écran (npm test) : champs équipés, frappe, effacement, masquage puis
// retour du clavier du système (inputmode).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><body>
  <form id="f" class="recherche"><div class="champ"><input id="requete" type="text" dir="auto"></div></form>
  <input id="fr" type="text">
  <input id="ar" type="text" dir="auto" inputmode="text" maxlength="5">
  <input id="mail" type="email" dir="auto">
  <textarea id="com"></textarea>
  <textarea id="code" spellcheck="false"></textarea>
  <div class="lecteur"><input id="lect" type="text" dir="auto"></div>
</body>`, { pretendToBeVisual: true });
for (const k of ['window', 'document', 'Event', 'KeyboardEvent', 'HTMLElement']) globalThis[k] = dom.window[k];
const { accepteClavier, inserer, effacerArriere, equiperClavier, ouvrir, fermer, RANGEES } = await import('../src/js/clavier.js');
const $ = (s) => document.querySelector(s);

test('champs équipés : recherche, dir=auto texte, zones de texte éditables', () => {
  assert.equal(accepteClavier($('#requete')), true);
  assert.equal(accepteClavier($('#ar')), true);
  assert.equal(accepteClavier($('#com')), true);
  assert.equal(accepteClavier($('#fr')), false, 'champ sans dir=auto');
  assert.equal(accepteClavier($('#mail')), false, 'courriel');
  assert.equal(accepteClavier($('#code')), false, 'code HTML (spellcheck=false)');
  assert.equal(accepteClavier($('#lect')), false, 'lecteur audio');
});

test('frappe à la place de la sélection, maxlength respecté, effacement', () => {
  const c = $('#ar');
  let saisies = 0;
  c.addEventListener('input', () => { saisies++; });
  c.value = 'رحم'; c.setSelectionRange(1, 2);
  assert.equal(inserer(c, 'ك'), true);
  assert.equal(c.value, 'ركم');
  assert.equal(c.selectionStart, 2);
  assert.equal(inserer(c, 'تب'), true);
  assert.equal(inserer(c, 'ب'), false, 'maxlength 5');
  assert.equal(c.value, 'ركتبم');
  c.setSelectionRange(5, 5);
  assert.equal(effacerArriere(c), true);
  assert.equal(c.value, 'ركتب');
  c.setSelectionRange(0, 0);
  assert.equal(effacerArriere(c), false);
  assert.equal(saisies, 3);
});

test('ouvrir masque le clavier du système ; fermer remet l\'inputmode d\'avant', () => {
  for (const el of document.querySelectorAll('input, textarea')) equiperClavier(el);
  const ar = $('#ar'); const req = $('#requete');
  assert.ok(req.parentElement.querySelector('.bouton-clavier'), 'icône dans le champ de recherche');
  assert.ok(ar.parentElement.classList.contains('avec-clavier'), 'icône collée au champ');
  assert.equal($('#fr').parentElement, document.body, 'champ non équipé intact');

  ouvrir(ar);
  assert.equal(ar.getAttribute('inputmode'), 'none');
  assert.equal(document.activeElement, ar);
  assert.equal($('.clavier-ar').hidden, false);
  assert.equal(RANGEES.every((r) => r.length === 12), true);

  ouvrir(req); // passage à un autre champ
  assert.equal(ar.getAttribute('inputmode'), 'text', 'inputmode d\'origine remis');
  assert.equal(req.getAttribute('inputmode'), 'none');

  req.value = '';
  $('.clavier-ar [data-touche="ر"]').click();
  $('.clavier-ar [data-touche="ح"]').click();
  assert.equal(req.value, 'رح');

  $('.clavier-ar [data-action="fermer"]').click();
  assert.equal(req.hasAttribute('inputmode'), false, 'attribut absent avant : retiré');
  assert.equal($('.clavier-ar').hidden, true);
  assert.equal(document.activeElement, req, 'le champ reprend le focus (clavier du système)');
  fermer();
});
