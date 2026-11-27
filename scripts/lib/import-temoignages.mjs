// Import des témoignages de l'ancienne application (projet alfamous-amha, collection temoignages) :
// fonctions pures, testées par npm test (tests/import-temoignages.test.mjs). Script : scripts/importer-temoignages.mjs.
import { ancienContenuEnTexte, LIMITES_TEMOIGNAGE } from '../../src/js/temoignages-outils.js';
import { AUTEUR } from './import-articles.mjs';

export const SOURCE_TEMOIGNAGES = 'alfamous-amha';
// Lecture publique de l'ancienne collection (règle « allow read: if true ») : aucune clé, rien n'est écrit là-bas.
export const URL_ANCIENS = 'https://firestore.googleapis.com/v1/projects/alfamous-amha/databases/(default)/documents/temoignages';

// Alias de l'ancien formulaire qui valent « Masquer mon nom » (« moi » n'est pas une signature).
const ALIAS_ANONYMES = new Set(['', 'anonyme', 'anonymous', 'moi']);
// Alias qui désignent l'auteur du site : signés de son nom et reliés à son compte.
const ALIAS_AUTEUR = new Set(['amha', 'amha nathali']);

// Valeur d'un champ du format REST de Firestore ({ stringValue }, { timestampValue }…).
function valeur(f) {
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('timestampValue' in f) return f.timestampValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('booleanValue' in f) return f.booleanValue;
  if ('nullValue' in f) return null;
  return null;
}

// Réponse(s) REST → documents simples { id, ...champs }.
export function lireRest(pages) {
  return [].concat(pages).flatMap((p) => p.documents || []).map((d) => {
    const champs = Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, valeur(v)]));
    return { id: d.name.split('/').pop(), ...champs };
  });
}

export const idImporte = (ancienId) => `imp-t-${ancienId}`;

// Prépare l'import : seuls les témoignages approuvés sont repris (les autres sont écartés et listés).
// Le courriel de l'ancien formulaire n'est jamais recopié.
export function preparerTemoignages(anciens, { uidAuteur = null } = {}) {
  const temoignages = []; const ecartes = []; const anomalies = [];
  for (const a of anciens) {
    if (a.status !== 'approved') { ecartes.push(`${a.id} : statut ${a.status || '—'} (« ${a.title || ''} »)`); continue; }
    const alias = String(a.authorAlias || '').trim();
    const cle = alias.toLocaleLowerCase('fr');
    const anonyme = ALIAS_ANONYMES.has(cle);
    const estAuteur = ALIAS_AUTEUR.has(cle);
    const nom = anonyme ? '' : estAuteur ? AUTEUR : alias.slice(0, 80);
    const texte = ancienContenuEnTexte(a.content).slice(0, LIMITES_TEMOIGNAGE.texteMax);
    let titre = String(a.title || '').trim().slice(0, LIMITES_TEMOIGNAGE.titre);
    if (!titre) { titre = texte.split('\n')[0].slice(0, 80); anomalies.push(`${a.id} : sans titre, titre repris du début du texte`); }
    if (texte.length < LIMITES_TEMOIGNAGE.texteMin) anomalies.push(`${a.id} : texte court (${texte.length} caractères)`);
    if (cle === 'moi') anomalies.push(`${a.id} : alias « moi » publié en Anonyme`);
    const date = new Date(a.createdAt || a.publishedAt || a.clientAt || Date.UTC(2026, 0, 1));
    const uid = estAuteur ? uidAuteur : null;
    temoignages.push({
      id: idImporte(a.id),
      public: {
        titre, texte, anonyme, auteurUid: anonyme ? null : uid, auteurNom: nom,
        creeLe: date, modifieLe: null, nbVersions: 1, masque: null,
      },
      prive: { auteurUid: uid, auteurNom: anonyme ? (alias || 'anonyme') : nom },
      import: { source: SOURCE_TEMOIGNAGES, ancienId: a.id, publieLe: a.publishedAt ? new Date(a.publishedAt) : null },
    });
  }
  temoignages.sort((x, y) => y.public.creeLe - x.public.creeLe);
  return { temoignages, ecartes, anomalies };
}

export function texteRapportTemoignages(prep, { cible }) {
  const l = [`Import des témoignages (${SOURCE_TEMOIGNAGES}) — ${cible} — ${new Date().toISOString()}`, ''];
  l.push(`Repris : ${prep.temoignages.length} (anonymes : ${prep.temoignages.filter((t) => t.public.anonyme).length})`);
  for (const t of prep.temoignages) {
    l.push(`  ${t.id} · ${t.public.creeLe.toISOString().slice(0, 10)} · ${t.public.anonyme ? 'Anonyme' : t.public.auteurNom} · ${t.public.titre} (${t.public.texte.length} car.)`);
  }
  l.push('', `Écartés : ${prep.ecartes.length}`, ...prep.ecartes.map((x) => `  ${x}`));
  l.push('', `Anomalies : ${prep.anomalies.length}`, ...prep.anomalies.map((x) => `  ${x}`));
  return `${l.join('\n')}\n`;
}
