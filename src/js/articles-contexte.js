// Panneau « Contexte » de l'éditeur d'articles (privé, sert à écrire) et « Dossier pour Claude » (docs/ARTICLES.md § 2 et 7).
// Éléments : versets, racines, lexique, sources, fichiers, discussions du forum, Mes Notes liées, vérification
// (fait / déduction / hypothèse), définitions proposées « à valider », recherches Alfamous, articles liés.
import { firebase, avecDelai, stockage } from './firebase.js';
import { session, ouvrirFenetre, fermerFenetre } from './compte.js';
import { echapper, dateCourte, messageErreur } from './commentaires-format.js';
import { publierCommentaire } from './commentaires.js';
import { normaliserCle } from './lexique-outils.js';
import { FAMILLES } from './articles-outils.js';
import { texteBrut } from './articles-assainir.js';
import * as D from './donnees.js';

const lienRequete = (q) => `#/q/${encodeURIComponent(q)}`;
const TYPES_VERIF = { fait: 'fait', deduction: 'déduction', hypothese: 'hypothèse' };

// Contexte complet, quel que soit l'état enregistré (anciens brouillons : versets, sources, fichiers seulement).
export function normaliserContexte(c = {}) {
  const l = (x) => (Array.isArray(x) ? x : []);
  return {
    ...c,
    versets: l(c.versets), sources: l(c.sources), fichiers: l(c.fichiers), racines: l(c.racines), lexique: l(c.lexique),
    fils: l(c.fils), notes: l(c.notes), verification: l(c.verification), definitions: l(c.definitions),
    recherches: l(c.recherches), liens: l(c.liens),
  };
}

// Références « s:v » ou « s:v-w » → liste de versets existants (50 au plus).
export async function developperRefs(texte) {
  const m = String(texte).trim().match(/^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/);
  if (!m) return [];
  const s = Number(m[1]); const de = Number(m[2]); const a = Number(m[3] || m[2]);
  const sour = (await D.sourates()).find((x) => x.n === s);
  if (!sour || de < 1 || a < de || a > sour.versets || a - de > 50) return [];
  return Array.from({ length: a - de + 1 }, (_, i) => `${s}:${de + i}`);
}
export async function verset(ref) {
  const [s, v] = ref.split(':').map(Number);
  const x = (await D.texte(s)).versets.find((e) => e.v === v);
  if (!x) throw new Error(`Verset ${ref} introuvable.`);
  return x;
}

