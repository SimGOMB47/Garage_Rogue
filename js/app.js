// ── Point d'entrée : session, navigation, synchro temps réel ────

import { SUPABASE_KEY } from './config.js';
import { supabase, isMember, onAnyChange, generateDueActivities } from './db.js';
import { renderLogin, renderNotMember } from './auth.js';
import { esc, isModalOpen, toast } from './ui.js';
import { setupAutoUpdate } from './update.js';
import { renderHome } from './views/home.js';
import { renderVehicles } from './views/vehicles.js';
import { renderVehicle } from './views/vehicle.js';
import { renderWorkOrder } from './views/workorder.js';
import { renderActivityWizard } from './views/activity.js';
import { renderPlanning } from './views/planning.js';
import { renderDashboard } from './views/dashboard.js';

const app = document.getElementById('app');

let session = null;     // session Supabase (null = pas connecté)
let member = false;     // le compte est-il dans garage_members ?
let currentUid;         // pour ignorer les événements de session redondants

// Affiche l'écran correspondant à l'adresse (#/..., navigation "hash")
async function route() {
  if (SUPABASE_KEY.includes('COLLE_TA_CLE')) {
    app.innerHTML = `
      <div class="center-screen">
        <h1>⚙️ Configuration requise</h1>
        <p>Ouvre <code>js/config.js</code> et colle ta clé publique Supabase<br>
        (<code>sb_publishable_…</code>), puis recharge la page.</p>
      </div>`;
    return;
  }
  if (!session) return renderLogin(app);
  if (!member) return renderNotMember(app, session.user.email);

  await autoGenerate(); // échéances → activités automatiques

  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (parts[0] === 'vehicle' && parts[1]) await renderVehicle(app, parts[1], parts[2]);
    else if (parts[0] === 'ot' && parts[1]) await renderWorkOrder(app, parts[1], parts[2]);
    else if (parts[0] === 'vehicles') await renderVehicles(app);
    else if (parts[0] === 'new') await renderActivityWizard(app);
    else if (parts[0] === 'planning') await renderPlanning(app);
    else if (parts[0] === 'dashboard') await renderDashboard(app);
    else await renderHome(app);
  } catch (e) {
    console.error(e);
    app.innerHTML = `
      <div class="center-screen">
        <h1>Oups…</h1>
        <p class="muted">${esc(e.message)}</p>
        <a class="btn btn-primary" href="#/">Retour à l'accueil</a>
      </div>`;
  }
}

window.addEventListener('hashchange', route);

// ── Échéances → activités automatiques ──────────────────────────
// Vérifie (au plus une fois par heure) si des échéances datées
// arrivent à moins d'un mois : l'activité correspondante est alors
// créée toute seule et apparaît dans le Planning.
let lastAutoGen = 0;
async function autoGenerate() {
  if (Date.now() - lastAutoGen < 3600_000) return;
  lastAutoGen = Date.now();
  try {
    const n = await generateDueActivities();
    if (n) toast(`📅 ${n} activité${n > 1 ? 's' : ''} planifiée${n > 1 ? 's' : ''} automatiquement (échéance dans moins d'un mois)`);
  } catch (e) {
    console.error(e); // ne bloque jamais l'affichage de l'app
  }
}

// ── Synchro temps réel ──────────────────────────────────────────
// Quand la base change (ex : ton père ajoute un OT), on redessine
// l'écran courant. Si une modale est ouverte (saisie en cours), on
// attend qu'elle se ferme pour ne pas perdre ce qui est tapé.
let refreshTimer;
let pendingRefresh = false;

function scheduleRefresh() {
  if (isModalOpen()) { pendingRefresh = true; return; }
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(route, 400);
}

window.addEventListener('modal-closed', () => {
  if (pendingRefresh) { pendingRefresh = false; scheduleRefresh(); }
});

// ── Session ─────────────────────────────────────────────────────
async function applySession(s) {
  const uid = s?.user?.id ?? null;
  if (uid === currentUid) return; // rien de nouveau (ex : simple refresh de jeton)
  currentUid = uid;
  session = s;
  member = s ? await isMember() : false;
  route();
}

(async function init() {
  setupAutoUpdate(); // garde l'app à jour sur iPhone (PWA)

  const { data: { session: s } } = await supabase.auth.getSession();
  await applySession(s);

  // setTimeout : recommandé par Supabase pour éviter un blocage
  // quand on fait des requêtes depuis ce rappel.
  supabase.auth.onAuthStateChange((_event, s) => {
    setTimeout(() => applySession(s), 0);
  });

  onAnyChange(scheduleRefresh);
})();
