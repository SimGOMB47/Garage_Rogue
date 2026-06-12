// ── Écrans de connexion / création de compte ────────────────────

import { supabase } from './db.js';
import { $, esc, toast, safe } from './ui.js';

function frError(msg) {
  if (/invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect.';
  if (/email not confirmed/i.test(msg)) return 'Adresse email non confirmée — vérifie ta boîte mail.';
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet email.';
  if (/at least 6 characters/i.test(msg)) return 'Le mot de passe doit faire au moins 6 caractères.';
  return msg;
}

export function renderLogin(root) {
  let mode = 'login'; // 'login' ou 'signup'

  const draw = () => {
    root.innerHTML = `
      <div class="center-screen auth">
        <div class="logo">🔧</div>
        <h1>Garage <span class="accent">de Rogué</span></h1>
        <form id="auth-form" class="card">
          <label>Email
            <input type="email" name="email" required autocomplete="email" inputmode="email">
          </label>
          <label>Mot de passe
            <input type="password" name="password" required minlength="6"
              autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
          </label>
          <button class="btn btn-primary">${mode === 'login' ? 'Se connecter' : 'Créer le compte'}</button>
        </form>
        <button class="link" id="toggle">
          ${mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
      </div>`;

    $('#toggle').onclick = () => { mode = mode === 'login' ? 'signup' : 'login'; draw(); };

    $('#auth-form').onsubmit = safe(async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = fd.get('email');
      const password = fd.get('password');

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(frError(error.message));
        // La suite (affichage du garage) est gérée par app.js
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(frError(error.message));
        if (data.user && !data.session) {
          toast('Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.');
        } else {
          toast('Compte créé !');
        }
      }
    });
  };

  draw();
}

// Écran affiché à un compte connecté mais pas encore membre du garage
export function renderNotMember(root, email) {
  root.innerHTML = `
    <div class="center-screen">
      <h1>⛔ Accès non autorisé</h1>
      <p>Le compte <strong>${esc(email)}</strong> n'est pas encore membre du garage.</p>
      <p class="muted">Pour l'autoriser : exécute le script <code>supabase/02_membres.sql</code><br>
      dans l'éditeur SQL de Supabase, puis réessaie.</p>
      <div class="row">
        <button class="btn" id="signout">Changer de compte</button>
        <button class="btn btn-primary" id="retry">Réessayer</button>
      </div>
    </div>`;
  $('#signout').onclick = safe(() => supabase.auth.signOut());
  $('#retry').onclick = () => location.reload();
}
