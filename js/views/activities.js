// ── Page « Activités » : vue d'ensemble de TOUS les véhicules ────
//
// C'est l'écran d'accueil de l'application. De haut en bas :
//   1. un filtre par véhicule (pastilles) — UNE SEULE variable de
//      filtre pilote la frise, le tableau et les tuiles ;
//   2. une frise chronologique sur 6 mois (2 passés + 4 à venir),
//      une ligne par véhicule, une barre par activité ;
//   3. le tableau des 6 activités les plus proches ;
//   4. quatre tuiles chiffrées.
//
// RÈGLE « EN RETARD » (jamais stockée en base, toujours recalculée) :
//     en retard = (statut <> 'cloture') ET (date_fin < aujourd'hui)
// Les DEUX conditions. Sans date_fin, une activité n'est jamais en
// retard : elle est signalée « date manquante » et n'apparaît pas sur
// la frise, faute de pouvoir la positionner.

import * as db from '../db.js';
import { supabase } from '../db.js';
import {
  $, $$, esc, fmtMoney, fmtDate, todayISO, otLate, otSansDate, safe,
  lienActivite, ORIGINE_ACTIVITES,
} from '../ui.js';
import { bottomNav } from '../components/nav.js';

// Filtre courant : 'tous' ou l'identifiant d'un véhicule.
// Gardé hors de la fonction pour survivre aux redessins.
let filtre = 'tous';

const MOIS_AVANT = 2;   // mois passés affichés
const MOIS_TOTAL = 6;   // largeur totale de la frise, en mois

// ── Petits utilitaires de dates ─────────────────────────────────
const iso = d => d.toISOString().slice(0, 10);

// Nombre de jours entre deux dates au format "AAAA-MM-JJ".
// Négatif si `quand` est dans le passé par rapport à `today`.
function joursEntre(today, quand) {
  const ms = Date.UTC(+quand.slice(0, 4), +quand.slice(5, 7) - 1, +quand.slice(8, 10))
           - Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round(ms / 86400000);
}

// « retard 12 j » / « dans 18 j » / « aujourd'hui »
function ecartTexte(n) {
  if (n === 0) return 'aujourd’hui';
  return n < 0 ? `retard ${-n} j` : `dans ${n} j`;
}

// L'état d'une activité, qui donne sa couleur partout sur la page.
// L'ordre compte : date manquante, puis retard, puis statut.
function etatDe(ot, today) {
  if (otSansDate(ot)) return 'nodate';
  if (otLate(ot, today)) return 'late';
  return ot.statut;                      // en_cours | cloture | planifie
}

