// Phase 4 : préparation de l'import des commentaires de l'ancienne application (classeur Lexique-Coran).
// Fonctions pures (testées par npm test, tests/import.test.mjs) ; l'écriture dans Firestore est dans
// scripts/importer.mjs.
//
// Décisions de l'auteur (23 nov. 2026, docs/DECISIONS.md) :
//   - seuls les commentaires d'Amha Nathali et d'Afrukh Ifereles sont importés (versets et lexique) ;
//   - signatures harmonisées : « Amha » → « Amha Nathali », sans signature → « Anonyme » ;
//   - clés du lexique sans voyelles (normaliserCle) : les clés qui se confondent sont regroupées ;
//   - commentaires sans date : date de 2024 (1er janvier 2024, midi, heure de Montréal), marquée « estimée » ;
//   - les commentaires d'Amha Nathali sont reliés à son compte (il peut les modifier) ;
//   - les comptes des anciens membres ne sont pas importés ;
//   - blocs non signés suivis d'une signature seule : écartés (pas d'attribution déduite) ;
//   - commentaires « Validé par » : ni le commentaire validé (anonyme ou d'un autre membre), ni la mention ;
//   - essais écartés : entrées de test listées dans ESSAIS (lexique « todo », verset 5:1 « - »).
import { createHash } from 'node:crypto';
import { decouperCommentaires } from './commentaires.mjs';
import { normaliserCle, CLE_MAX } from '../../src/js/lexique-outils.js';

export const SOURCE = 'Lexique-Coran';
export const DATE_PAR_DEFAUT = '2024-01-01T12:00:00';
export const TEXTE_MAX = 4000; // limite d'un commentaire écrit depuis le site (firestore.rules)

// Signatures de l'ancienne application → nom affiché dans Alfamous1 (comparaison sans casse ni espaces doubles).
export const ALIAS_AUTEURS = { 'amha': 'Amha Nathali', 'amha nathali': 'Amha Nathali', 'anonyme': 'Anonyme' };
// Auteurs dont les commentaires sont importés (noms après harmonisation).
export const AUTEURS_RETENUS = ['Amha Nathali', 'Afrukh Ifereles'];

// Entrées de test de l'ancienne application (décision de l'auteur, 23 nov. 2026).
export const ESSAIS = [{ type: 'lexique', origine: 'todo' }, { type: 'verset', origine: '5:1', texte: '-' }];
const VALIDE_PAR = /^\s*valid[ée] par\s*:?\s*$/i;

