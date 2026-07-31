// ── Fiche véhicule : en-tête photo + 5 onglets (GMAO) ───────────
//
//  - "Création d'activité" : formulaire 2 colonnes sur ordinateur,
//    assistant guidé étape par étape sur iPhone (< 1100px).
//  - "Fiche technique" : sous-ensembles + données techniques.
//  - "Historique" : toutes les activités du véhicule (récentes d'abord).
//  - "Échéances" : entretiens programmés ; l'activité est créée
//    automatiquement un mois avant (autoGenerate, app.js).
//  - "Stock de pièces" : pièces gardées d'avance pour ce véhicule.
//
// Chaque onglet ajoute son propre bouton "+" dans le contenu : la page
// véhicule n'a pas de bouton flottant.

import * as db from '../db.js';
import {
  VEHICLE_STATUS, OT_TYPES, OT_STATUS, label, vehicleIcon,
  vehicleFields, deadlineFields, stockFields, specFields, verifierPeriode,
} from '../constants.js';
import {
  $, $$, esc, fmtMoney, fmtKm, fmtDate, todayISO, otLate, otSansDate,
  formModal, confirmModal, toast, safe, dueStatus, dueText, lightbox,
  lienActivite, origineVehicule,
} from '../ui.js';

// Les onglets de la page véhicule
const TABS = [
  ['act',    'Activités'],
  ['fiche',  'Fiche technique'],
  ['histo',  'Historique'],
  ['ech',    'Échéances'],
  ['stock',  'Stock de pièces'],
];

const TYPE_ICONS = { preventif: '🛡️', correctif: '🔧', amelioratif: '⚡' };

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
  // Le bouton "＋ Créer" de la barre du bas pointe sur ".../create" :
  // on ouvre l'onglet Activités avec le formulaire déjà déplié.
  let openForm = false;
  if (tab === 'create') { tab = 'act'; openForm = true; }

  // Onglet par défaut = Fiche technique ; tout onglet inconnu (vieux
  // lien /ot, /due… ou favori de l'iPhone) est ramené sur un onglet valide.
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
  else if (tab === 'act') await actTab(content, v, rerender, openForm);
  else if (tab === 'histo') await histoTab(content, v);
  else if (tab === 'ech') await echeancesTab(content, v, rerender);
  else if (tab === 'stock') await stockTab(content, v, rerender);
}

