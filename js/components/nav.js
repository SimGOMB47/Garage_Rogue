// ── Barre d'onglets en bas (navigation principale) ──────────────
// Présente sur les écrans principaux (accueil, véhicules, planning,
// tableau de bord). Les liens utilisent les "adresses" #/… : c'est
// le routeur de app.js qui affiche le bon écran, aucun JS requis ici.

export function bottomNav(active) {
  const items = [
    ['home',      '#/',          '🏠', 'Accueil'],
    ['vehicles',  '#/vehicles',  '🚗', 'Véhicules'],
    ['create',    '#/new',       '＋', 'Créer'],
    ['planning',  '#/planning',  '📅', 'Planning'],
    ['dashboard', '#/dashboard', '📊', 'Bord'],
  ];
  return `
    <nav class="bottom-nav">
      ${items.map(([key, href, ico, lbl]) => `
        <a href="${href}" class="${key === 'create' ? 'nav-create ' : ''}${key === active ? 'active' : ''}">
          <span class="nav-ico">${ico}</span>
          <span class="nav-lbl">${lbl}</span>
        </a>`).join('')}
    </nav>`;
}