export async function renderActivities(root) {
  const [vehicles, ots, seList] = await Promise.all([
    db.listVehicles(),
    db.listActivitiesOverview(),
    db.listAllSousEnsembles(),
  ]);

  const today = todayISO();
  const seNoms = new Map(seList.map(se => [se.id, se.nom]));
  const vNoms  = new Map(vehicles.map(v => [v.id, v.name]));

  // Si le véhicule filtré a été supprimé, on revient sur "Tous"
  if (filtre !== 'tous' && !vNoms.has(filtre)) filtre = 'tous';

  // ── LE filtre, appliqué une seule fois pour toute la page ──────
  const visibles = filtre === 'tous' ? ots : ots.filter(o => o.vehicle_id === filtre);
  const vehiculesVisibles = filtre === 'tous' ? vehicles : vehicles.filter(v => v.id === filtre);

  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">🔧 Activités</h1>
      <button class="icon-btn" id="logout" title="Se déconnecter">⏻</button>
    </header>
    <main class="page with-nav">
      ${filtreHTML(vehicles)}
      ${friseHTML(vehiculesVisibles, visibles, today)}
      ${prochainesHTML(visibles, today, vNoms, seNoms)}
      ${tuilesHTML(visibles, today)}
    </main>
    ${bottomNav('home')}`;

  $('#logout').onclick = safe(() => supabase.auth.signOut());

  // Changer de filtre redessine toute la page
  $$('[data-filtre]', root).forEach(b => {
    b.onclick = () => { filtre = b.dataset.filtre; renderActivities(root); };
  });

  // Sur iPhone, la frise s'ouvre centrée sur aujourd'hui.
  // On mesure l'écart réel à l'écran plutôt que offsetLeft, qui
  // dépendrait de l'élément positionné le plus proche.
  const scroller = $('.frise-scroll', root);
  const trait = $('.frise-today', root);
  if (scroller && trait && scroller.scrollWidth > scroller.clientWidth) {
    const ecart = trait.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    scroller.scrollLeft += ecart - scroller.clientWidth / 2;
  }
}

// ════════════════════════════════════════════════════════════════
// 1) FILTRE VÉHICULE
// ════════════════════════════════════════════════════════════════
function filtreHTML(vehicles) {
  const pastille = (val, texte) => `
    <button class="filtre-chip ${filtre === val ? 'actif' : ''}" data-filtre="${esc(val)}">${esc(texte)}</button>`;
  return `
    <div class="filtre-row">
      ${pastille('tous', 'Tous')}
      ${vehicles.map(v => pastille(v.id, v.name)).join('')}
    </div>`;
}

// ════════════════════════════════════════════════════════════════
// 2) FRISE CHRONOLOGIQUE
// ════════════════════════════════════════════════════════════════

// Les 6 mois affichés, et les bornes de la période en jours.
function periode(today) {
  const [an, mo] = [+today.slice(0, 4), +today.slice(5, 7) - 1];
  const debut = new Date(Date.UTC(an, mo - MOIS_AVANT, 1));
  const fin   = new Date(Date.UTC(an, mo - MOIS_AVANT + MOIS_TOTAL, 0)); // dernier jour

  const mois = [];
  for (let i = 0; i < MOIS_TOTAL; i++) {
    const d = new Date(Date.UTC(an, mo - MOIS_AVANT + i, 1));
    mois.push(d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }));
  }
  const debutISO = iso(debut);
  return { debutISO, finISO: iso(fin), mois, total: joursEntre(debutISO, iso(fin)) + 1 };
}

// Répartit les activités d'un véhicule en « couloirs » : deux
// activités qui se chevauchent dans le temps ne peuvent pas tenir sur
// la même ligne, on en ouvre une seconde en dessous.
function couloirs(liste) {
  const rangs = [];
  for (const ot of liste) {
    let place = rangs.find(r => r.every(x => x.fin < ot.debut || x.debut > ot.fin));
    if (!place) { place = []; rangs.push(place); }
    place.push(ot);
  }
  return rangs;
}

function friseHTML(vehicles, ots, today) {
  const { debutISO, finISO, mois, total } = periode(today);
  const pct = d => (joursEntre(debutISO, d) / total) * 100;

  // Seules les activités POSITIONNABLES : il leur faut une date de fin.
  // Celles qui n'en ont pas restent visibles dans le tableau plus bas.
  const placables = ots
    .filter(o => o.date_fin)
    .map(o => ({
      id: o.id,
      titre: o.subsystem || 'Sans intitulé',
      vehicle_id: o.vehicle_id,
      debut: o.date_debut || o.date_fin,   // sans date de début : barre d'un jour
      fin: o.date_fin,
      etat: etatDe(o, today),
    }))
    // On ignore ce qui est entièrement hors de la fenêtre de 6 mois
    .filter(o => o.fin >= debutISO && o.debut <= finISO)
    .sort((a, b) => a.debut.localeCompare(b.debut));

  const lignes = vehicles.map(v => {
    const rangs = couloirs(placables.filter(o => o.vehicle_id === v.id));
    // Toujours au moins un couloir, pour que le véhicule reste visible
    const utiles = rangs.length ? rangs : [[]];
    return `
      <div class="frise-vehicule">
        <div class="frise-nom" title="${esc(v.name)}">${esc(v.name)}</div>
        <div class="frise-rangs">
          ${utiles.map(rang => `
            <div class="frise-rang">
              ${rang.map(o => {
                const g = Math.max(0, pct(o.debut));
                const d = Math.min(100, pct(o.fin) + (100 / total));  // fin incluse
                return `
                <a class="frise-barre fb-${esc(o.etat)}"
                   href="${esc(lienActivite(o.id, ORIGINE_ACTIVITES))}"
                   style="left:${g.toFixed(2)}%;width:${Math.max(d - g, 0).toFixed(2)}%"
                   title="${esc(o.titre)} — du ${esc(fmtDate(o.debut))} au ${esc(fmtDate(o.fin))}">
                  <span class="fb-txt">${esc(o.titre)}</span>
                </a>`;
              }).join('')}
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  const posToday = pct(today);

  return `
    <section class="frise card">
      <div class="frise-scroll">
        <div class="frise-inner">
          <div class="frise-entete">
            <div class="frise-nom-col"></div>
            <div class="frise-mois">
              ${mois.map(m => `<span>${esc(m)}</span>`).join('')}
            </div>
          </div>
          <div class="frise-corps">
            <!-- Calque posé uniquement sur la piste (après les 100px de
                 noms) : le trait d'aujourd'hui s'y place en % et
                 traverse toutes les lignes de haut en bas. -->
            <div class="frise-calque">
              <div class="frise-today" style="left:${posToday.toFixed(2)}%" title="aujourd’hui"></div>
            </div>
            ${vehicles.length
              ? lignes
              : '<p class="empty" style="padding:20px">Aucun véhicule.</p>'}
          </div>
        </div>
      </div>
      <div class="frise-legende">
        <span><i class="lg lg-late"></i>en retard</span>
        <span><i class="lg lg-en_cours"></i>en cours</span>
        <span><i class="lg lg-cloture"></i>clôturée</span>
        <span><i class="lg lg-planifie"></i>planifiée</span>
      </div>
    </section>`;
}

// ════════════════════════════════════════════════════════════════
// 3) LES 6 ACTIVITÉS LES PLUS PROCHES
// ════════════════════════════════════════════════════════════════
function prochainesHTML(ots, today, vNoms, seNoms) {
  const ouvertes = ots.filter(o => o.statut !== 'cloture');

  // Tri par écart en jours, du plus petit au plus grand. Les retards
  // sont NÉGATIFS : ils remontent donc tout seuls en haut. Ne pas
  // inverser ce tri. Les activités sans date de fin n'ont pas d'écart
  // calculable : elles ferment la marche.
  const datees = ouvertes
    .filter(o => o.date_fin)
    .map(o => ({ ot: o, ecart: joursEntre(today, o.date_fin) }))
    .sort((a, b) => a.ecart - b.ecart);
  const sansDate = ouvertes.filter(o => !o.date_fin).map(o => ({ ot: o, ecart: null }));

  const liste = [...datees, ...sansDate].slice(0, 6);

  if (!liste.length) {
    return `
      <section class="card proch">
        <h2 class="proch-h">Les plus proches</h2>
        <p class="empty">Aucune activité en cours.</p>
      </section>`;
  }

  const ligne = ({ ot, ecart }) => {
    const etat = etatDe(ot, today);
    const se = ot.sous_ensemble_id ? seNoms.get(ot.sous_ensemble_id) : null;
    return `
      <a class="proch-row pr-${esc(etat)}" href="${esc(lienActivite(ot.id, ORIGINE_ACTIVITES))}">
        <span class="proch-txt">
          <span class="proch-titre">${esc(ot.subsystem || 'Sans intitulé')}</span>
          <span class="proch-meta">${esc(vNoms.get(ot.vehicle_id) || '?')}${se ? ' · ' + esc(se) : ''}</span>
        </span>
        <span class="proch-ecart ${ecart === null ? 'pe-nodate' : ecart < 0 ? 'pe-late' : ''}">
          ${ecart === null ? 'date manquante' : esc(ecartTexte(ecart))}
        </span>
      </a>`;
  };

  return `
    <section class="card proch">
      <h2 class="proch-h">Les plus proches</h2>
      <div class="proch-list">${liste.map(ligne).join('')}</div>
      <div class="proch-pied"><a class="link" href="#/planning">voir tout →</a></div>
    </section>`;
}

// ════════════════════════════════════════════════════════════════
// 4) LES QUATRE TUILES CHIFFRÉES
// ════════════════════════════════════════════════════════════════
function tuilesHTML(ots, today) {
  const ouvertes = ots.filter(o => o.statut !== 'cloture').length;
  const retards  = ots.filter(o => otLate(o, today)).length;

  // Clôturées ces 30 derniers jours : on se fie à la date de fin,
  // faute d'enregistrer la date exacte de clôture.
  const cloturees = ots.filter(o =>
    o.statut === 'cloture' && o.date_fin
    && joursEntre(today, o.date_fin) <= 0
    && joursEntre(today, o.date_fin) >= -30).length;

  // Coût du mois : les pièces des activités dont la date de fin
  // tombe dans le mois en cours.
  const moisCourant = today.slice(0, 7);
  const cout = ots
    .filter(o => (o.date_fin || '').startsWith(moisCourant))
    .reduce((s, o) => s + (o.work_order_parts || [])
      .reduce((t, p) => t + Number(p.price || 0) * Number(p.qty || 0), 0), 0);

  const tuile = (val, lbl, cls = '') => `
    <div class="tuile ${cls}">
      <span class="tuile-num">${esc(String(val))}</span>
      <span class="tuile-lbl">${esc(lbl)}</span>
    </div>`;

  return `
    <section class="tuiles">
      ${tuile(ouvertes, 'ouvertes')}
      ${tuile(retards, 'en retard', retards ? 'tuile-alerte' : '')}
      ${tuile(cloturees, 'clôturées (30 j)')}
      ${tuile(fmtMoney(cout), 'coût du mois')}
    </section>`;
}
