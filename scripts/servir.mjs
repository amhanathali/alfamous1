#!/usr/bin/env node
// Petit serveur local pour essayer dist/ sans Firebase : http://localhost:5005
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const port = Number(process.env.PORT || 5005);

createServer(async (req, res) => {
  const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const fichier = join(DIST, chemin.endsWith('/') ? `${chemin}index.html` : chemin);
  if (!fichier.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    const contenu = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : contenu);
  } catch { res.writeHead(404).end('introuvable'); }
}).listen(port, () => console.log(`Alfamous1 : http://localhost:${port}`));
