#!/usr/bin/env node
// Attend que les émulateurs Auth (9099) et Firestore (8085) répondent (2 minutes au plus).
// Utilisé par ESSAI_LOCAL.bat avant de créer les données d'essai.
const PORTS = { Auth: 9099, Firestore: 8085 };
const LIMITE = Date.now() + 120_000;
const repond = async (port) => { try { await fetch(`http://127.0.0.1:${port}/`); return true; } catch { return false; } };

for (const [nom, port] of Object.entries(PORTS)) {
  while (!(await repond(port))) {
    if (Date.now() > LIMITE) {
      console.error(`L'émulateur ${nom} (port ${port}) ne répond pas : voir la fenêtre « Alfamous1 - emulateurs ».`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`${nom} prêt.`);
}
