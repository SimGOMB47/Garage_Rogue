// ── Écran d'accueil : menu de navigation central (hub) ──────────

import * as db from '../db.js';
import { supabase } from '../db.js';
import { $, esc, todayISO, dueStatus, safe } from '../ui.js';
import { bottomNav } from '../components/nav.js';

export async function renderHome(root) {
  const [vehicles, workOrders, deadlines] = await Promise.all([
    db.listVehicles(),
    db.listAllWorkOrders(),
    db.listAllDeadlines(),
  ]);

  const today = todayISO();
  const kmOf = id => vehicles.find(v => v.id === id)?.km ?? 0;

  // Résumé rapide : activités planifiées à venir + alertes
  const upcoming  = workOrders.filter(w => w.status !== 'cloture' && w.date >= today).length;
  const lateActs  = workOrders.filter(w => w.status !== 'cloture' && w.date <  today).length;
  const lateDues  = deadlines.filter(d => dueStatus(d, kmOf(d.vehicle_id)) === 'late').length;
  const alerts    = lateActs + lateDues;

  const cards = [
    ['#/vehicles',  '🚗', 'Mes véhicules',     `${vehicles.length} véhicule${vehicles.length > 1 ? 's' : ''}`],
    ['#/new',       '➕', 'Créer une activité', 'Assistant pas à pas'],
    ['#/planning',  '📅', 'Planning',           `${upcoming} à venir`],
    ['#/dashboard', '📊', 'Tableau de bord',    'Vue d’ensemble'],
  ];

  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">🔧 Garage <span class="accent">de Rogué</span></h1>
      <button class="icon-btn" id="logout" title="Se déconnecter">⏻</button>
    </header>
    <main class="page with-nav">
      <section class="summary">
        <a class="summary-tile" href="#/planning">
          <span class="summary-num">${upcoming}</span>
          <span class="summary-lbl">activité${upcoming > 1 ? 's' : ''} à venir</span>
        </a>
        <a class="summary-tile ${alerts ? 'alert' : ''}" href="#/planning">
          <span class="summary-num">${alerts}</span>
          <span class="summary-lbl">alerte${alerts > 1 ? 's' : ''}</span>
        </a>
      </section>

      <div class="hub-grid">
        ${cards.map(([href, ico, title, sub]) => `
          <a class="hub-card" href="${href}">
            <span class="hub-ico">${ico}</span>
            <span class="hub-title">${esc(title)}</span>
            <span class="hub-sub muted">${esc(sub)}</span>
          </a>`).join('')}
      </div>
    </main>
    ${bottomNav('home')}`;

  $('#logout').onclick = safe(() => supabase.auth.signOut());
}
