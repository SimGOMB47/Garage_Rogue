// ── Fiche véhicule : en-tête photo + 4 onglets (GMAO) ───────────
//
// Onglets : Création d'activité | Fiche technique | Historique | Stock
//  - "Création d'activité" et "Stock de pièces" : à venir (prochain prompt)
//  - "Fiche technique" : sous-ensembles + données techniques (construit ici)
//  - "Historique" : réutilise l'affichage des activités clôturées
//
// Note : les anciens onglets (Activités, Échéances, Stock, Fiche specs)
// sont conservés plus bas dans le fichier — hors interface pour l'instant —
// afin de les rebrancher facilement au prochain prompt.

import * as db from '../db.js';
import {
  VEHICLE_STATUS, OT_TYPES, OT_STATUS, label, vehicleIcon,
  vehicleFields, otFields, deadlineFields, stockFields, specFields,
} from '../constants.js';
import {
  $, $$, esc, fmtMoney, fmtKm, fmtDate, todayISO,
  formModal, confirmModal, toast, safe, dueStatus, dueText, lightbox,
} from '../ui.js';

// Les 4 onglets de la nouvelle page véhicule
const TABS = [
  ['create', 'Création d’activité'],
  ['fiche',  'Fiche technique'],
  ['histo',  'Historique'],
  ['stock',  'Stock de pièces'],
];

// Appui long (mobile) ou clic droit (ordinateur) sur un élément → action
function longPress(el, handler) {
  let timer;
  const start = () => { timer = setTimeout(handler, 500); };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchmove', cancel);
  el.addEventListener('contextmenu', e => { e.preventDefault(); handler(); });
}