// ---------- Panneau ----------
// options : { panneau, ctx: () => contexte, article: () => { id } | null, sauver, inserer, blocVerset, msg }
export function creerPanneau(o) {
  const { panneau } = o;
  const c = () => o.ctx();
  let racinesCoran = {};
  let filsAuto = [];
  D.racines().then((r) => { racinesCoran = r; dessiner(); }).catch(() => {});

  async function chargerFilsAuto() {
    const a = o.article();
    if (!a?.id) return;
    try {
      const { db, F } = await firebase();
      const q = F.query(F.collection(db, 'notes'), F.where('publie', '==', true), F.where('lien.type', '==', 'article'), F.where('lien.cle', '==', a.id));
      filsAuto = (await avecDelai(F.getDocs(q))).docs.map((d) => ({ id: d.id, titre: d.data().titre || 'Sans titre' }));
      dessiner();
    } catch { /* forum indisponible */ }
  }

  const section = (cle, titre, n, corps, ouvert = false) => `<details class="ctx" data-sec="${cle}" ${ouvert || etatOuvert.has(cle) ? 'open' : ''}>
    <summary>${titre}<span class="n">${n}</span></summary><div class="ctx-corps">${corps}</div></details>`;
  const etatOuvert = new Set(['versets']);
  const vide = (t) => `<p class="aide">${t}</p>`;
  const retirer = (liste, i) => `<button type="button" data-retirer="${liste}" data-i="${i}">retirer</button>`;

  function dessiner() {
    const x = c();
    const occ = (r) => { const o2 = racinesCoran[r]; return o2 ? `${o2.length} occurrence${o2.length > 1 ? 's' : ''}, ${new Set(o2.map((z) => z.split(':').slice(0, 2).join(':'))).size} versets` : 'pas une racine du Coran'; };
    const fils = [...filsAuto.filter((f) => !x.fils.some((g) => g.id === f.id)).map((f) => ({ ...f, auto: true })), ...x.fils];
    const nonVerifies = x.verification.filter((v) => !v.verifie).length;
    panneau.innerHTML = `<h2>Contexte <small>privé · sert à écrire</small></h2>
      ${section('versets', 'Versets', x.versets.length, `
        ${x.versets.map((v, i) => `<div class="ctx-item"><div><a class="ref" href="${lienRequete(v.ref)}" target="_blank">${echapper(v.ref)}</a>
          <label class="cite"><input type="checkbox" data-cite="${i}" ${v.cite ? 'checked' : ''}> cité (affiché sous le verset)</label>
          <input class="note-ctx" type="text" data-note-v="${i}" value="${echapper(v.note || '')}" placeholder="note"></div>
          <div class="actions"><button type="button" data-inserer-v="${i}">insérer</button>${retirer('versets', i)}</div></div>`).join('') || vide('Aucun verset. « + Verset », la sélection de la lecture (« Ajouter au contexte… ») ou :')}
        <div class="ctx-ajout"><input type="text" data-ajout="versets" placeholder="2:183 ou 2:183-187"><button type="button" class="btn" data-ajout-ok="versets">Ajouter</button></div>`)}
      ${section('racines', 'Racines', x.racines.length, `
        ${x.racines.map((r, i) => `<div class="ctx-item"><div><a class="ar" lang="ar" href="${lienRequete(`r:${r}`)}" target="_blank">${echapper(r)}</a> <span class="petit">${occ(r)}</span></div><div class="actions">${retirer('racines', i)}</div></div>`).join('') || vide('Aucune racine.')}
        <div class="ctx-ajout"><input type="text" data-ajout="racines" placeholder="صوم" dir="auto"><button type="button" class="btn" data-ajout-ok="racines">Ajouter</button></div>`)}
      ${section('lexique', 'Entrées du lexique', x.lexique.length, `
        ${x.lexique.map((k, i) => `<div class="ctx-item"><div><a href="#/lexique/${encodeURIComponent(k)}" target="_blank" dir="auto">${echapper(k)}</a> <span class="petit">définitions reprises dans le dossier</span></div><div class="actions">${retirer('lexique', i)}</div></div>`).join('') || vide('Aucune entrée.')}
        <div class="ctx-ajout"><input type="text" data-ajout="lexique" placeholder="clé du lexique" dir="auto"><button type="button" class="btn" data-ajout-ok="lexique">Ajouter</button></div>`)}
      ${section('sources', 'Sources et liens', x.sources.length, `
        ${x.sources.map((s, i) => `<div class="ctx-item"><div>${s.url ? `<a href="${echapper(s.url)}" target="_blank" rel="noopener noreferrer">${echapper(s.titre || s.url)}</a>` : echapper(s.titre)}
          ${s.note ? `<div class="petit">${echapper(s.note)}</div>` : ''}<label class="cite"><input type="checkbox" data-pub-s="${i}" ${s.publique ? 'checked' : ''}> publiée en bas de l'article</label></div>
          <div class="actions">${retirer('sources', i)}</div></div>`).join('') || vide('Aucune source.')}
        <div class="ctx-ajout ctx-source"><input type="text" data-s-titre placeholder="Titre"><input type="text" data-s-url placeholder="https://… (facultatif)"><input type="text" data-s-note placeholder="Note (facultative)"><button type="button" class="btn" data-ajout-ok="sources">Ajouter</button></div>`)}
      ${section('fichiers', 'Fichiers', x.fichiers.length, x.fichiers.map((f, i) => `<div class="ctx-item"><div>📄 <a href="#" data-ouvrir-f="${i}">${echapper(f.nom)}</a> <span class="petit">${Math.ceil((f.taille || 0) / 1024)} Ko · privé</span></div></div>`).join('') || vide('Les fichiers importés (Word…) sont rangés ici.'))}
      ${section('fils', 'Discussions du forum', fils.length, `
        ${fils.map((f) => `<div class="ctx-item"><div><a href="#/fil/${encodeURIComponent(f.id)}" target="_blank">${echapper(f.titre)}</a> ${f.auto ? '<span class="petit">lié à l\'article</span>' : ''}</div><div class="actions">${f.auto ? '' : retirer('fils', x.fils.findIndex((g) => g.id === f.id))}</div></div>`).join('') || vide('Aucun fil. Depuis un fil, copiez son adresse ici.')}
        <div class="ctx-ajout"><input type="text" data-ajout="fils" placeholder="adresse ou identifiant du fil"><button type="button" class="btn" data-ajout-ok="fils">Ajouter</button></div>`)}
      ${section('notes', 'Mes Notes liées', x.notes.length, `
        ${x.notes.map((n, i) => `<div class="ctx-item"><div><a href="#/note/${encodeURIComponent(n.id)}" target="_blank">${echapper(n.titre)}</a> <span class="petit">privée</span></div><div class="actions">${retirer('notes', i)}</div></div>`).join('') || vide('Aucune note.')}
        <p><button type="button" class="btn" data-choisir="notes">Choisir parmi mes notes…</button></p>`)}
      ${section('verification', `Vérification${nonVerifies ? ` <span class="etat brouillon">${nonVerifies} à vérifier</span>` : ''}`, x.verification.length, `
        ${x.verification.map((v, i) => `<div class="ctx-item"><div><span class="verif ${v.type}">${TYPES_VERIF[v.type] || v.type}</span> ${echapper(v.texte)}</div>
          <div class="actions"><label class="cite"><input type="checkbox" data-verifie="${i}" ${v.verifie ? 'checked' : ''}> vérifié</label>${retirer('verification', i)}</div></div>`).join('') || vide('Points à vérifier : faits, déductions, hypothèses.')}
        <div class="ctx-ajout"><select data-verif-type>${Object.entries(TYPES_VERIF).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select><input type="text" data-ajout="verification" placeholder="Point à vérifier"><button type="button" class="btn" data-ajout-ok="verification">Ajouter</button></div>`)}
      ${section('definitions', 'Définitions proposées', x.definitions.length, `
        ${x.definitions.map((d, i) => `<div class="ctx-item"><div><b dir="auto">${echapper(d.cle)}</b> <span class="etat ${d.statut === 'publiée' ? 'publie' : 'brouillon'}">${echapper(d.statut)}</span><div class="petit">${echapper(d.texte)}</div></div>
          <div class="actions">${d.statut !== 'publiée' ? `<button type="button" data-publier-def="${i}">publier au lexique…</button>` : ''}${retirer('definitions', i)}</div></div>`).join('') || vide('Une définition proposée reste « à valider » ; elle n\'est publiée au lexique que sur votre décision.')}
        <div class="ctx-ajout ctx-source"><input type="text" data-def-cle placeholder="Clé (racine, mot ou expression)" dir="auto"><input type="text" data-def-texte placeholder="Définition proposée"><button type="button" class="btn" data-ajout-ok="definitions">Ajouter</button></div>`)}
      ${section('recherches', 'Recherches Alfamous', x.recherches.length, `
        ${x.recherches.map((r, i) => `<div class="ctx-item"><div><a href="${lienRequete(r.q)}" target="_blank" dir="auto">${echapper(r.q)}</a></div><div class="actions">${retirer('recherches', i)}</div></div>`).join('') || vide('Requêtes à rejouer d\'un clic (ex. r:صوم, صوم 2:183).')}
        <div class="ctx-ajout"><input type="text" data-ajout="recherches" placeholder="r:صوم" dir="auto"><button type="button" class="btn" data-ajout-ok="recherches">Ajouter</button></div>`)}
      ${section('liens', 'Articles liés', x.liens.length, `
        ${x.liens.map((l, i) => `<div class="ctx-item"><div><a href="#/article/${encodeURIComponent(l.id)}" target="_blank">${echapper(l.titre)}</a> <span class="petit">affiché en bas de l'article</span></div><div class="actions">${retirer('liens', i)}</div></div>`).join('') || vide('Aucun article lié.')}
        <p><button type="button" class="btn" data-choisir="liens">Choisir un article publié…</button></p>`)}`;
  }

  async function ajouter(liste) {
    const x = c();
    const champ = panneau.querySelector(`[data-ajout="${liste}"]`);
    const val = champ?.value.trim() ?? '';
    const refuser = (m) => { champ.setCustomValidity(m); champ.reportValidity(); setTimeout(() => champ.setCustomValidity(''), 2000); };
    if (liste === 'versets') {
      const refs = await developperRefs(val);
      if (!refs.length) return refuser('Référence attendue : 2:183 ou 2:183-187');
      for (const r of refs) if (!x.versets.some((v) => v.ref === r)) x.versets.push({ ref: r, cite: true, note: '' });
    } else if (liste === 'racines' || liste === 'lexique') {
      const k = normaliserCle(val).slice(0, 200);
      if (!k) return;
      if (!x[liste].includes(k)) x[liste].push(k);
    } else if (liste === 'fils') {
      const id = (val.match(/fil\/([\w-]+)/) || [null, val])[1];
      if (!/^[\w-]{1,64}$/.test(id || '')) return refuser('Adresse du fil (…#/fil/identifiant) ou identifiant');
      try {
        const { db, F } = await firebase();
        const s = await avecDelai(F.getDoc(F.doc(db, `notes/${id}`)));
        if (!s.exists() || !s.data().publie) return refuser('Fil introuvable');
        if (!x.fils.some((f) => f.id === id)) x.fils.push({ id, titre: s.data().titre || 'Sans titre' });
      } catch { return refuser('Fil introuvable'); }
    } else if (liste === 'verification') {
      if (!val) return;
      x.verification.push({ type: panneau.querySelector('[data-verif-type]').value, texte: val.slice(0, 500), verifie: false });
    } else if (liste === 'definitions') {
      const cle = normaliserCle(panneau.querySelector('[data-def-cle]').value).slice(0, 200);
      const texte = panneau.querySelector('[data-def-texte]').value.trim().slice(0, 4000);
      if (!cle || !texte) return;
      x.definitions.push({ cle, texte, statut: 'à valider' });
    } else if (liste === 'recherches') {
      if (!val) return;
      if (!x.recherches.some((r) => r.q === val)) x.recherches.push({ q: val.slice(0, 200) });
    } else if (liste === 'sources') {
      const titre = panneau.querySelector('[data-s-titre]').value.trim(); const url = panneau.querySelector('[data-s-url]').value.trim();
      if (!titre && !url) return;
      if (url && !/^https?:\/\//.test(url)) { const u = panneau.querySelector('[data-s-url]'); u.setCustomValidity('Adresse https://…'); u.reportValidity(); setTimeout(() => u.setCustomValidity(''), 2000); return; }
      x.sources.push({ titre: titre.slice(0, 300), url: url.slice(0, 500), note: panneau.querySelector('[data-s-note]').value.trim().slice(0, 500), publique: true });
    }
    etatOuvert.add(liste);
    dessiner(); o.sauver();
  }

  async function choisir(liste) {
    ouvrirFenetre('<h2>Choisir</h2><p class="aide">Chargement…</p>');
    try {
      const { db, F } = await firebase();
      let items;
      if (liste === 'notes') {
        const q = F.query(F.collection(db, 'notes'), F.where('auteurUid', '==', session.utilisateur.uid), F.orderBy('modifieLe', 'desc'), F.limit(80));
        items = (await avecDelai(F.getDocsFromServer(q))).docs.map((d) => ({ id: d.id, titre: d.data().titre || texteBrut(d.data().texte).slice(0, 60) || 'Sans titre', info: d.data().publie ? 'fil publié' : 'privée' }));
      } else {
        const q = F.query(F.collection(db, 'articles'), F.where('statut', '==', 'publie'), F.orderBy('publieLe', 'desc'), F.limit(120));
        items = (await avecDelai(F.getDocsFromServer(q))).docs.filter((d) => d.id !== o.article()?.id)
          .map((d) => ({ id: d.id, titre: d.data().titre, info: `${FAMILLES[d.data().famille] || ''} · ${dateCourte(d.data().publieLe)}` }));
      }
      const deja = new Set(c()[liste].map((x) => x.id));
      ouvrirFenetre(`<h2>${liste === 'notes' ? 'Mes Notes' : 'Articles publiés'}</h2>
        <input type="search" data-filtre-choix placeholder="Filtrer…">
        <div class="liste-choix">${items.map((it) => `<label class="choix"><input type="checkbox" value="${it.id}" ${deja.has(it.id) ? 'checked disabled' : ''}><span>${echapper(it.titre)} <small class="aide">${echapper(it.info)}</small></span></label>`).join('') || '<p class="aide">Rien à choisir.</p>'}</div>
        <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button type="button" class="btn principal" data-choix-ok>Ajouter</button></div>`);
      const f = document.querySelector('#fenetre');
      f.querySelector('[data-filtre-choix]').addEventListener('input', (e) => {
        const t = e.target.value.toLocaleLowerCase('fr');
        f.querySelectorAll('.liste-choix .choix').forEach((l) => { l.hidden = t && !l.textContent.toLocaleLowerCase('fr').includes(t); });
      });
      f.querySelector('[data-choix-ok]').addEventListener('click', () => {
        for (const box of f.querySelectorAll('.liste-choix input:checked:not(:disabled)')) {
          const it = items.find((z) => z.id === box.value);
          c()[liste].push({ id: it.id, titre: it.titre });
        }
        fermerFenetre(); etatOuvert.add(liste); dessiner(); o.sauver();
      });
    } catch (e) { ouvrirFenetre(`<h2>Choisir</h2><p class="erreur">${echapper(messageErreur(e))}</p>`); }
  }

  function publierDefinition(i) {
    const d = c().definitions[i];
    ouvrirFenetre(`<h2>Publier au lexique</h2>
      <p>Cette définition sera publiée tout de suite dans le lexique, à l'entrée <b dir="auto">${echapper(d.cle)}</b>, signée « ${echapper(session.nom)} » (modifiable ensuite, avec historique) :</p>
      <blockquote dir="auto">${echapper(d.texte)}</blockquote>
      <p class="aide">Règle d'or : le sens se déduit uniquement des occurrences du Coran. Les définitions existantes de cette entrée restent affichées ; un écart se signale, il ne se tranche pas ici.</p>
      <p class="form-msg" role="alert"></p>
      <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Annuler</button><button type="button" class="btn principal" data-def-ok>Publier au lexique</button></div>`);
    const b = document.querySelector('[data-def-ok]');
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await publierCommentaire('lexique', d.cle, d.texte);
        d.statut = 'publiée';
        fermerFenetre(); dessiner(); o.sauver();
        o.msg.style.color = 'var(--discret)'; o.msg.textContent = `Définition publiée au lexique (${d.cle}). Enregistrez le brouillon pour garder son statut.`;
      } catch (e) { document.querySelector('#fenetre .form-msg').textContent = messageErreur(e); b.disabled = false; }
    });
  }

  panneau.addEventListener('toggle', (e) => {
    const s = e.target.closest?.('[data-sec]');
    if (s) { if (s.open) etatOuvert.add(s.dataset.sec); else etatOuvert.delete(s.dataset.sec); }
  }, true);
  panneau.addEventListener('change', (e) => {
    const t = e.target; const x = c();
    if (t.dataset.cite !== undefined) x.versets[t.dataset.cite].cite = t.checked;
    else if (t.dataset.noteV !== undefined) x.versets[t.dataset.noteV].note = t.value.slice(0, 500);
    else if (t.dataset.pubS !== undefined) x.sources[t.dataset.pubS].publique = t.checked;
    else if (t.dataset.verifie !== undefined) { x.verification[t.dataset.verifie].verifie = t.checked; dessiner(); }
    else return;
    o.sauver();
  });
  panneau.addEventListener('keydown', (e) => {
    const champ = e.target.closest('[data-ajout]');
    if (champ && e.key === 'Enter') { e.preventDefault(); ajouter(champ.dataset.ajout); }
  });
  panneau.addEventListener('click', async (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    const x = c();
    if (t.dataset.retirer) { x[t.dataset.retirer].splice(Number(t.dataset.i), 1); dessiner(); o.sauver(); }
    else if (t.dataset.ajoutOk) ajouter(t.dataset.ajoutOk);
    else if (t.dataset.choisir) choisir(t.dataset.choisir);
    else if (t.dataset.publierDef !== undefined) publierDefinition(Number(t.dataset.publierDef));
    else if (t.dataset.insererV !== undefined) { try { o.inserer(await o.blocVerset(x.versets[t.dataset.insererV].ref)); } catch (err) { o.msg.textContent = messageErreur(err); } }
    else if (t.dataset.ouvrirF !== undefined) {
      e.preventDefault();
      try { const { st, S } = await stockage(); open(await S.getDownloadURL(S.ref(st, x.fichiers[t.dataset.ouvrirF].chemin)), '_blank', 'noopener'); }
      catch (err) { o.msg.textContent = messageErreur(err); }
    }
  });

  dessiner();
  chargerFilsAuto();
  return {
    dessiner,
    ajouterVerset(ref, cite) {
      const x = c();
      const v = x.versets.find((z) => z.ref === ref);
      if (v) { if (cite) v.cite = true; } else x.versets.push({ ref, cite, note: '' });
      dessiner(); o.sauver();
    },
  };
}

