// Tests d'« écouter et suivre la lecture » (npm test) : analyse de la saisie, enchaînement des versets,
// changement de sourate, arrêt. Le lecteur est essayé avec un faux élément audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  urlAudio, versetVoisin, departDepuisSaisie, creerLecteur, VITESSES, AIDE_SAISIE,
} from '../src/js/lecteur-outils.js';

const lire = (f) => JSON.parse(readFileSync(new URL(`../donnees/${f}`, import.meta.url)));
const sourates = lire('sourates.json');
const nbVersets = [0, ...sourates.map((x) => x.versets)];
const texte = async (s) => lire(`texte/${String(s).padStart(3, '0')}.json`);
const depart = (q) => departDepuisSaisie(q, { sourates, texte });

// Faux HTMLAudioElement : play() réussit (ou échoue si on le demande), les événements sont déclenchés à la main.
class FauxAudio extends EventTarget {
  constructor() { super(); this.src = ''; this.playbackRate = 1; this.joue = false; this.lectures = []; this.echec = null; }
  play() {
    if (this.echec) { const e = new Error('refus'); e.name = this.echec; return Promise.reject(e); }
    this.joue = true; this.lectures.push(this.src); return Promise.resolve();
  }
  pause() { this.joue = false; }
  finir() { this.joue = false; this.dispatchEvent(new Event('ended')); }
  casser() { this.dispatchEvent(new Event('error')); }
}
function nouveau(options = {}) {
  const audio = new FauxAudio();
  const precharge = new FauxAudio();
  const etats = [];
  const l = creerLecteur({ audio, precharge, nbVersets, surChangement: (e) => etats.push(e), ...options });
  return { l, audio, precharge, etats };
}
const attendre = () => new Promise((r) => setTimeout(r, 0));

test('données : numérotation Hafs (6 236 versets), alignée sur un audio par verset', () => {
  assert.equal(nbVersets.reduce((a, b) => a + b, 0), 6236);
  assert.equal(nbVersets[2], 286);
  assert.equal(nbVersets[114], 6);
});

test('adresse audio : SSSVVV.mp3', () => {
  assert.equal(urlAudio(3, 14), 'https://everyayah.com/data/Ghamadi_40kbps/003014.mp3');
  assert.equal(urlAudio(114, 6), 'https://everyayah.com/data/Ghamadi_40kbps/114006.mp3');
  assert.equal(urlAudio(1, 1, { base: 'https://exemple.test/r/' }), 'https://exemple.test/r/001001.mp3');
});

test('verset voisin : dans la sourate, au changement de sourate, aux bornes du texte', () => {
  assert.deepEqual(versetVoisin(nbVersets, 3, 14, 1), [3, 15]);
  assert.deepEqual(versetVoisin(nbVersets, 2, 286, 1), [3, 1]);
  assert.deepEqual(versetVoisin(nbVersets, 3, 1, -1), [2, 286]);
  assert.equal(versetVoisin(nbVersets, 114, 6, 1), null);
  assert.equal(versetVoisin(nbVersets, 1, 1, -1), null);
});

test('« Reprendre à » : mêmes règles que le champ de recherche', async () => {
  assert.deepEqual(await depart('3.14'), { s: 3, v: 14 });
  assert.deepEqual(await depart('3:14'), { s: 3, v: 14 });
  assert.deepEqual(await depart(' 3 '), { s: 3, v: 1 });
  assert.deepEqual(await depart('2:1-5'), { s: 2, v: 1 });
  // Page : premier verset de la page, lu dans les données (page 1 = 1:1 ; page 3 commence dans la sourate 2).
  assert.deepEqual(await depart('p1'), { s: 1, v: 1 });
  const p3 = await depart('p3');
  const t2 = await texte(2);
  assert.equal(p3.s, 2);
  assert.equal(p3.v, t2.versets.find((x) => x.page === 3).v);
  assert.deepEqual(await depart('p 3'), p3);
  assert.deepEqual(await depart('page 3'), p3);
  // Une page qui commence au milieu du texte : le verset renvoyé est bien sur cette page, et le précédent non.
  const p50 = await depart('p50');
  const x50 = (await texte(p50.s)).versets.find((x) => x.v === p50.v);
  assert.equal(x50.page, 50);
  const avant = versetVoisin(nbVersets, p50.s, p50.v, -1);
  assert.notEqual((await texte(avant[0])).versets.find((x) => x.v === avant[1]).page, 50);
});