export async function renderVehicle(root, id, tab = 'fiche') {
  // Onglet par défaut = Fiche technique ; on ramène tout onglet inconnu
  // (ancien lien /ot, /due…) sur un onglet valide.
  if (!TABS.some(([t]) => t === tab)) tab = 'fiche';

  const v = await db.getVehicle(id);
  const photoUrl = v.photo_path
    ? (await db.photoUrls([{ path: v.photo_path }]))[v.photo_path]
    : null;

  const heroBits = [];
  if (v.year) heroBits.push(v.year);
  heroBits.push(fmtKm(v.km));
  if (v.plate) heroBits.push(v.plate);
  const heroMeta = heroBits.filter(Boolean).map(esc).join(' · ');

  root.innerHTML = `
    <header class="v-hero">
      <div class="v-hero-photo${photoUrl ? '' : ' no-photo'}">
        ${photoUrl ? `<img src="${esc(photoUrl)}" alt="">` : '<span>aucune photo</span>'}
        <a class="hero-btn hero-back" href="#/vehicles" title="Retour">←</a>
        <button class="hero-btn hero-edit" id="edit-vehicle" title="Modifier le véhicule">✎</button>
        <span class="hero-cam" id="v-cam" title="Photo du véhicule">📷</span>
      </div>
      <input type="file" accept="image/*" id="v-photo-input" hidden>
      <div class="v-hero-bar">
        <div class="v-hero-title">
          <span class="v-hero-name">${vehicleIcon(v.type)} ${esc(v.name)}</span>
          <span class="v-hero-status">${esc(label(VEHICLE_STATUS, v.status))}</span>
        </div>
        <div class="v-hero-right">${heroMeta}</div>
      </div>
    </header>
    <nav class="tabs">
      ${TABS.map(([t, l]) =>
        `<a href="#/vehicle/${id}/${t}" class="${t === tab ? 'active' : ''}">${esc(l)}</a>`).join('')}
    </nav>
    <main class="page" id="tab-content"></main>`;

  const content = $('#tab-content');
  const rerender = () => renderVehicle(root, id, tab);

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
      rerender();
    }
  });

  // Photo du véhicule : voir/changer/retirer
  $('#v-cam').onclick = safe(async () => {
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

  // Contenu de l'onglet courant
  if (tab === 'fiche') await ficheTechniqueTab(content, v, rerender);
  else if (tab === 'histo') await histoTab(content, v);
  else content.innerHTML = '<p class="empty">🚧 À venir<br>Cet onglet sera construit prochainement.</p>';
}

// ════════════════════════════════════════════════════════════════
// ONGLET « FICHE TECHNIQUE » — sous-ensembles + données techniques
// ════════════════════════════════════════════════════════════════
async function ficheTechniqueTab(content, v, rerender) {
  const list = await db.listSousEnsembles(v.id);
  // On n'affiche que les sous-ensembles qui ont au moins une donnée
  // (sinon 11 titres vides).
  const withData = list.filter(se => se.donnees_techniques.length > 0);

  content.innerHTML = `
    ${withData.length
      ? withData.map(se => `
        <section class="se-block">
          <h3 class="se-name">${esc(se.nom)}</h3>
          <div class="se-data">
            ${se.donnees_techniques.map(d => `
              <div class="dt-row" data-id="${d.id}">
                <span class="dt-lbl">${esc(d.libelle)}</span>
                <span class="dt-val">${esc(d.valeur ?? '')}</span>
              </div>`).join('')}
          </div>
        </section>`).join('')
      : '<p class="empty">Aucune donnée technique pour l’instant.<br>Touche « + ajouter une donnée » pour commencer.</p>'}
    <button class="btn btn-gmao" id="add-dt">+ ajouter une donnée</button>`;

  // Liste déroulante des sous-ensembles (pour le formulaire d'ajout/édition)
  const seOptions = list.map(se => ({ value: se.id, label: se.nom }));
  const donneeFields = [
    { name: 'sous_ensemble_id', label: 'Sous-ensemble', type: 'select', options: seOptions },
    { name: 'libelle', label: 'Libellé', required: true, placeholder: 'ex : Huile, Couple bouchon vidange' },
    { name: 'valeur',  label: 'Valeur', placeholder: 'ex : 10W40 semi-synthèse, 20 N·m' },
  ];

  // Ajouter une donnée
  $('#add-dt').onclick = safe(async () => {
    const values = await formModal({
      title: 'Nouvelle donnée technique',
      fields: donneeFields,
      values: { sous_ensemble_id: seOptions[0]?.value },
    });
    if (!values) return;
    const se = list.find(x => x.id === values.sous_ensemble_id);
    const ordre = se ? se.donnees_techniques.length : 0;
    await db.saveDonnee({ ...values, ordre });
    toast('Donnée ajoutée');
    rerender();
  });

  // Modifier / supprimer une donnée : appui long ou clic droit
  $$('.dt-row', content).forEach(row => {
    const open = safe(async () => {
      const d = withData.flatMap(se => se.donnees_techniques)
        .find(x => x.id === row.dataset.id);
      if (!d) return;
      const res = await formModal({
        title: 'Modifier la donnée',
        fields: donneeFields,
        values: d,
        dangerLabel: 'Supprimer cette donnée',
      });
      if (res === 'DANGER') {
        if (await confirmModal(`Supprimer « ${d.libelle} » ?`)) {
          await db.deleteDonnee(d.id);
          toast('Donnée supprimée');
          rerender();
        }
      } else if (res) {
        await db.saveDonnee(res, d.id);
        toast('Donnée enregistrée');
        rerender();
      }
    });
    longPress(row, open);
  });
}

// ════════════════════════════════════════════════════════════════
// ONGLET « HISTORIQUE » — activités clôturées (affichage inchangé)
// ════════════════════════════════════════════════════════════════

// Carte d'une activité (partagée avec les écrans qui listent des OT)
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

async function histoTab(content, v) {
  const ots = (await db.listWorkOrders(v.id)).filter(o => o.status === 'cloture');
  content.innerHTML = ots.length
    ? ots.map(otCard).join('')
    : '<p class="empty">Aucune activité terminée pour l’instant.<br>Les activités clôturées se rangeront ici. ✅</p>';
}

// ════════════════════════════════════════════════════════════════
// ANCIENS ONGLETS — conservés hors interface, à rebrancher plus tard
// (Activités, Échéances, Stock, Fiche technique "specs").
// ════════════════════════════════════════════════════════════════

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

    $$('.qty-btn', row).forEach(btn => {
      btn.onclick = safe(async () => {
        const newQty = Math.max(0, Number(p.qty) + Number(btn.dataset.delta));
        await db.saveStockPart({ qty: newQty }, p.id);
        rerender();
      });
    });

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

// ── Onglet : ancienne fiche technique (vehicle_specs) ───────────
async function specTab(content, addBtn, v, rerender) {
  const specs = await db.listSpecs(v.id);
  const urls = await db.photoUrls(
    specs.filter(s => s.photo_path).map(s => ({ path: s.photo_path })));

  content.innerHTML = specs.length
    ? specs.map(s => {
        const meta = [s.brand, s.type, s.qty != null ? `Qté : ${s.qty}` : null]
          .filter(Boolean).map(esc).join(' · ');
        const photo = s.photo_path && urls[s.photo_path];
        return `
        <button class="card due-item" data-id="${s.id}" style="border-left-color: var(--accent)">
          <div class="row">
            ${photo ? `<img class="spec-thumb" src="${esc(photo)}" alt="" loading="lazy" data-photo>` : ''}
            <div class="grow">
              <strong>${esc(s.label)}</strong>
              ${meta ? `<div class="muted">${meta}</div>` : ''}
              ${s.notes ? `<div class="muted clamp">${esc(s.notes)}</div>` : ''}
            </div>
          </div>
        </button>`;
      }).join('')
    : '<p class="empty">Fiche technique vide.<br>Touche + pour créer une fiche<br>(huile, filtre, pneus, couples de serrage…).</p>';

  $$('[data-id]', content).forEach(el => {
    el.onclick = safe(async e => {
      const s = specs.find(x => x.id === el.dataset.id);

      if (e.target.hasAttribute('data-photo')) {
        const res = await formModal({
          title: 'Photo de la fiche',
          fields: [],
          submitLabel: '👁 Voir en grand',
          dangerLabel: 'Retirer la photo',
        });
        if (res === 'DANGER') {
          await db.removeSpecPhoto(s);
          toast('Photo retirée');
          rerender();
        } else if (res) {
          lightbox(urls[s.photo_path]);
        }
        return;
      }

      const res = await formModal({
        title: 'Modifier la fiche technique',
        fields: specFields,
        values: s,
        dangerLabel: 'Supprimer cette fiche',
      });
      if (res === 'DANGER') {
        if (await confirmModal(`Supprimer la fiche « ${s.label} » ?`)) {
          await db.deleteSpec(s);
          toast('Fiche supprimée');
          rerender();
        }
      } else if (res) {
        const { photo, ...data } = res;
        await db.saveSpec(data, s.id);
        if (photo) {
          toast('Envoi de la photo…');
          await db.setSpecPhoto(s, photo);
        }
        toast('Fiche mise à jour');
        rerender();
      }
    });
  });

  addBtn.onclick = safe(async () => {
    const values = await formModal({ title: 'Nouvelle fiche technique', fields: specFields });
    if (!values) return;
    const { photo, ...data } = values;
    const spec = await db.saveSpec({ ...data, vehicle_id: v.id });
    if (photo) {
      toast('Envoi de la photo…');
      await db.setSpecPhoto(spec, photo);
    }
    toast('Fiche créée');
    rerender();
  });
}
