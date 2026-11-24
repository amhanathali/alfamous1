// Comptes : connexion, inscription (courriel vérifié = niveau 1), déconnexion.
// Le niveau vient du jeton (docs/DROITS.md) : jamais modifiable par le client.
import { firebase, LOCAL } from './firebase.js';
import { echapper, messageErreur } from './commentaires-format.js';

const $ = (s) => document.querySelector(s);
const abonnes = new Set();
export const session = { utilisateur: null, niveau: 0, nom: '', verifie: false, pret: false };
const NOMS_NIVEAUX = ['visiteur', 'membre', 'modérateur', 'admin'];

export function surChangement(f) { abonnes.add(f); }
const prevenir = () => abonnes.forEach((f) => f(session));

async function lireJeton(u, forcer = false) {
  if (!u) return Object.assign(session, { utilisateur: null, niveau: 0, nom: '', verifie: false });
  const r = await u.getIdTokenResult(forcer);
  const verifie = r.claims.email_verified === true;
  return Object.assign(session, {
    utilisateur: u, verifie, nom: r.claims.name || u.displayName || '',
    niveau: verifie ? (Number.isInteger(r.claims.niveau) ? r.claims.niveau : 1) : 0,
  });
}

// ---------- En-tête ----------
function dessinerEntete() {
  const zone = $('#compte');
  if (!session.pret) { zone.innerHTML = ''; return; }
  if (!session.utilisateur) {
    zone.innerHTML = '<button type="button" class="lien-bouton" data-compte="connexion">Se connecter</button>';
    return;
  }
  const n = session.niveau;
  zone.innerHTML = `<span class="compte-nom">${echapper(session.nom || session.utilisateur.email)}</span>
    ${n >= 2 ? `<span class="badge-niveau">${NOMS_NIVEAUX[n] || `niveau ${n}`}</span>` : ''}
    ${!session.verifie ? '<button type="button" class="lien-bouton alerte" data-compte="verifier">courriel à vérifier</button>' : ''}
    <button type="button" class="lien-bouton" data-compte="deconnexion">Se déconnecter</button>`;
}

// ---------- Fenêtre ----------
const fenetre = () => $('#fenetre');
export function ouvrirFenetre(html) {
  const f = fenetre();
  f.classList.remove('large'); // fenêtres larges des articles (aperçu, historique)
  f.innerHTML = `<button type="button" class="fermer" data-fermer aria-label="Fermer">×</button>${html}`;
  if (!f.open) f.showModal();
  f.querySelector('input, textarea')?.focus();
}
export const fermerFenetre = () => fenetre().close();

const formulaireConnexion = (mode = 'connexion', msg = '') => {
  const inscription = mode === 'inscription';
  ouvrirFenetre(`<h2>${inscription ? 'Créer un compte' : 'Se connecter'}</h2>
    <form class="form-compte" data-mode="${mode}">
      ${inscription ? '<label>Nom affiché (signature de vos commentaires)<input name="nom" required maxlength="60" autocomplete="name"></label>' : ''}
      <label>Courriel<input name="email" type="email" required autocomplete="email"></label>
      <label>Mot de passe<input name="mdp" type="password" required minlength="6" autocomplete="${inscription ? 'new-password' : 'current-password'}"></label>
      <p class="form-msg" role="alert">${msg}</p>
      <div class="fenetre-bas">
        ${inscription
          ? '<button type="button" class="lien-bouton" data-compte="connexion">J\'ai déjà un compte</button>'
          : '<button type="button" class="lien-bouton" data-compte="oubli">Mot de passe oublié</button><button type="button" class="lien-bouton" data-compte="inscription">Créer un compte</button>'}
        <button class="btn principal">${inscription ? 'Créer le compte' : 'Se connecter'}</button>
      </div>
      ${LOCAL ? '<p class="aide">Essai local : comptes d\'essai <code>membre@essai.local</code>, <code>modo@essai.local</code>, <code>admin@essai.local</code> (mot de passe <code>essai123</code>), créés par <code>npm run emulateurs:peupler</code>.</p>' : ''}
    </form>`);
};