test('« Reprendre à » : saisies refusées avec un message', async () => {
  assert.equal((await depart('')).erreur, AIDE_SAISIE);
  assert.equal((await depart('رحم')).erreur, AIDE_SAISIE);
  assert.equal((await depart('sabr')).erreur, AIDE_SAISIE);
  assert.match((await depart('115')).erreur, /n'existe pas/);
  assert.match((await depart('0')).erreur, /n'existe pas/);
  assert.match((await depart('3.201')).erreur, /compte 200 versets/);
  assert.match((await depart('p605')).erreur, /1 à 604/);
});

test('lecture : départ au verset choisi, enchaînement verset après verset', () => {
  const { l, audio, precharge } = nouveau();
  l.jouerDepuis(3, 14);
  assert.equal(audio.src, urlAudio(3, 14));
  assert.equal(precharge.src, urlAudio(3, 15), 'le verset suivant est préchargé');
  assert.equal(l.etat.enLecture, true);
  audio.finir();
  assert.deepEqual([l.etat.s, l.etat.v], [3, 15]);
  assert.equal(audio.joue, true);
  audio.finir();
  assert.deepEqual([l.etat.s, l.etat.v], [3, 16]);
  assert.deepEqual(audio.lectures, [urlAudio(3, 14), urlAudio(3, 15), urlAudio(3, 16)]);
});

test('lecture : passage d\'une sourate à la suivante sans arrêt', () => {
  const { l, audio, precharge } = nouveau();
  l.jouerDepuis(2, 286);
  assert.equal(precharge.src, urlAudio(3, 1));
  audio.finir();
  assert.deepEqual([l.etat.s, l.etat.v], [3, 1]);
  assert.equal(l.etat.enLecture, true);
  assert.equal(audio.src, urlAudio(3, 1));
});

test('lecture : fin du texte (114:6) → arrêt avec message', () => {
  const { l, audio } = nouveau();
  l.jouerDepuis(114, 6);
  audio.finir();
  assert.equal(l.etat.enLecture, false);
  assert.equal(l.etat.fin, true);
  assert.equal(l.etat.message, 'Fin du texte.');
  assert.deepEqual([l.etat.s, l.etat.v], [114, 6]);
  l.lire(); // relire le dernier verset
  assert.equal(l.etat.enLecture, true);
});

test('pause : la fin d\'un verset en pause ne relance rien', () => {
  const { l, audio } = nouveau();
  l.jouerDepuis(1, 1);
  l.pause();
  assert.equal(audio.joue, false);
  audio.finir();
  assert.deepEqual([l.etat.s, l.etat.v], [1, 1]);
  l.basculer();
  assert.equal(l.etat.enLecture, true);
  l.basculer();
  assert.equal(l.etat.enLecture, false);
});

test('précédent / suivant : garde l\'état lecture ou pause, traverse les sourates, s\'arrête aux bornes', () => {
  const { l, audio } = nouveau();
  l.jouerDepuis(3, 1);
  assert.equal(l.aller(-1), true);
  assert.deepEqual([l.etat.s, l.etat.v, l.etat.enLecture], [2, 286, true]);
  l.pause();
  const n = audio.lectures.length;
  assert.equal(l.aller(1), true);
  assert.deepEqual([l.etat.s, l.etat.v, l.etat.enLecture], [3, 1, false]);
  assert.equal(audio.lectures.length, n, 'en pause, aucun son lancé');
  l.jouerDepuis(1, 1);
  assert.equal(l.aller(-1), false);
  l.jouerDepuis(114, 6);
  assert.equal(l.aller(1), false);
});

test('arrêt (fermeture de la fenêtre) : plus de son, plus d\'enchaînement', () => {
  const { l, audio, precharge } = nouveau();
  l.jouerDepuis(2, 255);
  l.arreter();
  assert.equal(audio.joue, false);
  assert.equal(audio.src, '');
  assert.equal(precharge.src, '');
  assert.equal(l.etat.s, null);
  audio.finir();
  audio.casser(); // le navigateur signale une erreur quand src est vidé : ignorée
  assert.equal(l.etat.s, null);
  assert.equal(l.etat.message, '');
  l.lire(); // sans verset : rien
  assert.equal(l.etat.enLecture, false);
  assert.equal(l.aller(1), false);
});

test('erreur de fichier ou de réseau : pause et message, pas de saut silencieux', () => {
  const { l, audio } = nouveau();
  l.jouerDepuis(2, 1);
  audio.casser();
  assert.equal(l.etat.enLecture, false);
  assert.match(l.etat.message, /indisponible pour 2:1/);
  assert.deepEqual([l.etat.s, l.etat.v], [2, 1]);
});

test('lecture refusée par le navigateur (iPhone sans geste) : message, pas d\'état « en lecture »', async () => {
  const { l, audio, etats } = nouveau();
  audio.echec = 'NotAllowedError';
  l.jouerDepuis(1, 1);
  await attendre();
  assert.equal(l.etat.enLecture, false);
  assert.equal(l.etat.message, 'Appuyez sur lecture pour démarrer.');
  assert.equal(etats.at(-1).message, 'Appuyez sur lecture pour démarrer.');
  audio.echec = 'AbortError'; // lecture interrompue par un autre verset : pas de message
  l.jouerDepuis(1, 2);
  await attendre();
  assert.equal(l.etat.message, '');
});

test('vitesse : 0,75 · 1 · 1,25 · 1,5, appliquée aux versets suivants', () => {
  assert.deepEqual(VITESSES, [0.75, 1, 1.25, 1.5]);
  const { l, audio } = nouveau();
  l.jouerDepuis(1, 1);
  l.vitesseSuivante();
  assert.equal(l.etat.vitesse, 1.25);
  assert.equal(audio.playbackRate, 1.25);
  l.vitesseSuivante(); l.vitesseSuivante();
  assert.equal(l.etat.vitesse, 0.75);
  audio.finir();
  assert.equal(audio.playbackRate, 0.75, 'gardée au verset suivant');
  l.regleVitesse(3); // hors liste : ignorée
  assert.equal(l.etat.vitesse, 0.75);
});
