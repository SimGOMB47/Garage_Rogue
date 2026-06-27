// ── Tableau de bord : statistiques (brique 5) ───────────────────

import { bottomNav } from '../components/nav.js';

export async function renderDashboard(root) {
  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">📊 Tableau de bord</h1>
    </header>
    <main class="page with-nav">
      <p class="empty">Cette section arrive très vite 🔧<br><span class="muted">(brique 5)</span></p>
    </main>
    ${bottomNav('dashboard')}`;
}
