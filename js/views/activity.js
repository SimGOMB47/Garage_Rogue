// ── Assistant de création d'activité, pas à pas (brique 3) ──────

import { bottomNav } from '../components/nav.js';

export async function renderActivityWizard(root) {
  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">➕ Créer une activité</h1>
    </header>
    <main class="page with-nav">
      <p class="empty">L’assistant pas à pas arrive très vite 🔧<br><span class="muted">(brique 3)</span></p>
    </main>
    ${bottomNav('create')}`;
}
