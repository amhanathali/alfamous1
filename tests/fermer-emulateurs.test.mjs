// Tests de « npm run fermer:emulateurs » : seuls les processus qui écoutent sur les ports d'Alfamous1 sont visés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processusEnEcoute } from '../scripts/fermer-emulateurs.mjs';

const netstat = `
Connexions actives

  Proto  Adresse locale         Adresse distante       État
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1200
  TCP    0.0.0.0:5050           0.0.0.0:0              LISTENING       14796
  TCP    127.0.0.1:4000         0.0.0.0:0              LISTENING       6628
  TCP    127.0.0.1:9099         0.0.0.0:0              LISTENING       6628
  TCP    127.0.0.1:8085         0.0.0.0:0              LISTENING       12580
  TCP    [::1]:4400             [::]:0                 LISTENING       6628
  TCP    127.0.0.1:8085         127.0.0.1:52000        ESTABLISHED     777
  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING       4
  TCP    127.0.0.1:9199         0.0.0.0:0              LISTENING       4
  UDP    0.0.0.0:5050           *:*                                    888
`;

test('ne vise que les processus en écoute sur les ports d\'Alfamous1', () => {
  const r = processusEnEcoute(netstat);
  assert.deepEqual([...r.keys()].sort((a, b) => a - b), [6628, 12580, 14796]);
  assert.deepEqual([...r.get(6628)].sort((a, b) => a - b), [4000, 4400, 9099]);
});

test('jamais le système (PID 0 ou 4), ni une connexion établie, ni un autre port', () => {
  const r = processusEnEcoute(netstat);
  assert.equal(r.has(4), false);
  assert.equal(r.has(777), false);
  assert.equal(r.has(1200), false);
  assert.equal(r.has(888), false);
});
