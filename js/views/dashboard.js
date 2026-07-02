// ── Tableau de bord : la santé du garage en un coup d'œil (brique 5) ──
// 4 sections : chiffres clés, coût par véhicule, répartition par
// type d'intervention, activité des 12 derniers mois.

import * as db from '../db.js';
import { OT_TYPES } from '../constants.js';
import { esc, fmtMoney } from '../ui.js';
import { bottomNav } from '../components/nav.js';

const TYPE_COLORS = {
  preventif:   'var(--blue)',
  correctif:   'var(--orange)',
  amelioratif: 'var(--violet)',
};

export async function renderDashboard(root) {
  const [vehicles, workOrders] = await Promise.all([
    db.listVehicles(),
    db.listAllWorkOrders(),
  ]);

  // ── 1) Chiffres clés ───────────────────────────────────────────
  const todo      = workOrders.filter(w => w.status !== 'cloture').length;
  const done      = workOrders.length - todo;
  const totalCost = vehicles.reduce((s, v) => s + v.total_cost, 0);

  // ── 2) Coût par véhicule (du plus cher au moins cher) ──────────
  const byCost  = [...vehicles].sort((a, b) => b.total_cost - a.total_cost);
  const maxCost = Math.max(...byCost.map(v => v.total_cost), 1);

  // ── 3) Répartition par type d'intervention ─────────────────────
  const types   = OT_TYPES.map(t => ({
    ...t, n: workOrders.filter(w => w.type === t.value).length,
  }));
  const maxType = Math.max(...types.map(t => t.n), 1);

  // ── 4) Activité par mois (12 derniers mois, clôturées ou non) ──
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: d.toLocaleDateString('fr-FR', { month: 'narrow' }),
      full:  d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      n: workOrders.filter(w => w.date.startsWith(key)).length,
    });
  }
  const maxMonth = Math.max(...months.map(m => m.n), 1);

  // ── Rendu ──────────────────────────────────────────────────────
  const tile = (num, lbl) => `
    <div class="summary-tile">
      <span class="summary-num">${num}</span>
      <span class="summary-lbl">${lbl}</span>
    </div>`;

  const costBar = v => `
    <a class="bar-row" href="#/vehicle/${v.id}/ot">
      <div class="row">
        <span class="grow">${esc(v.name)}</span>
        <span class="cost">${fmtMoney(v.total_cost)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(v.total_cost / maxCost) * 100}%"></div>
      </div>
    </a>`;

  const typeBar = t => `
    <div class="bar-row">
      <div class="row">
        <span class="badge type-${t.value}">${esc(t.label)}</span>
        <span class="grow"></span>
        <strong>${t.n}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(t.n / maxType) * 100}%; background:${TYPE_COLORS[t.value]}"></div>
      </div>
    </div>`;

  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">📊 Tableau de bord</h1>
    </header>
    <main class="page with-nav">

      ${vehicles.length === 0 ? `
        <p class="empty">Pas encore de données 📊<br><br>
          <a class="btn btn-primary" href="#/vehicles">Créer ton premier véhicule</a>
        </p>` : `

        <section class="stat-grid">
          ${tile('🚗 ' + vehicles.length, `véhicule${vehicles.length > 1 ? 's' : ''}`)}
          ${tile(todo, 'activité' + (todo > 1 ? 's' : '') + ' à faire')}
          ${tile(done, 'terminée' + (done > 1 ? 's' : ''))}
          ${tile(fmtMoney(totalCost), 'dépensés en pièces')}
        </section>

        <section class="card">
          <h2>💰 Coût par véhicule</h2>
          <div class="bars">${byCost.map(costBar).join('')}</div>
        </section>

        <section class="card">
          <h2>🔧 Types d'intervention</h2>
          ${workOrders.length ? `
            <div class="bars">${types.map(typeBar).join('')}</div>
            <p class="muted" style="margin:10px 0 0">💡 Beaucoup de correctif ? Ajoute des échéances
            préventives pour anticiper les pannes.</p>`
            : '<p class="muted">Aucune activité pour l’instant.</p>'}
        </section>

        <section class="card">
          <h2>📈 Activité sur 12 mois</h2>
          <div class="chart">
            ${months.map(m => `
              <div class="chart-col" title="${esc(m.full)} : ${m.n}">
                ${m.n ? `<span class="chart-num">${m.n}</span>` : ''}
                <div class="chart-bar" style="height:${(m.n / maxMonth) * 100}%"></div>
                <span class="chart-lbl">${esc(m.label)}</span>
              </div>`).join('')}
          </div>
        </section>`}

    </main>
    ${bottomNav('dashboard')}`;
}
