// ── Planning : liste chronologique des activités (brique 4) ─────

import { bottomNav } from '../components/nav.js';

export async function renderPlanning(root) {
  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">📅 Planning</h1>
    </header>
    <main class="page with-nav">
      <p class="empty">Cette section arrive très vite 🔧<br><span class="muted">(brique 4)</span></p>
    </main>
    ${bottomNav('planning')}`;
}