// ---------- Dossier pour Claude ----------
const CONSIGNES = {
  commun: [
    'Ne cite aucun verset de mémoire : utilise uniquement les versets copiés ci-dessous (texte arabe et translittération d\'Alfamous1).',
    'Distingue toujours les faits, les déductions et les hypothèses ; signale ce qui est invérifiable.',
    'Garde ma voix : propose les modifications importantes en « avant / après » avec une raison.',
    'Mise en forme du blog : arabe seul sur sa ligne, translittération dans le texte ; réponds en HTML simple (h2, h3, p, ul, blockquote, table), sans <style> ni <script>.',
  ],
  coran: [
    'Règle d\'or : le sens d\'un mot du Coran se déduit uniquement de ses occurrences dans le Coran (occurrences, amis, amis contigus) ; aucun hadith, tradition orale ni exégèse classique comme source du sens.',
    'Les définitions doivent être conformes au lexique ci-dessous ; un conflit se signale sans le trancher ; toute nouvelle définition porte le statut « à valider ».',
  ],
  critiques: ['Hadiths et récits traditionnels peuvent être cités comme objets d\'examen, jamais comme source du sens d\'un mot. Rester pédagogique, sans caricaturer les personnes.'],
  identite: ['Vérifier dates, faits, chiffres et noms officiels ; ne pas appliquer la méthode coranique, sauf si le texte cite le Coran.'],
  reflexions: ['Sources citées ; données scientifiques avérées seulement.'],
};

