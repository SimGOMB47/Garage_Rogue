// ── Assistant de création d'activité, pas à pas (brique 3) ──────
// 5 étapes : véhicule → type → sous-ensemble → détails → récap.
// À la fin, on crée l'ordre de travail et on ouvre sa fiche pour
// pouvoir ajouter les pièces et les photos.

import * as db from '../db.js';
import { OT_TYPES, SUBSYSTEMS, label } from '../constants.js';
import { $, $$, esc, fmtKm, fmtDate, todayISO, toast, safe, vehicleAvatar } from '../ui.js';
import { bottomNav } from '../components/nav.js';

// L'avancement est gardé ici, EN DEHORS de la fonction : si l'écran
// est redessiné (synchro temps réel), on ne perd pas ce qui est saisi.
let wiz = null;

const freshWiz = () => ({
  step: 1,
  vehicle: null,      // objet véhicule choisi à l'étape 1
  type: null,         // preventif | correctif | amelioratif
  subsystem: null,    // Moteur, Freinage… (optionnel)
  date: todayISO(),
  km: '',
  description: '',
});

// Explications simples de chaque type d'intervention
const TYPE_INFOS = {
  preventif:   ['🛡️', 'Entretien planifié : vidange, filtres, contrôles…'],
  correctif:   ['🔧', 'Réparer une panne ou un problème constaté'],
  amelioratif: ['⚡', 'Améliorer ou équiper le véhicule'],
};

const TITLES = {
  1: 'Quel véhicule ?',
  2: 'Quel type d’intervention ?',
  3: 'Quel sous-ensemble ?',
  4: 'Les détails',
  5: 'Récapitulatif',
};
const TOTAL = 5;

