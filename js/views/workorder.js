// ── Détail d'un ordre de travail : infos, pièces, photos ────────

import * as db from '../db.js';
import { OT_TYPES, OT_STATUS, label, otFields } from '../constants.js';
import {
  $, $$, esc, fmtMoney, fmtKm, fmtDate,
  formModal, confirmModal, toast, safe, lightbox,
} from '../ui.js';

export async function renderWorkOrder(root, id, mode) {
  const isNew = mode === 'new'; // arrivée depuis l'assistant de création
  const ot = await db.getWorkOrder(id);
  const parts = (ot.work_order_parts || [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const photos = (ot.work_order_photos || [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const urls = await db.photoUrls(photos);
  const total = parts.reduce((s, p) => s + Number(p.price) * Number(p.qty), 0);
  const rerender = () => renderWorkOrder(root, id, mode);

  root.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" href="#/vehicle/${ot.vehicle_id}/ot" title="Retour">←</a>
      <h1 class="grow">${isNew ? 'Nouvelle activité' : `OT du ${fmtDate(ot.date)}`}</h1>
      <button class="icon-btn" id="edit-ot" title="Modifier l’OT">✎</button>
    </header>
    <main class="page">

      <section class="card">
        <div class="row">
          <span class="badge type-${ot.type}">${esc(label(OT_TYPES, ot.type))}</span>
          <span class="chip st-${ot.status}">${esc(label(OT_STATUS, ot.status))}</span>
          <span class="grow"></span>
          <span class="muted">${ot.km != null ? fmtKm(ot.km) : ''}</span>
        </div>
        ${ot.subsystem ? `<div><strong>${esc(ot.subsystem)}</strong></div>` : ''}
        ${ot.description ? `<div style="white-space:pre-wrap">${esc(ot.description)}</div>` : ''}
      </section>

      <section class="card">
        <h2>Pièces</h2>
        ${parts.length ? `
          <ul class="part-list">
            ${parts.map(p => `
              <li>
                <span class="grow">${esc(p.name)}${Number(p.qty) !== 1 ? ` × ${Number(p.qty)}` : ''}</span>
                <span>${fmtMoney(Number(p.price) * Number(p.qty))}</span>
                <button class="part-del" data-id="${p.id}" title="Retirer">✕</button>
              </li>`).join('')}
          </ul>
          <div class="part-total">Total : <span class="cost">${fmtMoney(total)}</span></div>`
          : '<p class="muted">Aucune pièce pour l’instant.</p>'}
        <form id="part-form" class="part-form" style="margin-top:10px">
          <input name="name" placeholder="Pièce" required>
          <input name="qty" type="number" inputmode="decimal" step="any" min="0" value="1" title="Quantité">
          <input name="price" type="number" inputmode="decimal" step="any" min="0" placeholder="€" title="Prix unitaire">
          <button class="btn btn-primary" title="Ajouter la pièce">+</button>
        </form>
      </section>

      <section class="card">
        <h2>Photos</h2>
        <div class="photo-grid">
          ${photos.map(p => `
            <div class="thumb" data-id="${p.id}">
              <img src="${esc(urls[p.path] || '')}" alt="" loading="lazy">
              <button class="thumb-del" title="Supprimer">✕</button>
            </div>`).join('')}
          <label class="photo-add">
            <span>＋</span><span>Ajouter</span>
            <input type="file" accept="image/*" multiple>
          </label>
        </div>
      </section>

      ${isNew ? `
        <button class="btn btn-primary" id="finish-new">✓ Créer l’activité</button>
        <p class="muted" style="text-align:center">Ajoute d’abord les pièces et les photos si besoin.</p>` : ''}

    </main>`;

  // Bouton final de l'assistant : valide et retourne à l'accueil
  if (isNew) {
    $('#finish-new').onclick = () => {
      toast('Activité créée 🎉');
      location.hash = '#/';
    };
  }

  // Modifier / supprimer l'OT
  $('#edit-ot').onclick = safe(async () => {
    const res = await formModal({
      title: 'Modifier l’ordre de travail',
      fields: otFields,
      values: ot,
      dangerLabel: 'Supprimer cet OT',
    });
    if (res === 'DANGER') {
      if (await confirmModal('Supprimer cet ordre de travail, ses pièces et ses photos ?')) {
        await db.deleteWorkOrder(id);
        toast('OT supprimé');
        location.hash = `#/vehicle/${ot.vehicle_id}/ot`;
      }
    } else if (res) {
      await db.saveWorkOrder(res, id);
      toast('OT enregistré');
      rerender();
    }
  });

  // Ajouter une pièce
  $('#part-form').onsubmit = safe(async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await db.addPart(id, {
      name: String(fd.get('name')).trim(),
      qty: Number(fd.get('qty') || 1),
      price: Number(fd.get('price') || 0),
    });
    rerender();
  });

  // Retirer une pièce
  $$('.part-del').forEach(btn => {
    btn.onclick = safe(async () => {
      await db.deletePart(btn.dataset.id);
      rerender();
    });
  });

  // Ajouter des photos (sur iPhone : appareil photo ou pellicule)
  $('.photo-add input').onchange = safe(async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    toast(`Envoi de ${files.length} photo${files.length > 1 ? 's' : ''}…`);
    await db.uploadPhotos(id, files);
    toast('Photos ajoutées');
    rerender();
  });

  // Voir une photo en grand / la supprimer
  $$('.thumb').forEach(el => {
    const photo = photos.find(p => p.id === el.dataset.id);
    $('img', el).onclick = () => lightbox(urls[photo.path]);
    $('.thumb-del', el).onclick = safe(async () => {
      if (await confirmModal('Supprimer cette photo ?')) {
        await db.deletePhoto(photo);
        rerender();
      }
    });
  });
}
