// ── Petits utilitaires d'interface ──────────────────────────────

import { WARN_KM, WARN_DAYS } from './config.js';
import { vehicleIcon } from './constants.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Échappe le texte saisi par l'utilisateur avant insertion dans le HTML
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const fmtMoney = n =>
  Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
export const fmtKm = n =>
  n == null ? '—' : Number(n).toLocaleString('fr-FR') + ' km';
export const fmtDate = d =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Enrobe un gestionnaire d'événement : toute erreur devient un toast
// au lieu de planter silencieusement.
export const safe = fn => async (...args) => {
  try { await fn(...args); }
  catch (e) { console.error(e); toast(e.message, 'error'); }
};

// ── Avatar d'un véhicule ────────────────────────────────────────
// Sa photo si elle existe (urls : chemin → lien signé), sinon le
// symbole correspondant à son type (🚗, 🏍️, 🛥️…).
export function vehicleAvatar(v, urls = {}) {
  const url = v.photo_path && urls[v.photo_path];
  return url
    ? `<img class="v-thumb" src="${esc(url)}" alt="" loading="lazy">`
    : `<span class="v-thumb ico">${vehicleIcon(v.type)}</span>`;
}

// ── Toasts (messages furtifs en haut de l'écran) ────────────────
export function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── Code couleur des échéances ──────────────────────────────────
// 'late' (rouge) : km ou date dépassés
// 'soon' (orange) : à moins de WARN_KM km ou WARN_DAYS jours
// 'ok' (vert) : sinon
export function dueStatus(d, vehicleKm) {
  let late = false, soon = false;
  if (d.due_km != null) {
    const delta = d.due_km - vehicleKm;
    if (delta <= 0) late = true;
    else if (delta <= WARN_KM) soon = true;
  }
  if (d.due_date) {
    const days = Math.ceil((new Date(d.due_date + 'T00:00:00') - Date.now()) / 86400000);
    if (days <= 0) late = true;
    else if (days <= WARN_DAYS) soon = true;
  }
  return late ? 'late' : soon ? 'soon' : 'ok';
}

// Texte du type "À 50 000 km (dans 1 200 km) · Le 12/07/2026 (dans 30 j)"
export function dueText(d, vehicleKm) {
  const parts = [];
  if (d.due_km != null) {
    const delta = d.due_km - vehicleKm;
    parts.push(`À ${fmtKm(d.due_km)} ${delta <= 0
      ? `(dépassé de ${fmtKm(-delta)})`
      : `(dans ${fmtKm(delta)})`}`);
  }
  if (d.due_date) {
    const days = Math.ceil((new Date(d.due_date + 'T00:00:00') - Date.now()) / 86400000);
    parts.push(`Le ${fmtDate(d.due_date)} ${days <= 0
      ? `(en retard de ${-days} j)`
      : `(dans ${days} j)`}`);
  }
  return parts.join(' · ') || 'Aucune échéance définie';
}

// ── Modales ─────────────────────────────────────────────────────
let modalOpenCount = 0;
export const isModalOpen = () => modalOpenCount > 0;

function openOverlay(innerHTML) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = innerHTML;
  document.body.appendChild(ov);
  modalOpenCount++;
  return ov;
}

function closeOverlay(ov) {
  modalOpenCount--;
  ov.remove();
  // Prévient l'appli qu'elle peut rafraîchir l'écran si une synchro
  // est arrivée pendant que la modale était ouverte.
  window.dispatchEvent(new CustomEvent('modal-closed'));
}

function fieldHTML(f, values) {
  const v = values[f.name] ?? f.default ?? '';
  const req = f.required ? 'required' : '';
  if (f.type === 'select') {
    return `<label>${esc(f.label)}<select name="${f.name}">${f.options.map(o =>
      `<option value="${esc(o.value)}" ${o.value === v ? 'selected' : ''}>${esc(o.label)}</option>`
    ).join('')}</select></label>`;
  }
  if (f.type === 'textarea') {
    return `<label>${esc(f.label)}<textarea name="${f.name}" rows="4" ${req}>${esc(v)}</textarea></label>`;
  }
  const extra = f.type === 'number' ? `inputmode="decimal" step="${f.step ?? 'any'}"` : '';
  const list = f.datalist ? `list="dl-${f.name}"` : '';
  const dl = f.datalist
    ? `<datalist id="dl-${f.name}">${f.datalist.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`
    : '';
  return `<label>${esc(f.label)}<input type="${f.type || 'text'}" name="${f.name}"
    value="${esc(v)}" ${req} ${extra} ${list} placeholder="${esc(f.placeholder || '')}">${dl}</label>`;
}

// Affiche un formulaire en modale. Renvoie :
//  - un objet { champ: valeur } si l'utilisateur valide
//  - la chaîne 'DANGER' s'il touche le bouton rouge (dangerLabel)
//  - null s'il annule
export function formModal({ title, fields, values = {}, submitLabel = 'Enregistrer', dangerLabel = null }) {
  return new Promise(resolve => {
    const ov = openOverlay(`
      <form class="modal">
        <h2>${esc(title)}</h2>
        <div class="modal-body">${fields.map(f => fieldHTML(f, values)).join('')}</div>
        <div class="modal-actions">
          <button type="button" class="btn" data-cancel>Annuler</button>
          <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
        </div>
        ${dangerLabel ? `<button type="button" class="btn-danger" data-danger>${esc(dangerLabel)}</button>` : ''}
      </form>`);

    const close = result => { closeOverlay(ov); resolve(result); };

    ov.addEventListener('click', e => { if (e.target === ov) close(null); });
    ov.querySelector('[data-cancel]').onclick = () => close(null);
    ov.querySelector('[data-danger]')?.addEventListener('click', () => close('DANGER'));

    ov.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const out = {};
      for (const f of fields) {
        const raw = fd.get(f.name);
        if (f.type === 'number') {
          out[f.name] = raw === '' || raw == null ? null : Number(raw);
        } else {
          out[f.name] = String(raw ?? '').trim() || null;
        }
      }
      close(out);
    });
  });
}

// Demande de confirmation (pour les suppressions). Renvoie true/false.
export function confirmModal(message) {
  return new Promise(resolve => {
    const ov = openOverlay(`
      <div class="modal">
        <h2>Confirmation</h2>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn" data-cancel>Annuler</button>
          <button type="button" class="btn btn-primary" data-ok>Confirmer</button>
        </div>
      </div>`);
    const close = result => { closeOverlay(ov); resolve(result); };
    ov.addEventListener('click', e => { if (e.target === ov) close(false); });
    ov.querySelector('[data-cancel]').onclick = () => close(false);
    ov.querySelector('[data-ok]').onclick = () => close(true);
  });
}

// Affiche une photo en plein écran
export function lightbox(url) {
  const ov = document.createElement('div');
  ov.className = 'lightbox';
  ov.innerHTML = `<img src="${esc(url)}" alt="">`;
  ov.onclick = () => ov.remove();
  document.body.appendChild(ov);
}
