// ── Planning : activités à faire, groupées par véhicule (brique 4) ──
// Seuls les véhicules ayant des activités prévues ou en cours
// apparaissent. On touche un véhicule → ses activités se déplient,
// classées de la plus urgente (en retard) à la plus lointaine.

import * as db from '../db.js';
import { OT_TYPES, OT_STATUS, label } from '../constants.js';
import {
  $$, esc, fmtDate, todayISO, dueStatus, dueText, otLate, vehicleAvatar,
  lienActivite, ORIGINE_PLANNING,
} from '../ui.js';
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
  // Liens signés des photos de profil (pour ceux qui en ont une)
  const purls = await db.photoUrls(
    vehicles.filter(v => v.photo_path).map(v => ({ path: v.photo_path })));

  const today = todayISO();
  const vName = id => vehicles.find(v => v.id === id)?.name ?? '?';
  const vKm   = id => vehicles.find(v => v.id === id)?.km ?? 0;

  // ── Activités à faire, groupées par véhicule ───────────────────
  // Tri par date croissante : la plus en retard tout en haut,
  // puis la plus proche d'aujourd'hui, puis les plus lointaines.
  // Tri sur la date de FIN. Les activités sans date de fin (créées
  // avant la refonte GMAO) n'ont rien qui permette de les situer :
  // elles passent en dernier.
  const cle = w => w.date_fin || '9999-12-31';
  const open = workOrders
    .filter(w => w.statut !== 'cloture')
    .sort((a, b) => cle(a).localeCompare(cle(b)));

  const groups = vehicles
    .map(v => ({ v, ots: open.filter(w => w.vehicle_id === v.id) }))
    .filter(g => g.ots.length)
    // Véhicule le plus urgent en premier (échéance de sa 1re activité)
    .sort((a, b) => cle(a.ots[0]).localeCompare(cle(b.ots[0])));

  // Échéances en alerte (dépassées ou proches), les plus urgentes d'abord
  const orderDue = { late: 0, soon: 1 };
  const alertDues = deadlines
    .filter(d => !d.work_order_id)   // son activité existe déjà → elle prend le relais
    .map(d => ({ ...d, st: dueStatus(d, vKm(d.vehicle_id)) }))
    .filter(d => d.st !== 'ok')
    .sort((a, b) => orderDue[a.st] - orderDue[b.st]);

  // ── Cartes ─────────────────────────────────────────────────────
  const otCard = w => {
    const late = otLate(w, today);
    return `
    <a class="card plan-item ${late ? 'plan-late' : ''}" href="${esc(lienActivite(w.id, ORIGINE_PLANNING))}">
      <div class="row">
        <span class="badge type-${w.type}">${esc(label(OT_TYPES, w.type))}</span>
        <span class="chip st-${w.statut}">${esc(label(OT_STATUS, w.statut))}</span>
        <span class="grow"></span>
        <span class="${late ? 'warn-chip late' : 'muted'}">${w.date_fin
          ? `${fmtDate(w.date_fin)} · ${relDate(w.date_fin)}`
          : 'date manquante'}</span>
      </div>
      ${w.subsystem ? `<div><strong>${esc(w.subsystem)}</strong></div>` : ''}
      ${w.description ? `<div class="muted clamp">${esc(w.description)}</div>` : ''}
    </a>`;
  };

  const vehicleGroup = ({ v, ots }) => {
    const lateCount = ots.filter(w => otLate(w, today)).length;
    return `
      <details class="plan-vehicle" data-id="${v.id}" ${openVehicles.has(v.id) ? 'open' : ''}>
        <summary class="card">
          ${vehicleAvatar(v, purls)}
          <span class="opt-txt grow">
            <span class="opt-title">${esc(v.name)}</span>
            <span class="muted">
              ${ots.length} activité${ots.length > 1 ? 's' : ''}
              ${lateCount ? ` · <span class="warn-chip late">${lateCount} en retard</span>` : ''}
              ${ots[0].date_fin ? `· prochaine : ${relDate(ots[0].date_fin)}` : ''}
            </span>
          </span>
          <span class="plan-arrow">▾</span>
        </summary>
        <div class="plan-ots">${ots.map(otCard).join('')}</div>
      </details>`;
  };

  // Carte d'une échéance en alerte → mène à l'onglet Échéances du véhicule
  const dueCard = d => `
    <a class="card due-item due-${d.st}" href="#/vehicle/${d.vehicle_id}/ech">
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
