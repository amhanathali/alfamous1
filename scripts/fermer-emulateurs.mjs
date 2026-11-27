// Ferme les émulateurs Firebase et le serveur local d'Alfamous1 (npm run fermer:emulateurs).
// Seuls les processus qui ÉCOUTENT sur les ports d'Alfamous1 sont fermés (avec leurs processus enfants) :
//   émulateurs : 4000 (interface), 4400, 4500, 5001 (Functions), 5005 (Hosting), 8085 (Firestore),
//                9099 (Auth), 9150, 9199 (Storage) ; serveur local : 5050.
// Sert avant les tests des règles ou un déploiement, quand un essai local occupe encore les ports.
// Les données saisies dans les émulateurs ne sont pas réexportées (fermeture forcée, comme deployerAlfamous1.bat).
// Option --voir : affiche ce qui serait fermé, sans rien fermer.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PORTS = [4000, 4400, 4500, 5001, 5005, 8085, 9099, 9150, 9199, 5050];

// Lignes de « netstat -ano » → { port: [pid…] } pour les ports d'Alfamous1 en écoute.
export function processusEnEcoute(sortieNetstat, ports = PORTS) {
  const trouves = new Map();
  for (const ligne of sortieNetstat.split(/\r?\n/)) {
    const m = ligne.trim().match(/^TCP\s+\S*:(\d+)\s+\S+\s+(?:LISTENING|ÉCOUTE|ECOUTE)\s+(\d+)$/i);
    if (!m) continue;
    const port = Number(m[1]); const pid = Number(m[2]);
    if (!ports.includes(port) || pid <= 4 || pid === process.pid) continue; // 0 et 4 : système
    if (!trouves.has(pid)) trouves.set(pid, new Set());
    trouves.get(pid).add(port);
  }
  return trouves;
}

function principal() {
  if (process.platform !== 'win32') { console.log('Prévu pour Windows (netstat, taskkill).'); return; }
  const voir = process.argv.includes('--voir');
  const trouves = processusEnEcoute(execFileSync('netstat', ['-ano'], { encoding: 'utf8' }));
  if (!trouves.size) { console.log('Rien à fermer : ports des émulateurs et du serveur local libres.'); return; }
  for (const [pid, ports] of trouves) {
    const libelle = `processus ${pid} (ports ${[...ports].join(', ')})`;
    if (voir) { console.log(`serait fermé : ${libelle}`); continue; }
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      console.log(`fermé : ${libelle}`);
    } catch {
      console.log(`déjà fermé ou impossible à fermer : ${libelle}`);
    }
  }
}

// Lancé directement (pas importé par un test).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) principal();