const cleAuteur = (a) => String(a ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function harmoniserAuteur(brut, alias = ALIAS_AUTEURS) {
  const a = String(brut ?? '').trim().replace(/\s+/g, ' ');
  if (!a) return 'Anonyme';
  return alias[a.toLowerCase()] || a;
}

// Heure locale de Montréal (« AAAA-MM-JJTHH:MM:SS », sans fuseau) → Date (UTC), heure d'été comprise.
export function dateMontreal(locale) {
  const m = String(locale).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [a, mo, j, h, mi, s] = m.slice(1).map(Number);
  const commeUtc = Date.UTC(a, mo - 1, j, h, mi, s);
  // Décalage de Montréal à cet instant (deux passes pour les changements d'heure).
  let t = commeUtc;
  for (let i = 0; i < 2; i++) t = commeUtc - decalage(t);
  return new Date(t);
}
function decalage(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}

const empreinte = (t) => createHash('sha1').update(t, 'utf8').digest('hex').slice(0, 12);

// Lignes CSV → commentaires bruts (avant filtrage).
// Versets1 : en-tête avec Soura, Aya, Trad.Lex. Lexique1 : colonnes clé, texte (en-tête en 1re ligne).
export function extraireVersets(lignes) {
  const [entete, ...corps] = lignes;
  const col = Object.fromEntries(entete.map((nom, i) => [nom.trim(), i]));
  for (const nom of ['Soura', 'Aya', 'Trad.Lex']) {
    if (!(nom in col)) throw new Error(`Colonne manquante dans Versets1 : ${nom}`);
  }
  const res = [];
  for (const r of corps) {
    const s = Number(r[col.Soura]); const v = Number(r[col.Aya]);
    if (!s || !v) continue;
    decouperCommentaires(r[col['Trad.Lex']]).forEach((c, ordre) => {
      res.push({ type: 'verset', origine: `${s}:${v}`, cle: `${s}:${v}`, ordre, ...c });
    });
  }
  return res;
}

export function extraireLexique(lignes) {
  const res = [];
  for (const [cleBrute, texte] of lignes.slice(1)) {
    if (!cleBrute || !cleBrute.trim()) continue;
    decouperCommentaires(texte).forEach((c, ordre) => {
      res.push({ type: 'lexique', origine: cleBrute.trim(), cle: normaliserCle(cleBrute), ordre, ...c });
    });
  }
  return res;
}

// Commentaires bruts → documents Firestore (sans les dates serveur) + rapport.
//   nbVersetsParSourate : { 1: 7, 2: 286, … } (donnees/sourates.json), pour contrôler les références.
//   uidParAuteur : { 'Amha Nathali': 'uid…' } ; un auteur absent reste sans compte (auteurUid null).
export function preparerImport(bruts, { nbVersetsParSourate = null, uidParAuteur = {},
  auteursRetenus = AUTEURS_RETENUS, alias = ALIAS_AUTEURS } = {}) {
  const retenus = new Set(auteursRetenus.map(cleAuteur));
  const documents = [];
  const ecartes = [];
  const anomalies = [];
  const signatures = new Map(); // nom harmonisé → { n, retenu, bruts:Set }
  const clesFusionnees = new Map(); // clé normalisée → Set(clés d'origine)

  for (const c of bruts) {
    const auteurNom = harmoniserAuteur(c.auteur, alias);
    const sig = signatures.get(auteurNom) || { n: 0, retenu: retenus.has(cleAuteur(auteurNom)), bruts: new Set() };
    sig.n++; sig.bruts.add(c.auteur ?? '(sans signature)'); signatures.set(auteurNom, sig);
    const ref = `${c.type === 'verset' ? 'verset' : 'lexique'} ${c.origine} n° ${c.ordre + 1}`;
    const ecarter = (raison) => ecartes.push({ ref, auteurNom, raison });

    if (!sig.retenu) { ecarter('auteur non retenu'); continue; }
    if (c.vide || !c.texte.trim()) { ecarter('signature sans texte'); continue; }
    if (/^CSC-Tradition$/i.test(c.auteur || '')) { ecarter('CSC-Tradition'); continue; }
    if (VALIDE_PAR.test(c.texte)) { ecarter('mention « Validé par » (validation d\'un autre commentaire)'); continue; }
    if (ESSAIS.some((e) => e.type === c.type && e.origine === c.origine && (e.texte === undefined || e.texte === c.texte.trim()))) {
      ecarter('entrée de test'); continue;
    }

    if (c.type === 'verset') {
      const [s, v] = c.cle.split(':').map(Number);
      if (nbVersetsParSourate && !(s >= 1 && s <= 114 && v >= 1 && v <= (nbVersetsParSourate[s] || 0))) {
        ecarter('référence de verset inexistante'); continue;
      }
    } else {
      if (!c.cle) { ecarter('clé vide après retrait des voyelles'); continue; }
      if (c.cle.length > CLE_MAX) { ecarter(`clé de plus de ${CLE_MAX} caractères`); continue; }
      if (!clesFusionnees.has(c.cle)) clesFusionnees.set(c.cle, new Set());
      clesFusionnees.get(c.cle).add(c.origine);
    }

    let dateEstimee = false;
    let dateLocale = c.date;
    if (!dateLocale) {
      if (c.dateBrute) anomalies.push(`${ref} : date illisible « ${c.dateBrute} », remplacée par 2024`);
      dateLocale = DATE_PAR_DEFAUT; dateEstimee = true;
    }
    if (c.texte.length > TEXTE_MAX) {
      anomalies.push(`${ref} : ${c.texte.length} caractères (plus de ${TEXTE_MAX} : importé, mais l'auteur ne pourra pas le modifier depuis le site sans le raccourcir)`);
    }

    const id = c.type === 'verset'
      ? `imp-v-${c.cle.replace(':', '-')}-${c.ordre}`
      : `imp-l-${empreinte(c.origine)}-${c.ordre}`;
    documents.push({
      id,
      donnees: {
        type: c.type,
        cle: c.cle,
        auteurUid: uidParAuteur[auteurNom] ?? null,
        auteurNom,
        texte: c.texte,
        creeLe: dateMontreal(dateLocale),
        modifieLe: null,
        nbVersions: 1,
        masque: null,
        import: { source: SOURCE, origine: c.origine, ordre: c.ordre, dateBrute: c.dateBrute ?? null, dateEstimee },
      },
    });
  }

  const ids = new Set();
  for (const d of documents) {
    if (ids.has(d.id)) throw new Error(`Identifiant en double : ${d.id}`);
    ids.add(d.id);
  }
  const fusions = [...clesFusionnees].filter(([, o]) => o.size > 1).map(([cle, o]) => ({ cle, origines: [...o] }));
  return { documents, ecartes, anomalies, signatures, fusions };
}

// Rapport lisible (import/rapport-import.txt).
export function texteRapport({ documents, ecartes, anomalies, signatures, fusions }) {
  const parType = (t) => documents.filter((d) => d.donnees.type === t);
  const lignes = [
    `Import ${SOURCE} → Alfamous1`,
    '',
    `À importer : ${documents.length} commentaires`,
    `  versets : ${parType('verset').length} (sur ${new Set(parType('verset').map((d) => d.donnees.cle)).size} versets)`,
    `  lexique : ${parType('lexique').length} définitions (sur ${new Set(parType('lexique').map((d) => d.donnees.cle)).size} entrées)`,
    `  date estimée (2024) : ${documents.filter((d) => d.donnees.import.dateEstimee).length}`,
    `  reliés à un compte : ${documents.filter((d) => d.donnees.auteurUid).length}`,
    '',
    'Par auteur (importés) :',
    ...Object.entries(documents.reduce((a, d) => ({ ...a, [d.donnees.auteurNom]: (a[d.donnees.auteurNom] || 0) + 1 }), {}))
      .map(([a, n]) => `  ${a} : ${n}`),
    '',
    'Toutes les signatures du classeur (nom harmonisé ← signatures d\'origine) :',
    ...[...signatures].sort((a, b) => b[1].n - a[1].n)
      .map(([a, s]) => `  ${s.retenu ? '[importé]  ' : '[écarté]   '}${a} (${s.n}) ← ${[...s.bruts].join(' | ')}`),
    '',
    `Écartés : ${ecartes.length}`,
    ...Object.entries(ecartes.reduce((a, e) => ({ ...a, [e.raison]: (a[e.raison] || 0) + 1 }), {})).map(([r, n]) => `  ${r} : ${n}`),
    ...ecartes.filter((e) => e.raison !== 'auteur non retenu').map((e) => `    ${e.ref} (${e.auteurNom}) : ${e.raison}`),
    '',
    `Clés du lexique regroupées après retrait des voyelles : ${fusions.length}`,
    ...fusions.map((f) => `  ${f.cle} ← ${f.origines.join(' | ')}`),
    '',
    `Anomalies : ${anomalies.length}`,
    ...anomalies.map((a) => `  ${a}`),
  ];
  return lignes.join('\n') + '\n';
}

// Fiche de contrôle (import/controle-import.csv) : une ligne par commentaire, avec son lien sur le site.
export function csvControle(documents, site) {
  const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const lien = (d) => (d.type === 'verset'
    ? `${site}/#/q/${encodeURIComponent(d.cle)}`
    : `${site}/#/lexique/${encodeURIComponent(d.cle)}`);
  const lignes = [['id', 'type', 'clé', 'clé d\'origine', 'auteur', 'date', 'date estimée', 'caractères', 'début du texte', 'lien'].map(q).join(',')];
  for (const { id, donnees: d } of documents) {
    lignes.push([id, d.type, d.cle, d.import.origine, d.auteurNom, d.creeLe.toISOString(), d.import.dateEstimee ? 'oui' : '',
      d.texte.length, d.texte.replace(/\s+/g, ' ').slice(0, 80), lien(d)].map(q).join(','));
  }
  return '﻿' + lignes.join('\r\n') + '\r\n'; // BOM : Excel lit l'UTF-8 (arabe)
}