export async function construireDossier(d, article) {
  const x = normaliserContexte(d.contexte);
  const L = [];
  const coran = d.famille === 'racines' || x.versets.length || x.racines.length || x.lexique.length;
  L.push(`# Dossier pour Claude — « ${d.titre || 'Sans titre'} »`);
  L.push(`Préparé le ${new Date().toLocaleString('fr-CA')} dans l'atelier Alfamous1 (onglet Articles)${article?.id ? `, article ${article.id}${article.slug ? ` (adresse ${article.slug})` : ''}` : ''}.`);
  L.push(`Famille : ${FAMILLES[d.famille] || d.famille} · Libellés : ${d.libelles.join(', ') || '—'} · Conversation à ouvrir : « [Blog] … » dans le projet Gestion des projets Amha.`);
  if (d.resume) L.push(`Résumé actuel : ${d.resume}`);
  L.push('', '## Consignes');
  for (const t of [...(coran ? CONSIGNES.coran : []), ...(CONSIGNES[d.famille] || []), ...CONSIGNES.commun]) L.push(`- ${t}`);

  L.push('', '## Brouillon actuel (HTML)', '```html', d.corps || '(vide)', '```');

  if (x.versets.length) {
    L.push('', '## Versets du contexte — copiés de donnees/texte (Alfamous1)');
    for (const v of x.versets) {
      try {
        const t = await verset(v.ref);
        L.push('', `### ${v.ref}${v.cite ? ' (cité dans l\'article)' : ''}${v.note ? ` — note : ${v.note}` : ''}`, t.ar, t.tr);
      } catch { L.push('', `### ${v.ref} — introuvable dans les données`); }
    }
  }
  if (x.racines.length) {
    const R = await D.racines();
    L.push('', '## Racines — donnees/racines.json (références sourate:verset:position du mot)');
    for (const r of x.racines) {
      const occ = R[r];
      if (!occ) { L.push('', `### ${r} — pas une racine du Coran dans les données`); continue; }
      const vs = [...new Set(occ.map((z) => z.split(':').slice(0, 2).join(':')))];
      L.push('', `### ${r} — ${occ.length} occurrences dans ${vs.length} versets`, occ.join(' '));
    }
  }
  const cles = [...new Set([...x.lexique, ...x.racines, ...x.definitions.map((z) => z.cle)])];
  if (cles.length) {
    L.push('', '## Lexique — définitions publiées (Firestore, avec signature et date)');
    const { db, F } = await firebase();
    for (const k of cles) {
      L.push('', `### ${k}`);
      try {
        const q = F.query(F.collection(db, 'commentaires'), F.where('type', '==', 'lexique'), F.where('cle', '==', k), F.orderBy('creeLe', 'desc'));
        const defs = (await avecDelai(F.getDocs(q))).docs.map((z) => z.data()).filter((z) => !z.masque && z.texte);
        if (!defs.length) L.push('(aucune définition publiée)');
        for (const z of defs) L.push(`- ${z.auteurNom}, ${dateCourte(z.creeLe)} : ${z.texte.replace(/\s+/g, ' ')}`);
      } catch (e) { L.push(`(lexique indisponible : ${messageErreur(e)})`); }
    }
  }
  if (x.definitions.length) {
    L.push('', '## Définitions proposées dans cet article');
    for (const z of x.definitions) L.push(`- ${z.cle} [${z.statut}] : ${z.texte}`);
  }
  if (x.verification.length) {
    L.push('', '## Vérification');
    for (const v of x.verification) L.push(`- [${TYPES_VERIF[v.type] || v.type}, ${v.verifie ? 'vérifié' : 'à vérifier'}] ${v.texte}`);
  }
  if (x.sources.length) {
    L.push('', '## Sources');
    for (const s of x.sources) L.push(`- ${s.titre || s.url}${s.url ? ` <${s.url}>` : ''}${s.note ? ` — ${s.note}` : ''}${s.publique ? '' : ' (non publiée)'}`);
  }
  if (x.recherches.length) { L.push('', '## Recherches Alfamous (à rejouer dans l\'atelier)'); for (const r of x.recherches) L.push(`- ${r.q}`); }
  if (x.notes.length || x.fils.length || x.liens.length) {
    const { db, F } = await firebase();
    if (x.notes.length) {
      L.push('', '## Mes Notes liées (privées)');
      for (const n of x.notes) {
        try { const s = await avecDelai(F.getDoc(F.doc(db, `notes/${n.id}`))); L.push('', `### ${s.data()?.titre || n.titre}`, s.data()?.texte || '(introuvable)'); }
        catch { L.push('', `### ${n.titre}`, '(introuvable)'); }
      }
    }
    if (x.fils.length) { L.push('', '## Discussions du forum liées'); for (const f of x.fils) L.push(`- ${f.titre} (fil ${f.id})`); }
    if (x.liens.length) {
      L.push('', '## Articles liés (cohérence avec ce qui est déjà publié)');
      for (const l of x.liens) {
        try { const s = await avecDelai(F.getDoc(F.doc(db, `articles/${l.id}`))); const a = s.data(); L.push(`- ${a.titre}${a.resume ? ` — ${a.resume}` : ''} (adresse ${a.slug || l.id})`); }
        catch { L.push(`- ${l.titre}`); }
      }
    }
  }
  L.push('', '## Demande', 'Relis le brouillon et propose une version révisée au format HTML du blog, en respectant les consignes ci-dessus ; liste à part les points à vérifier et les écarts avec le lexique.');
  return L.join('\n');
}

