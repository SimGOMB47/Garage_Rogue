-- ============================================================
-- GARAGE DE ROGUÉ — ÉTAT DES LIEUX DES DATES SUR LES ACTIVITÉS
--
-- LECTURE SEULE : ce script ne contient que des SELECT.
-- Il ne crée, ne modifie et ne supprime RIEN. Tu peux le relancer
-- autant de fois que tu veux sans aucun risque.
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller TOUT ce fichier → "Run".
--
-- Tu obtiendras UN SEUL tableau, découpé en sections :
--   1. TOTAL          → nombre total d'activités
--   2. COMPLETES      → date_debut ET date_fin renseignées
--   3. INCOMPLETES    → au moins une des deux manquante (NULL)
--   4. DETAIL         → la liste des activités incomplètes
--   5. INCOHERENCES   → les complètes dont date_fin < date_debut
--
-- Une date manquante s'affiche "— MANQUANT —" pour sauter aux yeux.
-- ============================================================

with act as (
  select
    w.id,
    coalesce(v.name, '(véhicule inconnu)')                       as vehicule,
    coalesce(nullif(btrim(w.subsystem), ''), '(sans intitulé)')   as intitule,
    coalesce(w.statut, '(statut vide)')                          as statut,
    w.date_debut,
    w.date_fin,
    w.date                                                       as ancienne_date,
    w.created_at
  from public.work_orders w
  left join public.vehicles v on v.id = w.vehicle_id   -- left join : aucune activité n'est oubliée
),

-- Les compteurs demandés aux points 1, 2 et 3
compte as (
  select
    count(*)                                                                as total,
    count(*) filter (where date_debut is not null
                       and date_fin  is not null)                           as completes,
    count(*) filter (where date_debut is null
                        or date_fin  is null)                               as incompletes,
    count(*) filter (where date_debut is null and date_fin is not null)     as sans_debut,
    count(*) filter (where date_fin  is null and date_debut is not null)    as sans_fin,
    count(*) filter (where date_debut is null and date_fin is null)         as sans_aucune,
    count(*) filter (where date_debut is not null
                       and date_fin  is not null
                       and date_fin < date_debut)                           as incoherentes
  from act
)

-- ── 1. TOTAL ────────────────────────────────────────────────
select 1 as n, '1. TOTAL' as section,
       'Activités en base' as vehicule,
       total::text         as intitule,
       ''                  as statut,
       ''                  as date_debut,
       ''                  as date_fin,
       ''                  as creee_le,
       ''                  as remarque
from compte

union all
-- ── 2. COMPLÈTES ────────────────────────────────────────────
select 2, '2. COMPLETES',
       'Les deux dates renseignées',
       completes::text, '', '', '', '',
       case when total = 0 then ''
            else round(100.0 * completes / total) || ' % du total' end
from compte

union all
-- ── 3. INCOMPLÈTES ──────────────────────────────────────────
select 3, '3. INCOMPLETES',
       'Au moins une date manquante',
       incompletes::text, '', '', '', '',
       'dont ' || sans_debut   || ' sans date_debut, '
                || sans_fin    || ' sans date_fin, '
                || sans_aucune || ' sans aucune des deux'
from compte

union all
-- ── 4. LE DÉTAIL DES INCOMPLÈTES ────────────────────────────
select 4, '4. DETAIL',
       vehicule,
       intitule,
       statut,
       coalesce(to_char(date_debut, 'DD/MM/YYYY'), '— MANQUANT —'),
       coalesce(to_char(date_fin,   'DD/MM/YYYY'), '— MANQUANT —'),
       to_char(created_at, 'DD/MM/YYYY HH24:MI'),
       'ancienne colonne date = ' || coalesce(to_char(ancienne_date, 'DD/MM/YYYY'), '(vide)')
from act
where date_debut is null or date_fin is null

union all
-- ── 5. LES INCOHÉRENCES (date_fin < date_debut) ─────────────
select 5, '5. INCOHERENCE',
       vehicule,
       intitule,
       statut,
       to_char(date_debut, 'DD/MM/YYYY'),
       to_char(date_fin,   'DD/MM/YYYY'),
       to_char(created_at, 'DD/MM/YYYY HH24:MI'),
       'fin AVANT début de ' || (date_debut - date_fin) || ' jour(s)'
from act
where date_debut is not null
  and date_fin  is not null
  and date_fin < date_debut

-- Tri : section, puis véhicule, puis intitulé.
-- (On ne trie PAS sur les colonnes de dates : elles ont été converties
--  en texte "JJ/MM/AAAA" pour l'affichage, elles se trieraient par jour
--  et non par année.)
order by n, vehicule, intitule;
