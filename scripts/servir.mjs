#!/usr/bin/env node
// Serveur local pour essayer l'application sans déployer.
//   npm run servir           → mode développement : sert src/ et donnees/ directement.
//                              Une modification du code se voit en rechargeant la page (F5), sans reconstruire.
//   npm run servir -- --dist → sert dist/ (exactement ce qui sera déployé ; lancer « npm run construire » avant).
// Adresse : http://localhost:5050 (autre port : set PORT=5051 avant la commande).
// Les appels aux émulateurs Firebase (Auth 9099, Firestore 8085) sont relayés par ce serveur :
// la page n'a qu'une adresse à joindre (certains navigateurs, dont celui intégré à Claude,
// refusent qu'une page joigne un autre port de la machine).
import { createServer, request } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireModuleSdk } from './lib/sdk-firebase.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const modeDist = process.argv.includes('--dist');
const port = Number(process.env.PORT || 5050);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

// Fichiers publics en mode développement (jamais import/, scripts/, src/config/).
function resoudre(chemin) {
  if (modeDist) return join(RACINE, 'dist', chemin);
  if (chemin.startsWith('/donnees/')) {
    const ok = /^\/donnees\/(texte|mots)\/\d{3}\.json$|^\/donnees\/(racines|sourates)\.json$|^\/donnees\/traductions\/[\w.-]+\.(txt|json)$/.test(chemin);
    return ok ? join(RACINE, chemin) : null;
  }
  if (chemin.startsWith('/config/')) return null;
  return join(RACINE, 'src', chemin);
}

// ---------- Relais vers les émulateurs ----------
const EMULATEURS = [
  { prefixes: ['/google.firestore.v1.Firestore/', '/v1/projects/', '/v1beta1/projects/'], port: 8085 },
  { prefixes: ['/identitytoolkit.googleapis.com/', '/securetoken.googleapis.com/', '/emulator/'], port: 9099 },
];
function relayer(req, res) {
  const cible = EMULATEURS.find((e) => e.prefixes.some((p) => req.url.startsWith(p)));
  if (!cible) return false;
  const amont = request({
    host: '127.0.0.1', port: cible.port, method: req.method, path: req.url,
    headers: { ...req.headers, host: `127.0.0.1:${cible.port}` },
  }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  amont.on('error', () => {
    // Réponse au format des API Google : le SDK la lit comme « unavailable » au lieu de planter.
    if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'Émulateur injoignable : lancer LANCER_EMULATEURS.bat' } }));
  });
  req.pipe(amont);
  return true;
}

createServer(async (req, res) => {
  if (relayer(req, res)) return;
  const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).split(sep).join('/');
  try {
    // En développement, la liste des commentaires traditionnels présents est calculée à la volée.
    if (!modeDist && chemin === '/donnees/traductions/disponibles.json') {
      const ids = (await readdir(join(RACINE, 'donnees/traductions'))).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4));
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(ids));
      return;
    }
    // SDK Firebase (mode développement) : lu dans node_modules, adresse gstatic remplacée.
    const sdk = !modeDist && chemin.match(/^\/vendor\/firebase\/([\w-]+\.js)$/);
    if (sdk) {
      const code = lireModuleSdk(RACINE, sdk[1]);
      if (!code) { res.writeHead(404).end('introuvable'); return; }
      res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
      res.end(code);
      return;
    }
    const fichier = resoudre(chemin.endsWith('/') ? `${chemin}index.html` : chemin);
    if (!fichier || fichier.includes('..')) { res.writeHead(404).end('introuvable'); return; }
    const contenu = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : contenu);
  } catch { res.writeHead(404).end('introuvable'); }
}).listen(port, () => {
  console.log(`Alfamous1 (${modeDist ? 'dist/' : 'développement'}) : http://localhost:${port}`);
  console.log('Arrêter : Ctrl+C');
});
