// Tests de la gestion des niveaux (fonctions pures des Cloud Functions) : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifierAdmin, validerChangement, niveauDe, revendications, resumeMembre } from '../functions/membres-outils.js';

const jeton = (token) => ({ uid: 'moi', token });

test('seul un admin au courriel vérifié est servi', () => {
  assert.throws(() => verifierAdmin(null), { code: 'unauthenticated' });
  assert.throws(() => verifierAdmin(jeton({ email_verified: true })), { code: 'permission-denied' });
  assert.throws(() => verifierAdmin(jeton({ email_verified: true, niveau: 2 })), { code: 'permission-denied' });
  assert.throws(() => verifierAdmin(jeton({ email_verified: false, niveau: 3 })), { code: 'permission-denied' });
  assert.equal(verifierAdmin(jeton({ email_verified: true, niveau: 3 })).uid, 'moi');
});

test('demande de changement : niveau 0 à 3, jamais son propre niveau', () => {
  assert.deepEqual(validerChangement({ uid: 'x', niveau: 2 }, 'moi'), { uid: 'x', niveau: 2 });
  assert.throws(() => validerChangement({ uid: 'moi', niveau: 1 }, 'moi'), { code: 'failed-precondition' });
  assert.throws(() => validerChangement({ uid: 'x', niveau: 4 }, 'moi'), { code: 'invalid-argument' });
  assert.throws(() => validerChangement({ uid: 'x', niveau: '3' }, 'moi'), { code: 'invalid-argument' });
  assert.throws(() => validerChangement({ niveau: 1 }, 'moi'), { code: 'invalid-argument' });
});

test('niveau effectif, comme dans les règles Firestore', () => {
  assert.equal(niveauDe({ emailVerified: false, customClaims: { niveau: 3 } }), 0);
  assert.equal(niveauDe({ emailVerified: true }), 1);
  assert.equal(niveauDe({ emailVerified: true, customClaims: { niveau: 0 } }), 0);
  assert.equal(niveauDe({ emailVerified: true, customClaims: { niveau: 2 } }), 2);
});

test('revendications : niveau 1 = aucune revendication, les autres sont gardées', () => {
  assert.deepEqual(revendications({ niveau: 3, autre: 'a' }, 1), { autre: 'a' });
  assert.deepEqual(revendications({ autre: 'a' }, 2), { autre: 'a', niveau: 2 });
  assert.deepEqual(revendications(null, 0), { niveau: 0 });
});

test('résumé d\'un membre : bloqué, dates, compteurs', () => {
  const r = resumeMembre({
    uid: 'u1', displayName: 'Membre', email: 'm@x', emailVerified: true, customClaims: { niveau: 0 },
    metadata: { creationTime: 'Mon, 23 Nov 2026 15:00:00 GMT', lastSignInTime: 'Mon, 23 Nov 2026 16:00:00 GMT' },
    passwordHash: 'secret',
  }, { commentaires: 4, definitions: 1, fils: 2, reponses: 3 });
  assert.equal(r.bloque, true);
  assert.equal(r.niveau, 0);
  assert.equal(r.creeLe, Date.parse('Mon, 23 Nov 2026 15:00:00 GMT'));
  assert.equal(r.vuLe, Date.parse('Mon, 23 Nov 2026 16:00:00 GMT'));
  assert.equal(r.reponses, 3);
  assert.equal('passwordHash' in r, false);
  assert.equal(resumeMembre({ uid: 'u2', emailVerified: false }).bloque, false);
});