export async function renderActivityWizard(root) {
  if (!wiz) wiz = freshWiz();
  const vehicles = await db.listVehicles();

  // Si le véhicule choisi a été supprimé entre-temps, on repart au début
  if (wiz.vehicle && !vehicles.find(v => v.id === wiz.vehicle.id)) wiz = freshWiz();

  const rerender = () => renderActivityWizard(root);

  // ── Contenu propre à chaque étape ─────────────────────────────
  let body = '';

  if (wiz.step === 1) {
    const urls = await db.photoUrls(
      vehicles.filter(v => v.photo_path).map(v => ({ path: v.photo_path })));
    body = vehicles.length ? `
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

  } else if (wiz.step === 2) {
    body = `
      <div class="wiz-options">
        ${OT_TYPES.map(t => `
          <button class="option-card" data-type="${t.value}">
            <span class="opt-ico">${TYPE_INFOS[t.value][0]}</span>
            <span class="opt-txt">
              <span class="opt-title">${esc(t.label)}</span>
              <span class="muted">${esc(TYPE_INFOS[t.value][1])}</span>
            </span>
          </button>`).join('')}
      </div>`;

  } else if (wiz.step === 3) {
    body = `
      <div class="chips-grid">
        ${SUBSYSTEMS.filter(s => s !== 'Autre').map(s => `
          <button class="chip-btn ${wiz.subsystem === s ? 'selected' : ''}" data-sub="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
      <form id="wiz-custom" class="part-form" style="margin-top:14px">
        <input name="custom" placeholder="Ou tape autre chose…">
        <button class="btn btn-primary">OK</button>
      </form>
      <div class="wiz-skip"><button class="link" id="wiz-skip">Passer cette étape →</button></div>`;

  } else if (wiz.step === 4) {
    body = `
      <form id="wiz-form" class="card" style="display:grid;gap:12px">
        <label>Date de l’intervention
          <input type="date" name="date" value="${esc(wiz.date)}" required>
        </label>
        <label>Kilométrage du véhicule
          <input type="number" name="km" inputmode="numeric" step="1" min="0" value="${esc(wiz.km)}">
        </label>
        <label>Description (que faut-il faire ?)
          <textarea name="description" rows="4" placeholder="ex : Vidange moteur + remplacement du filtre à huile">${esc(wiz.description)}</textarea>
        </label>
        <button class="btn btn-primary">Continuer →</button>
      </form>
      <p class="muted" style="text-align:center">💡 Une date dans le futur = activité planifiée, visible dans le Planning.</p>`;

  } else {
    const rows = [
      ['Véhicule',      esc(wiz.vehicle.name)],
      ['Type',          `<span class="badge type-${wiz.type}">${esc(label(OT_TYPES, wiz.type))}</span>`],
      ['Sous-ensemble', wiz.subsystem ? esc(wiz.subsystem) : '<span class="muted">—</span>'],
      ['Date',          esc(fmtDate(wiz.date))],
      ['Kilométrage',   wiz.km !== '' ? esc(fmtKm(Number(wiz.km))) : '<span class="muted">—</span>'],
      ['Description',   wiz.description ? esc(wiz.description) : '<span class="muted">—</span>'],
    ];
    body = `
      <div class="card recap-list">
        ${rows.map(([lbl, val]) => `
          <div class="rec-row">
            <span class="rec-lbl">${lbl}</span>
            <span class="grow" style="white-space:pre-wrap">${val}</span>
          </div>`).join('')}
      </div>
      <button class="btn btn-primary" id="wiz-create">Continuer → ajouter les pièces</button>
      <p class="muted" style="text-align:center">Dernière étape ensuite : les pièces et les photos.</p>`;
  }

  // ── Squelette commun : barre de progression + titre ───────────
  root.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" id="wiz-back" title="Retour">←</button>
      <h1 class="grow">➕ Créer une activité</h1>
      <button class="icon-btn" id="wiz-cancel" title="Annuler">✕</button>
    </header>
    <main class="page with-nav">
      <div class="wiz-progress">
        <div class="bar"><span style="width:${(wiz.step / TOTAL) * 100}%"></span></div>
        <span class="muted">${wiz.step}/${TOTAL}</span>
      </div>
      <h2 class="wiz-step-title">${esc(TITLES[wiz.step])}</h2>
      ${body}
    </main>
    ${bottomNav('create')}`;

  // ── Navigation retour / annuler ────────────────────────────────
  $('#wiz-back').onclick = () => {
    if (wiz.step > 1) { wiz.step--; rerender(); }
    else { wiz = null; location.hash = '#/'; }
  };
  $('#wiz-cancel').onclick = () => { wiz = null; location.hash = '#/'; };

  // ── Actions propres à chaque étape ─────────────────────────────
  if (wiz.step === 1) {
    $$('[data-vehicle]').forEach(btn => {
      btn.onclick = () => {
        wiz.vehicle = vehicles.find(v => v.id === btn.dataset.vehicle);
        wiz.km = wiz.vehicle.km ?? '';   // préremplit le kilométrage
        wiz.step = 2;
        rerender();
      };
    });

  } else if (wiz.step === 2) {
    $$('[data-type]').forEach(btn => {
      btn.onclick = () => { wiz.type = btn.dataset.type; wiz.step = 3; rerender(); };
    });

  } else if (wiz.step === 3) {
    $$('[data-sub]').forEach(btn => {
      btn.onclick = () => { wiz.subsystem = btn.dataset.sub; wiz.step = 4; rerender(); };
    });
    $('#wiz-custom').onsubmit = e => {
      e.preventDefault();
      const v = String(new FormData(e.target).get('custom')).trim();
      if (!v) return;
      wiz.subsystem = v;
      wiz.step = 4;
      rerender();
    };
    $('#wiz-skip').onclick = () => { wiz.subsystem = null; wiz.step = 4; rerender(); };

  } else if (wiz.step === 4) {
    // On mémorise au fil de la frappe : rien ne se perd si l'écran
    // est redessiné par la synchro temps réel.
    $('#wiz-form').oninput = e => { wiz[e.target.name] = e.target.value; };
    $('#wiz-form').onsubmit = e => {
      e.preventDefault();
      wiz.step = 5;
      rerender();
    };

  } else {
    $('#wiz-create').onclick = safe(async () => {
      const ot = await db.saveWorkOrder({
        vehicle_id:  wiz.vehicle.id,
        type:        wiz.type,
        subsystem:   wiz.subsystem,
        date:        wiz.date,
        km:          wiz.km === '' ? null : Number(wiz.km),
        description: wiz.description.trim() || null,
        status:      'ouvert',
      });
      wiz = null;
      toast('Ajoute les pièces, puis valide 🔧');
      location.hash = `#/ot/${ot.id}/new`;
    });
  }
}
