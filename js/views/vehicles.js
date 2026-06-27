// ── Écran d'accueil : liste des véhicules ───────────────────────

import * as db from '../db.js';
import { VEHICLE_STATUS, vehicleFields, label } from '../constants.js';
import { $, $$, esc, fmtMoney, fmtKm, formModal, toast, safe, dueStatus } from '../ui.js';
import { bottomNav } from '../components/nav.js';

function vehicleCard(v, deadlines) {
  // Indicateur d'échéances en retard (rouge) ou proches (orange)
  const statuses = deadlines.map(d => dueStatus(d, v.km));
  const late = statuses.filter(s => s === 'late').length;
  const soon = statuses.filter(s => s === 'soon').length;
  const warn = late
    ? `<span class="warn-chip late">⚠ ${late} échéance${late > 1 ? 's' : ''} dépassée${late > 1 ? 's' : ''}</span>`
    : soon
      ? `<span class="warn-chip soon">🕒 ${soon} échéance${soon > 1 ? 's' : ''} proche${soon > 1 ? 's' : ''}</span>`
      : '';

  const brandModel = [v.brand, v.model].filter(Boolean).join(' ');
  const meta = [brandModel, v.type, v.year, v.plate].filter(Boolean).map(esc).join(' · ');

  return `
    <a class="card vehicle-card" href="#/vehicle/${v.id}/ot">
      <div class="row">
        <strong class="grow">${esc(v.name)}</strong>
        <span class="badge st-${v.status}">${esc(label(VEHICLE_STATUS, v.status))}</span>
      </div>
      ${meta ? `<div class="muted">${meta}</div>` : ''}
      <div class="row">
        <span>${fmtKm(v.km)}</span>
        ${warn}
        <span class="grow"></span>
        <span class="cost">${fmtMoney(v.total_cost)}</span>
      </div>
    </a>`;
}

export async function renderVehicles(root) {
  const [vehicles, allDeadlines] = await Promise.all([
    db.listVehicles(),
    db.listAllDeadlines(),
  ]);

  root.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" href="#/" title="Accueil">←</a>
      <h1 class="grow">🚗 Mes véhicules</h1>
    </header>
    <main class="page with-nav">
      ${vehicles.length
        ? vehicles.map(v => vehicleCard(v, allDeadlines.filter(d => d.vehicle_id === v.id))).join('')
        : '<p class="empty">Aucun véhicule pour l’instant.<br>Touche le bouton + pour ajouter le premier !</p>'}
    </main>
    <button class="fab with-nav" id="add" title="Ajouter un véhicule">+</button>
    ${bottomNav('vehicles')}`;

  $('#add').onclick = safe(async () => {
    const values = await formModal({
      title: 'Nouveau véhicule',
      fields: vehicleFields,
      values: { km: 0, status: 'en_service' },
    });
    if (!values) return;
    const v = await db.saveVehicle(values);
    toast('Véhicule ajouté');
    location.hash = `#/vehicle/${v.id}/ot`;
  });
}
