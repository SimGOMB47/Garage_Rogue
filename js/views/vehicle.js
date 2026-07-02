// ── Fiche véhicule : 4 onglets (OT, échéances, stock, fiche) ────

import * as db from '../db.js';
import {
  VEHICLE_STATUS, OT_TYPES, OT_STATUS, label, vehicleIcon,
  vehicleFields, otFields, deadlineFields, stockFields, specFields,
} from '../constants.js';
import {
  $, $$, esc, fmtMoney, fmtKm, fmtDate, todayISO,
  formModal, confirmModal, toast, safe, dueStatus, dueText,
} from '../ui.js';

export async function renderVehicle(root, id, tab = 'ot') {
  const [v, cost] = await Promise.all([db.getVehicle(id), db.getVehicleCost(id)]);
  const photoUrl = v.photo_path
    ? (await db.photoUrls([{ path: v.photo_path }]))[v.photo_path]
    : null;
  const brandModel = [v.brand, v.model].filter(Boolean).join(' ');
  const meta = [brandModel, v.type, v.year, v.plate].filter(Boolean).map(esc).join(' · ');

  const tabs = [
    ['ot', 'Activités'],
    ['due', 'Échéances'],
    ['stock', 'Stock'],
    ['fiche', 'Fiche'],
    ['histo', 'Historique'],
  ];

  root.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" href="#/vehicles" title="Retour">←</a>
      <h1 class="grow">${vehicleIcon(v.type)} ${esc(v.name)}</h1>
      <button class="icon-btn" id="edit-vehicle" title="Modifier le véhicule">✎</button>
    </header>
    <section class="vehicle-summary">
      <button class="v-avatar" id="v-avatar" title="Photo du véhicule">
        ${photoUrl
          ? `<img src="${esc(photoUrl)}" alt="">`
          : `<span class="ico">${vehicleIcon(v.type)}</span>`}
        <span class="v-avatar-badge">📷</span>
      </button>
      <input type="file" accept="image/*" id="v-photo-input" hidden>
      <span class="badge st-${v.status}">${esc(label(VEHICLE_STATUS, v.status))}</span>
      <span>${fmtKm(v.km)}</span>
      <span class="grow"></span>
      <span class="cost">${fmtMoney(cost)}</span>
      ${meta ? `<div class="muted">${meta}</div>` : ''}
    </section>
    <nav class="tabs">
      ${tabs.map(([t, l]) =>
        `<a href="#/vehicle/${id}/${t}" class="${t === tab ? 'active' : ''}">${l}</a>`).join('')}
    </nav>
    <main class="page" id="tab-content"></main>
    <button class="fab" id="add" title="Ajouter">+</button>`;

  // Modifier / supprimer le véhicule
  $('#edit-vehicle').onclick = safe(async () => {
    const res = await formModal({
      title: 'Modifier le véhicule',
      fields: vehicleFields,
      values: v,
      dangerLabel: 'Supprimer ce véhicule',
    });
    if (res === 'DANGER') {
      const ok = await confirmModal(
        `Supprimer « ${v.name} » et tout son historique (OT, photos, échéances, stock) ?`);
      if (!ok) return;
      await db.deleteVehicle(id);
      toast('Véhicule supprimé');
      location.hash = '#/vehicles';
    } else if (res) {
      await db.saveVehicle(res, id);
      toast('Véhicule enregistré');
      renderVehicle(root, id, tab);
    }
  });

  const content = $('#tab-content');
  const addBtn = $('#add');
  const rerender = () => renderVehicle(root, id, tab);

  // ── Photo du véhicule ─────────────────────────────────────────
  // Toucher l'avatar : voir la photo en grand, la changer (galerie
  // ou appareil photo) ou revenir au symbole.
  $('#v-avatar').onclick = safe(async () => {
    if (!v.photo_path) return $('#v-photo-input').click();
    const res = await formModal({
      title: 'Photo du véhicule',
      fields: [],
      submitLabel: '📷 Changer la photo',
      dangerLabel: 'Retirer la photo (revenir au symbole)',
    });
    if (res === 'DANGER') {
      await db.removeVehiclePhoto(v);
      toast('Photo retirée');
      rerender();
    } else if (res) {
      $('#v-photo-input').click();
    }
  });

  $('#v-photo-input').onchange = safe(async e => {
    const file = e.target.files[0];
    if (!file) return;
    toast('Envoi de la photo…');
    await db.setVehiclePhoto(v, file);
    toast('Photo du véhicule enregistrée 📷');
    rerender();
  });

  if (tab === 'due') await dueTab(content, addBtn, v, rerender);
  else if (tab === 'stock') await stockTab(content, addBtn, v, rerender);
  else if (tab === 'fiche') await ficheTab(content, addBtn, v, rerender);
  else if (tab === 'histo') await histoTab(content, addBtn, v);
  else await otTab(content, addBtn, v);
}

// Carte d'une activité (partagée entre Activités et Historique)
function otCard(ot) {
  const cost = (ot.work_order_parts || [])
    .reduce((s, p) => s + Number(p.price) * Number(p.qty), 0);
  return `
    <a class="card" href="#/ot/${ot.id}">
      <div class="row">
        <span class="badge type-${ot.type}">${esc(label(OT_TYPES, ot.type))}</span>
        <span class="chip st-${ot.status}">${esc(label(OT_STATUS, ot.status))}</span>
        <span class="grow"></span>
        <span class="muted">${fmtDate(ot.date)}</span>
      </div>
      ${ot.subsystem ? `<div><strong>${esc(ot.subsystem)}</strong></div>` : ''}
      ${ot.description ? `<div class="muted clamp">${esc(ot.description)}</div>` : ''}
      <div class="row">
        <span class="muted">${ot.km != null ? fmtKm(ot.km) : ''}</span>
        <span class="grow"></span>
        ${cost ? `<span class="cost">${fmtMoney(cost)}</span>` : ''}
      </div>
    </a>`;
}

// ── Onglet : activités en cours ou prévues ──────────────────────
async function otTab(content, addBtn, v) {
  const ots = (await db.listWorkOrders(v.id)).filter(o => o.status !== 'cloture');

  content.innerHTML = ots.length
    ? ots.map(otCard).join('')
    : '<p class="empty">Aucune activité en cours ou prévue.<br>Touche + pour en créer une.</p>';

  addBtn.onclick = safe(async () => {
    const values = await formModal({
      title: 'Nouvelle activité',
      fields: otFields,
      values: { type: 'correctif', status: 'ouvert', date: todayISO(), km: v.km },
    });
    if (!values) return;
    const ot = await db.saveWorkOrder({ ...values, vehicle_id: v.id });
    toast('Activité créée — ajoute pièces et photos');
    location.hash = `#/ot/${ot.id}`;
  });
}

