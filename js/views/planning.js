// ── Planning : activités à faire, groupées par véhicule (brique 4) ──
// Seuls les véhicules ayant des activités prévues ou en cours
// apparaissent. On touche un véhicule → ses activités se déplient,
// classées de la plus urgente (en retard) à la plus lointaine.

import * as db from '../db.js';
import { OT_TYPES, OT_STATUS, label } from '../constants.js';
import { $$, esc, fmtDate, todayISO, dueStatus, dueText } from '../ui.js';
import { bottomNav } from '../components/nav.js';

// "dans 3 j", "aujourd'hui", "il y a 5 j"
function relDate(dateISO) {
  const days = Math.round((new Date(dateISO + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days === -1) return 'hier';
  return days > 0 ? `dans ${days} j` : `il y a ${-days} j`;
}

// Mémorise les véhicules dépliés : si l'écran est redessiné par la
// synchro temps réel, ils restent dépliés.
const openVehicles = new Set();

export async function renderPlanning(root) {
  const [vehicles, workOrders, deadlines] = await Promise.all([
    db.listVehicles(),
    db.listAllWorkOrders(),
    db.listAllDeadlines(),
  ]);

  const today = todayISO();
  const vName = id => vehicles.find(v => v.id === id)?.name ?? '?';
  const vKm   = id => vehicles.find(v => v.id === id)?.km ?? 0;

  // ── Activités à faire, groupées par véhicule ───────────────────
  // Tri par date croissante : la plus en retard tout en haut,
  // puis la plus proche d'aujourd'hui, puis les plus lointaines.
  const open = workOrders
    .filter(w => w.status !== 'cloture')
    .sort((a, b) => a.date.localeCompare(b.date));

  const groups = vehicles
    .map(v => ({ v, ots: open.filter(w => w.vehicle_id === v.id) }))
    .filter(g => g.ots.length)
    // Véhicule le plus urgent en premier (date de sa 1re activité)
    .sort((a, b) => a.ots[0].date.localeCompare(b.ots[0].date));

  // Échéances en alerte (dépassées ou proches), les plus urgentes d'abord
  const orderDue = { late: 0, soon: 1 };
  const alertDues = deadlines
    .map(d => ({ ...d, st: dueStatus(d, vKm(d.vehicle_id)) }))
    .filter(d => d.st !== 'ok')
    .sort((a, b) => orderDue[a.st] - orderDue[b.st]);

  // ── Cartes ─────────────────────────────────────────────────────
  const otCard = w => `
    <a class="card plan-item ${w.date < today ? 'plan-late' : ''}" href="#/ot/${w.id}">
      <div class="row">
        <span class="badge type-${w.type}">${esc(label(OT_TYPES, w.type))}</span>
        <span class="chip st-${w.status}">${esc(label(OT_STATUS, w.status))}</span>
        <span class="grow"></span>
        <span class="${w.date < today ? 'warn-chip late' : 'muted'}">${fmtDate(w.date)} · ${relDate(w.date)}</span>
      </div>
      ${w.subsystem ? `<div><strong>${esc(w.subsystem)}</strong></div>` : ''}
      ${w.description ? `<div class="muted clamp">${esc(w.description)}</div>` : ''}
    </a>`;

  const vehicleGroup = ({ v, ots }) => {
    const lateCount = ots.filter(w => w.date < today).length;
    return `
      <details class="plan-vehicle" data-id="${v.id}" ${openVehicles.has(v.id) ? 'open' : ''}>
        <summary class="card">
          <span class="opt-ico">🚗</span>
          <span class="opt-txt grow">
            <span class="opt-title">${esc(v.name)}</span>
            <span class="muted">
              ${ots.length} activité${ots.length > 1 ? 's' : ''}
              ${lateCount ? ` · <span class="warn-chip late">${lateCount} en retard</span>` : ''}
              · prochaine : ${relDate(ots[0].date)}
            </span>
          </span>
          <span class="plan-arrow">▾</span>
        </summary>
        <div class="plan-ots">${ots.map(otCard).join('')}</div>
      </details>`;
  };

  // Carte d'une échéance en alerte → mène à l'onglet Échéances du véhicule
  const dueCard = d => `
    <a class="card due-item due-${d.st}" href="#/vehicle/${d.vehicle_id}/due">
      <div class="row">
        <strong>${esc(d.title)}</strong>
        <span class="grow"></span>
        <span class="muted">${esc(vName(d.vehicle_id))}</span>
      </div>
      <div class="due-when">${esc(dueText(d, vKm(d.vehicle_id)))}</div>
    </a>`;

  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">📅 Planning</h1>
    </header>
    <main class="page with-nav">

      ${alertDues.length ? `
        <h2 class="plan-h">⚠️ Échéances à surveiller <span class="plan-count">${alertDues.length}</span></h2>
        ${alertDues.map(dueCard).join('')}` : ''}

      ${groups.length ? `
        <h2 class="plan-h">🔧 Activités à faire</h2>
        ${groups.map(vehicleGroup).join('')}` : `
        <p class="empty">Rien de prévu pour l’instant 🎉<br><br>
          <a class="btn btn-primary" href="#/new">➕ Créer une activité</a>
        </p>`}

    </main>
    ${bottomNav('planning')}`;

  // Retient quels véhicules sont dépliés
  $$('.plan-vehicle').forEach(el => {
    el.addEventListener('toggle', () => {
      if (el.open) openVehicles.add(el.dataset.id);
      else openVehicles.delete(el.dataset.id);
    });
  });

}
