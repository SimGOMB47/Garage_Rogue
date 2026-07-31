// ── Page « Calendrier » : une année civile entière ───────────────
//
// Format des calendriers muraux français : 12 colonnes côte à côte,
// janvier à décembre, chaque mois listant ses jours verticalement.
// Ce n'est PAS un calendrier mensuel en grille de 7 colonnes.
//
// C'est la seule page de l'application sur fond clair : une grille
// aussi dense se lit mieux ainsi. Choix assumé (voir .cal-page).
//
// RÈGLE « EN RETARD » (jamais stockée en base, toujours recalculée) :
//     en retard = (statut <> 'cloture') ET (date_fin < aujourd'hui)
// Les DEUX conditions.

import * as db from '../db.js';
import {
  $, $$, esc, todayISO, otLate, lienActivite, ORIGINE_CALENDRIER,
} from '../ui.js';
import { bottomNav } from '../components/nav.js';

// État de la page, gardé hors de la fonction pour survivre au retour
// depuis une fiche d'activité.
let annee = null;          // null = on prendra l'année en cours
let vehiculeSel = null;    // un SEUL véhicule à la fois

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Dimanche=D, lundi=L, mardi=M, mercredi=Me… « Me » sur deux lettres
// pour ne pas confondre mercredi et mardi.
const LETTRES = ['D', 'L', 'M', 'Me', 'J', 'V', 'S'];

// ── Numéro de semaine, norme ISO 8601 ───────────────────────────
// La semaine commence le LUNDI et la semaine 1 est celle qui contient
// le premier JEUDI de l'année. Méthode : on se déplace sur le jeudi de
// la semaine du jour donné, puis on compte les semaines depuis le jeudi
// de la semaine 1. C'est ce décalage sur le jeudi qui rend le calcul
// juste début janvier et fin décembre.
export function semaineISO(dateISO) {
  const d = new Date(Date.UTC(
    +dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10)));
  const jour = (d.getUTCDay() + 6) % 7;            // lundi=0 … dimanche=6
  d.setUTCDate(d.getUTCDate() - jour + 3);         // jeudi de cette semaine

  // Le 4 janvier appartient toujours à la semaine 1 : on prend le jeudi
  // de SA semaine comme point de départ.
  const jeudi1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const j = (jeudi1.getUTCDay() + 6) % 7;
  jeudi1.setUTCDate(jeudi1.getUTCDate() - j + 3);

  return 1 + Math.round((d - jeudi1) / (7 * 86400000));
}

// ── Petits utilitaires de dates ─────────────────────────────────
const iso = d => d.toISOString().slice(0, 10);
const versDate = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
const jourSuivant = s => { const d = versDate(s); d.setUTCDate(d.getUTCDate() + 1); return iso(d); };
const joursDansMois = (an, mois) => new Date(Date.UTC(an, mois + 1, 0)).getUTCDate();

// L'état d'une activité, qui donne sa couleur
function etatDe(ot, today) {
  if (otLate(ot, today)) return 'late';
  return ot.statut;                    // cloture | en_cours | planifie
}

export async function renderCalendar(root) {
  const [vehicles, ots] = await Promise.all([
    db.listVehicles(),
    db.listActivitiesOverview(),
  ]);

  const today = todayISO();
  if (annee === null) annee = +today.slice(0, 4);

  // Un seul véhicule sélectionné : le premier par défaut. On revérifie
  // à chaque affichage, au cas où il aurait été supprimé.
  if (!vehiculeSel || !vehicles.some(v => v.id === vehiculeSel)) {
    vehiculeSel = vehicles[0]?.id ?? null;
  }

  const jours = joursColories(ots, vehiculeSel, annee, today);

  root.innerHTML = `
    <header class="topbar">
      <h1 class="grow">📆 Calendrier</h1>
    </header>
    <main class="page cal-page with-nav">
      <div class="cal-barre">
        <div class="cal-annee">
          <button class="cal-fleche" id="an-moins" title="Année précédente">‹</button>
          <span class="cal-an">${annee}</span>
          <button class="cal-fleche" id="an-plus" title="Année suivante">›</button>
        </div>
        <div class="cal-vehicules">
          ${vehicles.length
            ? vehicles.map(v => `
              <button class="cal-chip ${v.id === vehiculeSel ? 'actif' : ''}"
                      data-veh="${esc(v.id)}">${esc(v.name)}</button>`).join('')
            : '<span class="cal-vide">Aucun véhicule</span>'}
        </div>
      </div>

      <div class="cal-legende">
        <span><i class="cl cl-planifie"></i>planifiée</span>
        <span><i class="cl cl-en_cours"></i>en cours</span>
        <span><i class="cl cl-late"></i>en retard</span>
        <span><i class="cl cl-cloture"></i>clôturée</span>
        <span><i class="cl cl-today"></i>aujourd’hui</span>
      </div>

      <div class="cal-grille" id="cal-grille">
        ${MOIS.map((nom, m) => moisHTML(nom, m, annee, jours, today)).join('')}
      </div>
    </main>
    ${bottomNav('calendrier')}`;

  $('#an-moins').onclick = () => { annee--; renderCalendar(root); };
  $('#an-plus').onclick  = () => { annee++; renderCalendar(root); };

  $$('[data-veh]', root).forEach(b => {
    b.onclick = () => { vehiculeSel = b.dataset.veh; renderCalendar(root); };
  });

  // Sur iPhone, un seul mois tient à l'écran : on ouvre sur le mois
  // en cours (seulement si l'année affichée est l'année en cours).
  const grille = $('#cal-grille', root);
  if (grille && annee === +today.slice(0, 4) && grille.scrollWidth > grille.clientWidth) {
    const colonne = grille.children[+today.slice(5, 7) - 1];
    // On mesure l'écart réel à l'écran : offsetLeft dépendrait de
    // l'élément positionné le plus proche.
    if (colonne) {
      grille.scrollLeft +=
        colonne.getBoundingClientRect().left - grille.getBoundingClientRect().left;
    }
  }
}

