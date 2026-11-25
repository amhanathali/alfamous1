// Écouter et suivre la lecture — fonctions pures et moteur de lecture (testables dans Node).
// Voir docs/LECTURE-AUDIO.md. Aucun accès au DOM ici : l'élément audio est fourni par l'appelant.
import { analyserRequete } from './recherche.js';

export const VITESSES = [0.75, 1, 1.25, 1.5];

// ---------- Source audio (une seule fonction à changer pour une autre source ou un autre récitateur) ----------
// Essai (choix de l'auteur, 25 nov.) : Muhammad Ayyoub, récitateur du complexe du roi Fahd, verset par verset,
// 128 kbps, publié par EveryAyah (lu sur place, rien copié). Les fichiers du Complexe lui-même ne sont plus
// téléchargeables pour l'instant ; droits à vérifier avant la production (docs/LECTURE-AUDIO.md § 3 bis).
export const RECITATION = {
  id: 'ayyoub',
  nom: 'Muhammad Ayyoub',
  source: 'EveryAyah',
  base: 'https://everyayah.com/data/Muhammad_Ayyoub_128kbps/',
};
const trois = (n) => String(n).padStart(3, '0');
export function urlAudio(s, v, recitation = RECITATION) {
  return `${recitation.base}${trois(s)}${trois(v)}.mp3`;
}

// ---------- Verset voisin ----------
// nbVersets[s] = nombre de versets de la sourate s (index 0 inutilisé). sens = -1 (précédent) ou 1 (suivant).
// Passe d'une sourate à l'autre ; renvoie null au début (1:1) ou à la fin (114:6) du texte.
export function versetVoisin(nbVersets, s, v, sens) {
  if (sens < 0) return v > 1 ? [s, v - 1] : s > 1 ? [s - 1, nbVersets[s - 1]] : null;
  return v < nbVersets[s] ? [s, v + 1] : s < 114 ? [s + 1, 1] : null;
}

// ---------- « Reprendre à » : même analyse que le champ de recherche (analyserRequete) ----------
//   p3, p 3, page 3 → premier verset de la page 3 ; 3 → 3:1 ; 3.14 ou 3:14 → 3:14 ; 2:1-5 → 2:1.
// sourates : contenu de donnees/sourates.json ; texte(s) : promesse du fichier donnees/texte/SSS.json.
// Renvoie { s, v } ou { erreur }.
export const AIDE_SAISIE = 'Saisissez un verset (3.14), une sourate (3) ou une page (p 3).';
export async function departDepuisSaisie(saisie, { sourates, texte }) {
  const r = analyserRequete(saisie);
  if (r.type === 'vide') return { erreur: AIDE_SAISIE };
  const info = (s) => sourates.find((x) => x.n === s);
  if (r.type === 'sourate' || r.type === 'versets') {
    const i = info(r.sourate);
    if (!i) return { erreur: `La sourate ${r.sourate} n'existe pas (1 à 114).` };
    const v = r.type === 'sourate' ? 1 : r.de;
    if (v < 1 || v > i.versets) return { erreur: `La sourate ${r.sourate} compte ${i.versets} versets.` };
    return { s: r.sourate, v };
  }
  if (r.type === 'page') {
    if (r.page < 1 || r.page > 604) return { erreur: 'Les pages vont de 1 à 604.' };
    for (const i of sourates.filter((x) => x.pageDebut <= r.page && x.pageFin >= r.page)) {
      const t = await texte(i.n);
      const x = t.versets.find((y) => y.page === r.page);
      if (x) return { s: i.n, v: x.v };
    }
    return { erreur: `Aucun verset trouvé pour la page ${r.page}.` };
  }
  return { erreur: AIDE_SAISIE };
}

// ---------- Moteur de lecture ----------
// audio : objet qui se comporte comme HTMLAudioElement (src, playbackRate, play(), pause(),
//         addEventListener('ended' | 'error')). precharge : idem, facultatif (préchargement du verset suivant).
// surChangement(etat) : appelé à chaque changement (verset, lecture/pause, vitesse, message).
// La lecture d'un verset est lancée dans le même appel que le geste de l'utilisateur (exigence de Safari).
export function creerLecteur({ audio, precharge = null, nbVersets, url = urlAudio, surChangement = () => {} }) {
  const etat = { s: null, v: null, enLecture: false, vitesse: 1, message: '', fin: false };
  const signaler = () => surChangement({ ...etat });

  function charger(s, v) {
    etat.s = s; etat.v = v; etat.fin = false; etat.message = '';
    audio.src = url(s, v);
    audio.playbackRate = etat.vitesse;
    const apres = versetVoisin(nbVersets, s, v, 1);
    if (precharge && apres) precharge.src = url(...apres);
  }
  function lancer() {
    etat.enLecture = true;
    etat.message = '';
    let p;
    try { p = audio.play(); } catch (e) { p = Promise.reject(e); }
    if (p && typeof p.catch === 'function') {
      p.catch((e) => {
        if (e?.name === 'AbortError') return; // remplacé par un autre verset : rien à signaler
        etat.enLecture = false;
        etat.message = e?.name === 'NotAllowedError' ? 'Appuyez sur lecture pour démarrer.' : 'Lecture impossible.';
        signaler();
      });
    }
    signaler();
  }

  audio.addEventListener('ended', () => {
    if (!etat.enLecture) return;
    const apres = versetVoisin(nbVersets, etat.s, etat.v, 1);
    if (!apres) { etat.enLecture = false; etat.fin = true; etat.message = 'Fin du texte.'; signaler(); return; }
    charger(...apres);
    lancer();
  });
  audio.addEventListener('error', () => {
    if (etat.s == null) return;
    etat.enLecture = false;
    etat.message = `Récitation indisponible pour ${etat.s}:${etat.v} (réseau ou fichier).`;
    try { audio.pause(); } catch { /* rien */ }
    signaler();
  });

  return {
    get etat() { return { ...etat }; },
    // Lire à partir du verset s:v.
    jouerDepuis(s, v) { charger(s, v); lancer(); },
    lire() {
      if (etat.s == null) return;
      if (etat.fin) { charger(etat.s, etat.v); }
      lancer();
    },
    pause() { etat.enLecture = false; try { audio.pause(); } catch { /* rien */ } signaler(); },
    basculer() { if (etat.enLecture) this.pause(); else this.lire(); },
    // Verset précédent ou suivant ; garde l'état lecture/pause.
    aller(sens) {
      if (etat.s == null) return false;
      const cible = versetVoisin(nbVersets, etat.s, etat.v, sens);
      if (!cible) return false;
      const enLecture = etat.enLecture;
      charger(...cible);
      if (enLecture) lancer(); else signaler();
      return true;
    },
    regleVitesse(vitesse) {
      if (!VITESSES.includes(vitesse)) return;
      etat.vitesse = vitesse;
      audio.playbackRate = vitesse;
      signaler();
    },
    vitesseSuivante() {
      this.regleVitesse(VITESSES[(VITESSES.indexOf(etat.vitesse) + 1) % VITESSES.length]);
    },
    // Fermer la fenêtre = arrêter la lecture.
    arreter() {
      etat.enLecture = false;
      try { audio.pause(); } catch { /* rien */ }
      audio.src = '';
      if (precharge) precharge.src = '';
      etat.s = null; etat.v = null; etat.message = ''; etat.fin = false;
      signaler();
    },
  };
}