// ── Onglet : historique (activités terminées) ───────────────────
async function histoTab(content, addBtn, v) {
  addBtn.style.display = 'none'; // on ne crée rien depuis l'historique
  const ots = (await db.listWorkOrders(v.id)).filter(o => o.status === 'cloture');

  content.innerHTML = ots.length
    ? ots.map(otCard).join('')
    : '<p class="empty">Aucune activité terminée pour l’instant.<br>Les activités clôturées se rangeront ici. ✅</p>';
}

// ── Onglet : échéances préventives ──────────────────────────────
async function dueTab(content, addBtn, v, rerender) {
  const items = await db.listDeadlines(v.id);

  // Tri : en retard d'abord, puis proches, puis OK
  const order = { late: 0, soon: 1, ok: 2 };
  items.sort((a, b) => order[dueStatus(a, v.km)] - order[dueStatus(b, v.km)]);

  content.innerHTML = `
    <p class="muted" style="margin:0">🤖 Programme ici les entretiens à date fixe :
    l’activité se créera <strong>toute seule 1 mois avant</strong> l’échéance
    et apparaîtra dans le Planning.</p>
    ${items.length
      ? items.map(d => `
        <button class="card due-item due-${dueStatus(d, v.km)}" data-id="${d.id}">
          <strong>${esc(d.title)}</strong>
          <div class="due-when">${esc(dueText(d, v.km))}</div>
          ${d.notes ? `<div class="muted clamp">${esc(d.notes)}</div>` : ''}
          ${d.work_order_id
            ? '<div class="warn-chip" style="color:var(--green)">✓ Activité créée automatiquement — visible dans le Planning</div>'
            : ''}
        </button>`).join('')
      : '<p class="empty">Aucune échéance programmée.<br>Touche + pour en ajouter une (vidange, contrôle technique…).</p>'}`;

  // Toucher une échéance → la modifier ou la supprimer
  $$('.due-item', content).forEach(el => {
    el.onclick = safe(async () => {
      const d = items.find(x => x.id === el.dataset.id);
      const res = await formModal({
        title: 'Modifier l’échéance',
        fields: deadlineFields,
        values: d,
        dangerLabel: 'Supprimer cette échéance',
      });
      if (res === 'DANGER') {
        if (await confirmModal(`Supprimer « ${d.title} » ?`)) {
          await db.deleteDeadline(d.id);
          toast('Échéance supprimée');
          rerender();
        }
      } else if (res) {
        // Si la date change, on ré-arme la création automatique
        // (une nouvelle activité sera créée 1 mois avant la nouvelle date)
        if (res.due_date !== d.due_date) res.work_order_id = null;
        await db.saveDeadline(res, d.id);
        toast('Échéance enregistrée');
        rerender();
      }
    });
  });

  addBtn.onclick = safe(async () => {
    const values = await formModal({ title: 'Programmer une échéance', fields: deadlineFields });
    if (!values) return;
    await db.saveDeadline({ ...values, vehicle_id: v.id });
    toast('Échéance programmée 🤖');
    rerender();
  });
}