// ── Quels jours sont colorés, et par quoi ? ─────────────────────
// Renvoie une Map "AAAA-MM-JJ" → liste d'activités touchant ce jour.
function joursColories(ots, vehiculeId, an, today) {
  const map = new Map();
  if (!vehiculeId) return map;

  const debutAn = `${an}-01-01`;
  const finAn   = `${an}-12-31`;

  for (const ot of ots) {
    if (ot.vehicle_id !== vehiculeId) continue;
    // Sans date de fin, impossible de placer l'activité : on la saute.
    if (!ot.date_fin) continue;

    const debut = ot.date_debut || ot.date_fin;
    const fin   = ot.date_fin;
    if (debut > fin) continue;                    // donnée incohérente
    if (fin < debutAn || debut > finAn) continue; // hors de l'année

    const info = {
      id: ot.id,
      titre: ot.subsystem || 'Sans intitulé',
      etat: etatDe(ot, today),
    };

    let d = debut < debutAn ? debutAn : debut;
    const f = fin > finAn ? finAn : fin;
    while (d <= f) {
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(info);
      d = jourSuivant(d);
    }
  }
  return map;
}

// ── Une colonne de mois ─────────────────────────────────────────
function moisHTML(nom, m, an, jours, today) {
  const nb = joursDansMois(an, m);
  const lignes = [];

  for (let n = 1; n <= nb; n++) {
    const dateISO = `${an}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
    const d = versDate(dateISO);
    const jourSemaine = d.getUTCDay();            // 0 = dimanche
    const weekend = jourSemaine === 0 || jourSemaine === 6;
    const lundi = jourSemaine === 1;

    const acts = jours.get(dateISO) || [];
    const classes = ['cal-jour'];
    if (weekend) classes.push('cal-we');
    if (acts.length) classes.push('cal-occupe');
    if (dateISO === today) classes.push('cal-today');

    // Deux activités le même jour : la ligne est coupée en deux moitiés
    let style = '';
    if (acts.length === 1) {
      classes.push(`cj-${acts[0].etat}`);
    } else if (acts.length >= 2) {
      classes.push('cal-double');
      style = ` style="--c1:var(--cal-${acts[0].etat});--c2:var(--cal-${acts[1].etat})"`;
    }

    const titres = acts.map(a => a.titre).join(' + ');
    const contenu = `
      <span class="cal-lettre">${LETTRES[jourSemaine]}</span>
      <span class="cal-num">${n}</span>
      <span class="cal-titre">${esc(titres)}</span>
      <span class="cal-sem">${lundi ? 'S' + String(semaineISO(dateISO)).padStart(2, '0') : ''}</span>`;

    lignes.push(acts.length
      ? `<a class="${classes.join(' ')}"${style} href="${esc(lienActivite(acts[0].id, ORIGINE_CALENDRIER))}" title="${esc(titres)}">${contenu}</a>`
      : `<div class="${classes.join(' ')}">${contenu}</div>`);
  }

  return `
    <section class="cal-mois">
      <h3 class="cal-mois-h">${esc(nom)}</h3>
      <div class="cal-jours">${lignes.join('')}</div>
    </section>`;
}