// ════════════════════════════════════════════════════════════════
// ONGLET « FICHE TECHNIQUE » — sous-ensembles + données techniques
// ════════════════════════════════════════════════════════════════
async function ficheTechniqueTab(content, v, rerender) {
  const list = await db.listSousEnsembles(v.id);
  // On n'affiche que les sous-ensembles ayant au moins une donnée.
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

  const seOptions = list.map(se => ({ value: se.id, label: se.nom }));
  const donneeFields = [
    { name: 'sous_ensemble_id', label: 'Sous-ensemble', type: 'select', options: seOptions },
    { name: 'libelle', label: 'Libellé', required: true, placeholder: 'ex : Huile, Couple bouchon vidange' },
    { name: 'valeur',  label: 'Valeur', placeholder: 'ex : 10W40 semi-synthèse, 20 N·m' },
  ];

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
// ONGLET « CRÉATION D'ACTIVITÉ »
// ════════════════════════════════════════════════════════════════

// État du formulaire, gardé hors de la fonction : si l'écran est
// redessiné (synchro temps réel), la saisie en cours n'est pas perdue.
let draft = null;
let draftVid = null;
let step = 1;

function freshDraft() {
  return {
    type: 'correctif',
    sous_ensemble_id: '',
    organe_id: '',
    intitule: '',
    description: '',
    date_debut: todayISO(),
    date_fin: todayISO(),
  };
}

// Panneau "fiche technique" en lecture seule (colonne de droite sur
// ordinateur, panneau repliable sur mobile). Filtré sur un sous-ensemble
// si "filterId" est fourni, sinon tout.
function fichePanelHTML(seList, filterId) {
  const list = filterId ? seList.filter(se => se.id === filterId) : seList;
  const withData = list.filter(se => se.donnees_techniques.length > 0);
  if (!withData.length) return '<p class="empty">Aucune donnée technique.</p>';
  return withData.map(se => `
    <section class="se-block">
      <h3 class="se-name">${esc(se.nom)}</h3>
      <div class="se-data">
        ${se.donnees_techniques.map(d => `
          <div class="dt-row" style="cursor:default">
            <span class="dt-lbl">${esc(d.libelle)}</span>
            <span class="dt-val">${esc(d.valeur ?? '')}</span>
          </div>`).join('')}
      </div>
    </section>`).join('');
}

// Les champs du formulaire (version ordinateur, tout visible)
function fieldsHTML(seList) {
  const se = seList.find(s => s.id === draft.sous_ensemble_id);
  const orgList = se ? se.organes : [];
  return `
    <label>Type
      <select name="type">
        ${OT_TYPES.map(t => `<option value="${t.value}" ${draft.type === t.value ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
      </select>
    </label>
    <label>Sous-ensemble
      <select name="sous_ensemble_id">
        <option value="">— choisir —</option>
        ${seList.map(s => `<option value="${s.id}" ${draft.sous_ensemble_id === s.id ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}
      </select>
    </label>
    <label>Organe (facultatif)
      <select name="organe_id" ${se ? '' : 'disabled'}>
        <option value="">${se ? '— aucun —' : '— choisis d’abord un sous-ensemble —'}</option>
        ${orgList.map(o => `<option value="${o.id}" ${draft.organe_id === o.id ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}
      </select>
    </label>
    <label>Intitulé
      <input type="text" name="intitule" value="${esc(draft.intitule)}" required placeholder="ex : Vidange moteur">
    </label>
    <label>Description (facultatif)
      <textarea name="description" rows="3" placeholder="Détails, pièces à prévoir…">${esc(draft.description)}</textarea>
    </label>
    <div class="create-dates">
      <label>Date de début
        <input type="date" name="date_debut" value="${esc(draft.date_debut)}" required>
      </label>
      <label>Date de fin
        <input type="date" name="date_fin" value="${esc(draft.date_fin)}" min="${esc(draft.date_debut)}" required>
      </label>
    </div>
    <div class="create-statut muted">Statut à la création : <span class="v-hero-status">Planifié</span></div>`;
}

// Boutons de navigation du mode guidé (mobile)
function navBtns(withBack) {
  return `<div class="wiz-nav">
    ${withBack ? '<button type="button" class="btn" id="w-back">← Retour</button>' : ''}
    <button type="button" class="btn btn-gmao" id="w-next">Continuer →</button>
  </div>`;
}

// Ouvre le formulaire de création dans un panneau par-dessus la page.
// Sur ordinateur : panneau large, formulaire à gauche et fiche technique
// à droite. Sur iPhone : feuille plein écran avec l'assistant guidé.
// `onSaved` est appelé une fois l'activité enregistrée.
function openCreatePanel(v, onSaved) {
  const overlay = document.createElement('div');
  overlay.className = 'cp-overlay';
  overlay.innerHTML = `
    <section class="cp-panel">
      <header class="cp-head">
        <h2 class="cp-title">Nouvelle activité</h2>
        <button class="icon-btn" id="cp-close" title="Fermer">✕</button>
      </header>
      <div class="cp-body" id="cp-body"><p class="muted">Chargement…</p></div>
    </section>`;
  document.body.appendChild(overlay);

  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  document.addEventListener('keydown', onKey);
  $('#cp-close', overlay).onclick = close;
  // Clic sur le fond (à côté du panneau) = fermer
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  createForm($('#cp-body', overlay), v, () => { close(); onSaved(); })
    .catch(e => {
      $('#cp-body', overlay).innerHTML =
        `<p class="empty">Impossible d’ouvrir le formulaire.<br>${esc(e.message)}</p>`;
    });
}

async function createForm(host, v, onSaved) {
  const seList = await db.listSousEnsembles(v.id);
  if (!draft || draftVid !== v.id) { draft = freshDraft(); draftVid = v.id; step = 1; }
  const content = host;

  const desktop = window.matchMedia('(min-width: 1100px)').matches;

  // Recopie la saisie dans "draft" à chaque frappe (rien n'est perdu si
  // l'écran est redessiné) et garde date_fin >= date_debut.
  const bindInputs = form => {
    form.addEventListener('input', e => {
      if (!e.target.name) return;
      draft[e.target.name] = e.target.value;
      if (e.target.name === 'date_debut') {
        const df = form.querySelector('[name="date_fin"]');
        if (df) {
          df.min = draft.date_debut;
          if (draft.date_fin < draft.date_debut) { draft.date_fin = draft.date_debut; df.value = draft.date_debut; }
        }
      }
    });
  };

  // Même contrôle que dans le formulaire de modification : un seul
  // endroit décrit ce qu'est une période valable.
  const validateDates = () => {
    const erreur = verifierPeriode(draft);
    if (erreur) { toast(erreur, 'error'); return false; }
    return true;
  };

  const save = safe(async () => {
    if (!draft.intitule.trim()) { toast('L’intitulé est obligatoire', 'error'); return; }
    if (!validateDates()) return;
    await db.saveWorkOrder({
      vehicle_id:       v.id,
      type:             draft.type,
      sous_ensemble_id: draft.sous_ensemble_id || null,
      organe_id:        draft.organe_id || null,
      subsystem:        draft.intitule.trim(),        // intitulé (affiché en gras)
      description:      draft.description.trim() || null,
      date:             draft.date_debut,             // ancienne colonne, gardée comme filet de sécurité
      date_debut:       draft.date_debut,
      date_fin:         draft.date_fin,
      statut:           'planifie',                   // forcé à la création
    });
    draft = null; draftVid = null; step = 1;
    toast('Activité créée ✅');
    onSaved();     // ferme le panneau et rafraîchit la liste des activités
  });

  // ── Affichage ordinateur : 2 colonnes (formulaire | fiche) ──────
  function drawDesktop() {
    content.innerHTML = `
      <div class="create-layout">
        <form class="create-form card" id="c-form">
          ${fieldsHTML(seList)}
          <button type="submit" class="btn btn-gmao">✓ Créer l’activité</button>
        </form>
        <aside class="create-fiche">
          <h3 class="se-name">📋 Fiche technique</h3>
          ${fichePanelHTML(seList, draft.sous_ensemble_id)}
        </aside>
      </div>`;
    const form = $('#c-form', content);
    bindInputs(form);
    form.addEventListener('change', e => {
      if (e.target.name === 'sous_ensemble_id') {
        draft.sous_ensemble_id = e.target.value;
        draft.organe_id = '';
        drawDesktop();   // met à jour la liste d'organes + le panneau fiche
      }
    });
    form.addEventListener('submit', e => { e.preventDefault(); save(); });
  }

  // ── Affichage iPhone : assistant guidé, une étape à la fois ─────
  function drawMobile() {
    const TOTAL = 6;
    const se = seList.find(s => s.id === draft.sous_ensemble_id);
    let title = '', body = '', nav = '';

    if (step === 1) {
      title = 'Type d’intervention';
      body = `<div class="wiz-options">
        ${OT_TYPES.map(t => `
          <button type="button" class="option-card ${draft.type === t.value ? 'selected' : ''}" data-type="${t.value}">
            <span class="opt-ico">${TYPE_ICONS[t.value]}</span>
            <span class="opt-txt"><span class="opt-title">${esc(t.label)}</span></span>
          </button>`).join('')}
      </div>`;
      nav = '';   // choisir un type fait avancer tout seul
    } else if (step === 2) {
      title = 'Sous-ensemble';
      body = `
        <div class="chips-grid">
          ${seList.map(s => `<button type="button" class="chip-btn ${draft.sous_ensemble_id === s.id ? 'selected' : ''}" data-se="${s.id}">${esc(s.nom)}</button>`).join('')}
        </div>
        <details class="create-see-fiche">
          <summary>📋 voir la fiche technique</summary>
          <div class="see-fiche-body">${fichePanelHTML(seList, draft.sous_ensemble_id)}</div>
        </details>`;
      nav = navBtns(true);
    } else if (step === 3) {
      title = 'Organe (facultatif)';
      const orgList = se ? se.organes : [];
      body = se && orgList.length
        ? `<div class="chips-grid">
             <button type="button" class="chip-btn ${!draft.organe_id ? 'selected' : ''}" data-org="">— aucun —</button>
             ${orgList.map(o => `<button type="button" class="chip-btn ${draft.organe_id === o.id ? 'selected' : ''}" data-org="${o.id}">${esc(o.nom)}</button>`).join('')}
           </div>`
        : `<p class="muted">${se ? 'Aucun organe pour ce sous-ensemble.' : 'Aucun sous-ensemble choisi.'}<br>Cette étape est facultative, touche « Continuer ».</p>`;
      nav = navBtns(true);
    } else if (step === 4) {
      title = 'Intitulé et description';
      body = `
        <form id="c-form" class="card" style="display:grid;gap:12px">
          <label>Intitulé
            <input type="text" name="intitule" value="${esc(draft.intitule)}" required placeholder="ex : Vidange moteur">
          </label>
          <label>Description (facultatif)
            <textarea name="description" rows="4" placeholder="Détails, pièces à prévoir…">${esc(draft.description)}</textarea>
          </label>
        </form>`;
      nav = navBtns(true);
    } else if (step === 5) {
      title = 'Dates';
      body = `
        <form id="c-form" class="card" style="display:grid;gap:12px">
          <label>Date de début
            <input type="date" name="date_debut" value="${esc(draft.date_debut)}" required>
          </label>
          <label>Date de fin
            <input type="date" name="date_fin" value="${esc(draft.date_fin)}" min="${esc(draft.date_debut)}" required>
          </label>
        </form>`;
      nav = navBtns(true);
    } else {
      title = 'Récapitulatif';
      const org = se && draft.organe_id ? se.organes.find(o => o.id === draft.organe_id) : null;
      const rows = [
        ['Type',          label(OT_TYPES, draft.type)],
        ['Sous-ensemble', se ? se.nom : '—'],
        ['Organe',        org ? org.nom : '—'],
        ['Intitulé',      draft.intitule || '—'],
        ['Description',   draft.description || '—'],
        ['Début',         fmtDate(draft.date_debut)],
        ['Fin',           fmtDate(draft.date_fin)],
        ['Statut',        'Planifié'],
      ];
      body = `<div class="card recap-list">
        ${rows.map(([l, val]) => `<div class="rec-row"><span class="rec-lbl">${l}</span><span class="grow" style="white-space:pre-wrap">${esc(val)}</span></div>`).join('')}
      </div>`;
      nav = `<div class="wiz-nav">
        <button type="button" class="btn" id="w-back">← Retour</button>
        <button type="button" class="btn btn-gmao" id="w-save">✓ Créer l’activité</button>
      </div>`;
    }

    content.innerHTML = `
      <div class="wiz-progress">
        <div class="bar"><span style="width:${step / TOTAL * 100}%"></span></div>
        <span class="muted">${step}/${TOTAL}</span>
      </div>
      <h2 class="wiz-step-title">${esc(title)}</h2>
      ${body}
      ${nav}`;

    const advance = () => {
      if (step === 4 && !draft.intitule.trim()) { toast('L’intitulé est obligatoire', 'error'); return; }
      if (step === 5 && !validateDates()) return;
      step++; drawMobile();
    };

    const back = $('#w-back', content);
    if (back) back.onclick = () => { if (step > 1) { step--; drawMobile(); } };
    const nextBtn = $('#w-next', content);
    if (nextBtn) nextBtn.onclick = advance;
    const saveBtn = $('#w-save', content);
    if (saveBtn) saveBtn.onclick = save;

    if (step === 1) {
      $$('[data-type]', content).forEach(b => b.onclick = () => { draft.type = b.dataset.type; step = 2; drawMobile(); });
    } else if (step === 2) {
      $$('[data-se]', content).forEach(b => b.onclick = () => {
        draft.sous_ensemble_id = (draft.sous_ensemble_id === b.dataset.se) ? '' : b.dataset.se;
        draft.organe_id = '';
        drawMobile();   // met à jour la sélection + le panneau repliable
      });
    } else if (step === 3) {
      $$('[data-org]', content).forEach(b => b.onclick = () => { draft.organe_id = b.dataset.org; drawMobile(); });
    } else if (step === 4 || step === 5) {
      bindInputs($('#c-form', content));
    }
  }

  if (desktop) drawDesktop();
  else drawMobile();
}

// Carte d'une activité terminée, telle qu'affichée dans l'Historique
// (bordure gauche verte).
function otCard(ot) {
  const cost = (ot.work_order_parts || [])
    .reduce((s, p) => s + Number(p.price) * Number(p.qty), 0);
  // Depuis l'Historique, on revient sur l'Historique
  const lien = lienActivite(ot.id, origineVehicule(ot.vehicle_id, 'histo'));
  return `
    <a class="card histo-card" href="${esc(lien)}">
      <div class="row">
        <span class="badge type-${ot.type}">${esc(label(OT_TYPES, ot.type))}</span>
        <span class="chip st-${ot.statut}">${esc(label(OT_STATUS, ot.statut))}</span>
        <span class="grow"></span>
        <span class="muted">${echeance(ot) ? esc(fmtDate(echeance(ot))) : 'date manquante'}</span>
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

// L'ÉCHÉANCE d'une activité = sa date de fin, et rien d'autre.
// Plus aucun repli sur l'ancienne colonne `date` : si date_fin est
// vide, l'activité est signalée comme « date manquante ».
const echeance = ot => ot.date_fin || '';

// ════════════════════════════════════════════════════════════════
// ONGLET « ACTIVITÉS » — uniquement ce qui n'est PAS clôturé
//
// Répartition stricte avec l'onglet Historique : une activité est
// soit ici (planifie / en_cours), soit là-bas (cloture). Jamais les
// deux, jamais aucune.
//
// RÈGLE « EN RETARD » : jamais stockée en base, toujours recalculée
// à l'affichage — voir otLate() dans ui.js :
//     en retard = (statut <> 'cloture') ET (date de fin < aujourd'hui)
// Les deux conditions sont obligatoires.
// ════════════════════════════════════════════════════════════════

// Une ligne de la liste : intitulé, sous-ensemble, type, date de fin.
// La bordure gauche donne l'état d'un coup d'œil.
function actRow(ot, seNames, today) {
  const sansDate = otSansDate(ot);
  const late = otLate(ot, today);
  // Ordre de priorité : pas de date de fin > en retard > statut.
  // Une activité sans date de fin n'est JAMAIS "en retard" : la règle
  // ne peut pas s'appliquer, il n'y a rien à comparer.
  const etat = sansDate ? 'nodate' : late ? 'late' : ot.statut;
  const se = ot.sous_ensemble_id ? seNames.get(ot.sous_ensemble_id) : null;
  // On repart sur l'onglet Activités du même véhicule
  const lien = lienActivite(ot.id, origineVehicule(ot.vehicle_id, 'act'));
  return `
    <a class="card act-row act-${esc(etat)}" href="${esc(lien)}">
      <div class="act-l1">
        <span class="act-intitule">${esc(ot.subsystem || 'Sans intitulé')}</span>
        ${sansDate ? '<span class="act-sansdate">Date manquante</span>'
          : late ? '<span class="act-retard">En retard</span>' : ''}
      </div>
      <div class="act-l2">
        <span class="badge type-${ot.type}">${esc(label(OT_TYPES, ot.type))}</span>
        <span class="act-se">${se ? esc(se) : '—'}</span>
        <span class="grow"></span>
        <span class="act-fin">${sansDate ? '—' : esc(fmtDate(echeance(ot)))}</span>
      </div>
    </a>`;
}

async function actTab(content, v, rerender, openForm) {
  const [ots, seList] = await Promise.all([
    db.listWorkOrders(v.id),
    db.listSousEnsembles(v.id),
  ]);
  const seNames = new Map(seList.map(se => [se.id, se.nom]));
  const today = todayISO();

  // Tout SAUF les activités clôturées (celles-ci sont dans l'Historique)
  const items = ots.filter(o => o.statut !== 'cloture');

  // Ordre : les activités en retard d'abord, puis les autres par date
  // de fin croissante, et enfin celles sans date de fin (rien pour les
  // situer dans le temps, elles ferment donc la marche).
  const rang = ot => otSansDate(ot) ? 2 : otLate(ot, today) ? 0 : 1;
  items.sort((a, b) => {
    const ra = rang(a), rb = rang(b);
    if (ra !== rb) return ra - rb;
    return echeance(a).localeCompare(echeance(b));
  });

  content.innerHTML = `
    <div class="act-head">
      <h3 class="act-h">Activités en cours</h3>
      <button class="act-add" id="act-add" title="Nouvelle activité">+</button>
    </div>
    ${items.length
      ? `<div class="act-list">${items.map(o => actRow(o, seNames, today)).join('')}</div>`
      : `<p class="empty">Aucune activité en cours.<br>
         Touche le bouton + pour en créer une.</p>`}`;

  // rerender() redessine l'onglet : la nouvelle activité apparaît aussitôt
  $('#act-add', content).onclick = () => openCreatePanel(v, rerender);
  if (openForm) openCreatePanel(v, rerender);
}

// ════════════════════════════════════════════════════════════════
// ONGLET « HISTORIQUE » — uniquement les activités clôturées
// ════════════════════════════════════════════════════════════════
async function histoTab(content, v) {
  const ots = (await db.listWorkOrders(v.id)).filter(o => o.statut === 'cloture');

  // La plus récemment terminée en haut
  ots.sort((a, b) => (echeance(b) || '').localeCompare(echeance(a) || ''));

  content.innerHTML = ots.length
    ? ots.map(otCard).join('')
    : `<p class="empty">Aucune activité terminée pour l’instant.<br>
       Les activités clôturées viendront se ranger ici.</p>`;
}

// ════════════════════════════════════════════════════════════════
// ONGLET « ÉCHÉANCES » — entretiens programmés (date ou kilométrage)
// L'activité correspondante est créée automatiquement 1 mois avant
// l'échéance (voir autoGenerate dans app.js).
// ════════════════════════════════════════════════════════════════
async function echeancesTab(content, v, rerender) {
  const items = await db.listDeadlines(v.id);

  // Les plus urgentes en haut : en retard, puis bientôt, puis le reste
  const order = { late: 0, soon: 1, ok: 2 };
  items.sort((a, b) => order[dueStatus(a, v.km)] - order[dueStatus(b, v.km)]);

  content.innerHTML = `
    <p class="ech-intro">🤖 Programme ici les entretiens qui reviennent :
    l’activité se crée <strong>toute seule un mois avant</strong> l’échéance
    et apparaît dans le Planning.</p>
    ${items.length ? `
      <section class="se-block">
        <h3 class="se-name">📅 Échéances programmées</h3>
        <div class="se-data">
          ${items.map(d => `
            <button class="ech-row ech-${dueStatus(d, v.km)}" data-id="${d.id}">
              <span class="ech-dot"></span>
              <span class="ech-txt">
                <span class="ech-title">${esc(d.title)}</span>
                <span class="ech-when">${esc(dueText(d, v.km))}</span>
                ${d.notes ? `<span class="ech-note clamp">${esc(d.notes)}</span>` : ''}
                ${d.work_order_id ? '<span class="ech-auto">✓ Activité déjà créée — visible dans le Planning</span>' : ''}
              </span>
            </button>`).join('')}
        </div>
      </section>`
      : `<p class="empty">Aucune échéance programmée.<br>
         Touche « + programmer une échéance » (vidange, contrôle technique…).</p>`}
    <button class="btn btn-gmao" id="add-ech">+ programmer une échéance</button>`;

  $$('.ech-row', content).forEach(el => {
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
        // Nouvelle date → l'activité automatique devra être recréée
        if (res.due_date !== d.due_date) res.work_order_id = null;
        await db.saveDeadline(res, d.id);
        toast('Échéance enregistrée');
        rerender();
      }
    });
  });

  $('#add-ech').onclick = safe(async () => {
    const values = await formModal({ title: 'Programmer une échéance', fields: deadlineFields });
    if (!values) return;
    await db.saveDeadline({ ...values, vehicle_id: v.id });
    toast('Échéance programmée 🤖');
    rerender();
  });
}

// ════════════════════════════════════════════════════════════════
// ONGLET « STOCK DE PIÈCES » — pièces gardées d'avance pour ce véhicule
// ════════════════════════════════════════════════════════════════
async function stockTab(content, v, rerender) {
  const items = await db.listStock(v.id);
  const total = items.reduce((s, p) => s + Number(p.price || 0) * Number(p.qty || 0), 0);

  content.innerHTML = `
    ${items.length ? `
      <section class="se-block">
        <h3 class="se-name">🧰 En stock</h3>
        <div class="se-data">
          ${items.map(p => {
            const meta = [p.ref, p.price != null ? fmtMoney(p.price) : null]
              .filter(Boolean).map(esc).join(' · ');
            return `
            <div class="stk-row" data-id="${p.id}">
              <span class="stk-txt" data-edit>
                <span class="stk-name">${esc(p.name)}</span>
                ${meta ? `<span class="stk-meta">${meta}</span>` : ''}
              </span>
              <button class="qty-btn" data-delta="-1" title="Retirer un">−</button>
              <span class="stk-qty${Number(p.qty) === 0 ? ' zero' : ''}">${Number(p.qty)}</span>
              <button class="qty-btn" data-delta="1" title="Ajouter un">+</button>
            </div>`;
          }).join('')}
        </div>
        ${total ? `<div class="stk-total">Valeur du stock<span>${fmtMoney(total)}</span></div>` : ''}
      </section>`
      : `<p class="empty">Aucune pièce en stock pour ce véhicule.<br>
         Touche « + ajouter une pièce » pour garder d’avance un filtre, des plaquettes…</p>`}
    <button class="btn btn-gmao" id="add-stock">+ ajouter une pièce</button>`;

  $$('.stk-row', content).forEach(row => {
    const p = items.find(x => x.id === row.dataset.id);

    // Les deux boutons − / + ajustent la quantité sans ouvrir de fenêtre
    $$('.qty-btn', row).forEach(btn => {
      btn.onclick = safe(async () => {
        const qty = Math.max(0, Number(p.qty || 0) + Number(btn.dataset.delta));
        await db.saveStockPart({ qty }, p.id);
        rerender();
      });
    });

    // Toucher le nom de la pièce ouvre la fiche pour la modifier
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

  $('#add-stock').onclick = safe(async () => {
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

// ════════════════════════════════════════════════════════════════
// ANCIENNE FICHE TECHNIQUE (table vehicle_specs) — HORS INTERFACE
// Gardée volontairement : les fiches créées avant la refonte GMAO
// (huile, filtres, pneus, photos) sont toujours dans cette table.
// La nouvelle fiche technique utilise `donnees_techniques`.
// À trancher : reprendre ces données ou supprimer ce bloc.
// ════════════════════════════════════════════════════════════════
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