function fenetreVerification(msg = '') {
  ouvrirFenetre(`<h2>Vérifiez votre courriel</h2>
    <p>Un lien de vérification a été envoyé à <b>${echapper(session.utilisateur?.email)}</b>. Après avoir cliqué dessus, vous pourrez écrire.</p>
    ${LOCAL ? '<p class="aide">Essai local : le lien s\'affiche dans la fenêtre des émulateurs ; la console (http://localhost:4000, onglet Authentication) permet aussi de cocher « Email verified ».</p>' : ''}
    <p class="form-msg" role="alert">${msg}</p>
    <div class="fenetre-bas"><button type="button" class="btn" data-compte="renvoyer">Renvoyer le lien</button>
      <button type="button" class="btn principal" data-compte="verifie">J'ai vérifié</button></div>`);
}

async function soumettre(form) {
  const { auth, A } = await firebase();
  const d = Object.fromEntries(new FormData(form));
  const msg = form.querySelector('.form-msg');
  const bouton = form.querySelector('.principal');
  bouton.disabled = true; msg.textContent = '';
  try {
    if (form.dataset.mode === 'inscription') {
      const nom = d.nom.trim();
      if (!nom) throw new Error('Indiquez un nom.');
      const { user } = await A.createUserWithEmailAndPassword(auth, d.email.trim(), d.mdp);
      await A.updateProfile(user, { displayName: nom });
      await A.sendEmailVerification(user);
      await lireJeton(user, true); dessinerEntete(); prevenir();
      fenetreVerification();
    } else {
      await A.signInWithEmailAndPassword(auth, d.email.trim(), d.mdp);
      fermerFenetre();
    }
  } catch (e) { msg.textContent = messageErreur(e); } finally { bouton.disabled = false; }
}

async function action(nom) {
  const { auth, A } = await firebase();
  if (nom === 'connexion' || nom === 'inscription') return formulaireConnexion(nom);
  if (nom === 'deconnexion') return A.signOut(auth);
  if (nom === 'verifier') return fenetreVerification();
  if (nom === 'renvoyer') {
    try { await A.sendEmailVerification(auth.currentUser); fenetreVerification('Lien renvoyé.'); } catch (e) { fenetreVerification(messageErreur(e)); }
    return;
  }
  if (nom === 'verifie') {
    await auth.currentUser.reload();
    await lireJeton(auth.currentUser, true); dessinerEntete(); prevenir();
    if (session.verifie) fermerFenetre(); else fenetreVerification('Le courriel n\'est pas encore vérifié.');
    return;
  }
  if (nom === 'oubli') {
    const email = document.querySelector('.form-compte [name=email]')?.value.trim();
    if (!email) return formulaireConnexion('connexion', 'Indiquez votre courriel, puis cliquez « Mot de passe oublié ».');
    try { await A.sendPasswordResetEmail(auth, email); formulaireConnexion('connexion', 'Si ce compte existe, un lien de réinitialisation a été envoyé.'); } catch (e) { formulaireConnexion('connexion', messageErreur(e)); }
  }
}

// Demander la connexion (depuis les commentaires).
export const demanderConnexion = (mode = 'connexion') => action(mode);

export async function initCompte() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-compte]');
    if (b) { e.preventDefault(); action(b.dataset.compte).catch((err) => console.error(err)); }
    if (e.target.closest('[data-fermer]')) fermerFenetre();
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.form-compte');
    if (form) { e.preventDefault(); soumettre(form); }
  });
  try {
    const { auth, A } = await firebase();
    // Au premier chargement, jeton rafraîchi : un niveau changé par l'admin est pris en compte en rechargeant la page.
    let premier = true;
    A.onIdTokenChanged(auth, async (u) => {
      await lireJeton(u, premier && !!u).catch(() => lireJeton(null));
      if (u) premier = false;
      session.pret = true; dessinerEntete(); prevenir();
    });
  } catch (e) {
    console.warn('Firebase indisponible :', e);
  }
}