export async function fenetreDossier(d, article) {
  ouvrirFenetre('<h2>Dossier pour Claude</h2><p class="aide">Préparation (versets copiés des données, définitions du lexique)…</p>');
  let texte;
  try { texte = await construireDossier(d, article); } catch (e) { ouvrirFenetre(`<h2>Dossier pour Claude</h2><p class="erreur">${echapper(messageErreur(e))}</p>`); return; }
  ouvrirFenetre(`<h2>Dossier pour Claude</h2>
    <p class="aide">Texte à coller dans une conversation « [Blog] … ». Versets et chiffres copiés des fichiers de l'application au moment du clic ; rien n'est tapé de mémoire. Modifiable ici avant de copier. Recollez ensuite le HTML obtenu dans le mode HTML de l'éditeur.</p>
    <textarea class="dossier" spellcheck="false" aria-label="Dossier pour Claude">${echapper(texte)}</textarea>
    <p class="form-msg" role="status"></p>
    <div class="fenetre-bas"><button type="button" class="btn" data-fermer>Fermer</button><button type="button" class="btn" data-dossier="telecharger">Télécharger (.md)</button><button type="button" class="btn principal" data-dossier="copier">Copier</button></div>`);
  const f = document.querySelector('#fenetre');
  f.classList.add('large');
  const zone = f.querySelector('.dossier');
  f.querySelector('[data-dossier="copier"]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(zone.value); f.querySelector('.form-msg').textContent = 'Copié.'; }
    catch { zone.select(); f.querySelector('.form-msg').textContent = 'Copie refusée par le navigateur : le texte est sélectionné, faites Ctrl+C.'; }
  });
  f.querySelector('[data-dossier="telecharger"]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([zone.value], { type: 'text/markdown;charset=utf-8' }));
    a.download = `dossier-${article?.slug || article?.id || 'article'}.md`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
