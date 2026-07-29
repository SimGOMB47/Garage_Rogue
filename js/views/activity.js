// ── Bouton « ＋ Créer » : choix du véhicule ──────────────────────
//
// La création d'activité elle-même vit dans la page du véhicule
// (onglet « Création d'activité », js/views/vehicle.js) : c'est là
// que se trouvent les sous-ensembles, les organes et la fiche
// technique. Cet écran ne fait donc qu'une chose : demander sur
// quel véhicule on travaille, puis y renvoyer.

import * as db from '../db.js';
import { $, $$, esc, fmtKm, vehicleAvatar } from '../ui.js';
import { bottomNav } from '../components/nav.js';

export async function renderActivityWizard(root) {
  const vehicles = await db.listVehicles();

  const urls = await db.photoUrls(
    vehicles.filter(v => v.photo_path).map(v => ({ path: v.photo_path })));

  const body = vehicles.length ? `
    <div class="wiz-options">
      ${vehicles.map(v => `
        <button class="option-card" data-vehicle="${v.id}">
          ${vehicleAvatar(v, urls)}
          <span class="opt-txt">
            <span class="opt-title">${esc(v.name)}</span>
            <span class="muted">${esc([v.brand, v.model].filter(Boolean).join(' ') || v.type || '—')} · ${fmtKm(v.km)}</span>
          </span>
        </button>`).join('')}
    </div>`
    : `
    <p class="empty">
      Aucun véhicule pour l’instant.<br><br>
      <a class="btn btn-primary" href="#/vehicles">Créer un véhicule</a>
    </p>`;

  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">➕ Créer une activité</h1>
      <button class="icon-btn" id="wiz-cancel" title="Annuler">✕</button>
    </header>
    <main class="page with-nav">
      <h2 class="wiz-step-title">Sur quel véhicule ?</h2>
      ${body}
    </main>
    ${bottomNav('create')}`;

  $('#wiz-cancel').onclick = () => { location.hash = '#/'; };

  $$('[data-vehicle]').forEach(btn => {
    btn.onclick = () => { location.hash = `#/vehicle/${btn.dataset.vehicle}/create`; };
  });
}