// ── Onglet : stock de pièces ────────────────────────────────────
async function stockTab(content, addBtn, v, rerender) {
  const items = await db.listStock(v.id);

  content.innerHTML = items.length
    ? items.map(p => `
        <div class="card stock-row" data-id="${p.id}">
          <div class="grow" data-edit style="cursor:pointer">
            <strong>${esc(p.name)}</strong>
            <div class="muted">${[p.ref, p.price != null ? fmtMoney(p.price) : null]
              .filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div>
          </div>
          <button class="qty-btn" data-delta="-1">−</button>
          <span class="qty">${Number(p.qty)}</span>
          <button class="qty-btn" data-delta="1">+</button>
        </div>`).join('')
    : '<p class="empty">Aucune pièce en stock pour ce véhicule.<br>Touche + pour en ajouter.</p>';

  $$('.stock-row', content).forEach(row => {
    const p = items.find(x => x.id === row.dataset.id);

    // Boutons − / + : ajuste la quantité directement
    $$('.qty-btn', row).forEach(btn => {
      btn.onclick = safe(async () => {
        const newQty = Math.max(0, Number(p.qty) + Number(btn.dataset.delta));
        await db.saveStockPart({ qty: newQty }, p.id);
        rerender();
      });
    });

    // Toucher le nom → modifier ou supprimer
    $('[data-edit]', row).onclick = safe(async () => {
      const res = await formModal({
        title: 'Modifier la pièce',
        fields: stockFields,
        values: p,
        dangerLabel: 'Supprimer cette pièce',
      });
      if (res === 'DANGER') {
        if (await confirmModal(`Supprimer « ${p.name} » du stock ?`)) {
          await db.deleteStockPart(p.id);
          toast('Pièce supprimée');
          rerender();
        }
      } else if (res) {
        await db.saveStockPart(res, p.id);
        toast('Pièce enregistrée');
        rerender();
      }
    });
  });

  addBtn.onclick = safe(async () => {
    const values = await formModal({
      title: 'Nouvelle pièce en stock',
      fields: stockFields,
      values: { qty: 1 },
    });
    if (!values) return;
    await db.saveStockPart({ ...values, vehicle_id: v.id });
    toast('Pièce ajoutée au stock');
    rerender();
  });
}

// ── Onglet : fiche technique ────────────────────────────────────
async function ficheTab(content, addBtn, v, rerender) {
  const specs = await db.listSpecs(v.id);

  content.innerHTML = specs.length
    ? specs.map(s => `
        <button class="card due-item" data-id="${s.id}" style="border-left-color: var(--accent)">
          <div class="row">
            <span class="muted">${esc(s.label)}</span>
            <span class="grow"></span>
            <strong>${esc(s.value ?? '—')}</strong>
          </div>
        </button>`).join('')
    : '<p class="empty">Fiche technique vide.<br>Touche + pour ajouter une caractéristique<br>(huile, pression pneus, couples de serrage…).</p>';

  $$('[data-id]', content).forEach(el => {
    el.onclick = safe(async () => {
      const s = specs.find(x => x.id === el.dataset.id);
      const res = await formModal({
        title: 'Modifier la caractéristique',
        fields: specFields,
        values: s,
        dangerLabel: 'Supprimer cette ligne',
      });
      if (res === 'DANGER') {
        if (await confirmModal(`Supprimer « ${s.label} » ?`)) {
          await db.deleteSpec(s.id);
          rerender();
        }
      } else if (res) {
        await db.saveSpec(res, s.id);
        toast('Fiche mise à jour');
        rerender();
      }
    });
  });

  addBtn.onclick = safe(async () => {
    const values = await formModal({ title: 'Nouvelle caractéristique', fields: specFields });
    if (!values) return;
    await db.saveSpec({ ...values, vehicle_id: v.id });
    rerender();
  });
}
