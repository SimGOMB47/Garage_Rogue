-- ============================================================
-- GARAGE DE ROGUÉ — Migration GMAO n°01 : les fondations
--
-- BUT DE CE SCRIPT : préparer la base de données pour une vraie
-- structure GMAO. Il CRÉE de nouvelles tables et AJOUTE des
-- colonnes, mais NE TOUCHE PAS à l'interface : rien ne change à
-- l'écran de l'application pour l'instant.
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller TOUT ce fichier → "Run".
--
-- Réexécutable sans danger : il ne détruit rien et ne crée pas
-- de doublons si on le relance.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1) TABLE sous_ensembles
--    Les grandes parties d'un véhicule (Moteur, Freinage…).
--    Rattachée à un véhicule ; si le véhicule est supprimé,
--    ses sous-ensembles le sont aussi (on delete cascade).
-- ────────────────────────────────────────────────────────────
create table if not exists public.sous_ensembles (
  id          uuid primary key default gen_random_uuid(),
  vehicule_id uuid not null references public.vehicles (id) on delete cascade,
  nom         text not null,                         -- ex : "Moteur", "Freinage"
  ordre       integer not null default 0,            -- ordre d'affichage
  created_at  timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- 2) TABLE organes
--    Les composants à l'intérieur d'un sous-ensemble
--    (ex : "Circuit de lubrification" dans "Moteur").
-- ────────────────────────────────────────────────────────────
create table if not exists public.organes (
  id                uuid primary key default gen_random_uuid(),
  sous_ensemble_id  uuid not null references public.sous_ensembles (id) on delete cascade,
  nom               text not null,                   -- ex : "Circuit de lubrification"
  ordre             integer not null default 0,
  created_at        timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- 3) TABLE donnees_techniques
--    Les caractéristiques techniques (libellé + valeur).
--    IMPORTANT : rattachées au SOUS-ENSEMBLE, pas au véhicule.
--    C'est volontaire.
-- ────────────────────────────────────────────────────────────
create table if not exists public.donnees_techniques (
  id                uuid primary key default gen_random_uuid(),
  sous_ensemble_id  uuid not null references public.sous_ensembles (id) on delete cascade,
  libelle           text not null,                   -- ex : "Huile", "Couple bouchon vidange"
  valeur            text,                            -- ex : "10W40 semi-synthèse", "20 N·m"
  ordre             integer not null default 0,
  created_at        timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- 4) MODIFIER LA TABLE DES ORDRES DE TRAVAIL (work_orders)
--    On AJOUTE des colonnes, toutes facultatives (NULL autorisé),
--    donc les interventions déjà saisies ne sont pas touchées.
--
--    - sous_ensemble_id / organe_id : rattachement facultatif.
--      "on delete set null" = si on supprime le sous-ensemble ou
--      l'organe, l'intervention n'est PAS supprimée, le lien est
--      simplement vidé.
--    - date_debut / date_fin : période prévue de l'intervention.
--    - statut : nouvelle colonne (à ne pas confondre avec la
--      colonne "status" anglaise déjà existante et utilisée par
--      l'appli). Elle reste VIDE pour l'instant. Voir la note
--      "en retard" plus bas.
-- ────────────────────────────────────────────────────────────
alter table public.work_orders
  add column if not exists sous_ensemble_id uuid
    references public.sous_ensembles (id) on delete set null,
  add column if not exists organe_id uuid
    references public.organes (id) on delete set null,
  add column if not exists date_debut date,
  add column if not exists date_fin   date,
  add column if not exists statut     text
    check (statut in ('planifie', 'en_cours', 'cloture'));
--    Remarque : la contrainte "check" autorise aussi la valeur
--    vide (NULL). Elle n'accepte donc que : rien, 'planifie',
--    'en_cours' ou 'cloture'. Il n'existe PAS de statut 'retard'.

-- RÈGLE "EN RETARD" — NE PAS créer d'état ni de colonne pour ça.
-- "En retard" n'est jamais stocké : il se CALCULE à l'affichage :
--     en_retard = (statut <> 'cloture') ET (date_fin < aujourd'hui)
-- Les deux conditions sont obligatoires. C'est une question posée
-- au moment d'afficher, pas un statut enregistré en base.


-- ────────────────────────────────────────────────────────────
-- 5) SÉCURITÉ (RLS) sur les 3 nouvelles tables
--    On reproduit EXACTEMENT le modèle déjà en place : accès
--    complet (lecture + écriture) réservé aux membres du garage,
--    via la fonction public.is_garage_member().
-- ────────────────────────────────────────────────────────────
alter table public.sous_ensembles     enable row level security;
alter table public.organes            enable row level security;
alter table public.donnees_techniques enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'sous_ensembles', 'organes', 'donnees_techniques'
  ]
  loop
    execute format('drop policy if exists "membres seulement" on public.%I', t);
    execute format(
      'create policy "membres seulement" on public.%I
         for all to authenticated
         using (public.is_garage_member())
         with check (public.is_garage_member())', t);
  end loop;
end $$;


-- ────────────────────────────────────────────────────────────
-- 6) SYNCHRONISATION TEMPS RÉEL
--    Comme les autres tables : pour que l'appli se rafraîchisse
--    toute seule quand l'autre personne modifie quelque chose.
--    (Sans effet visible tant que l'interface n'utilise pas
--    encore ces tables.)
-- ────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'sous_ensembles', 'organes', 'donnees_techniques'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ────────────────────────────────────────────────────────────
-- 7) DONNÉES DE DÉPART
--    Crée les 11 sous-ensembles standard pour CHAQUE véhicule
--    déjà présent. Le "where not exists" évite les doublons si
--    on relance le script.
-- ────────────────────────────────────────────────────────────
insert into public.sous_ensembles (vehicule_id, nom, ordre)
select v.id, s.nom, s.ordre
from public.vehicles v
cross join (values
  ('Moteur',                 1),
  ('Alimentation',           2),
  ('Allumage',               3),
  ('Transmission',           4),
  ('Freinage',               5),
  ('Suspension',             6),
  ('Roues et pneumatiques',  7),
  ('Électricité',            8),
  ('Carrosserie',            9),
  ('Échappement',           10),
  ('Administratif',         11)
) as s(nom, ordre)
where not exists (
  select 1 from public.sous_ensembles se
  where se.vehicule_id = v.id and se.nom = s.nom
);


-- Fin. Si tout s'est bien passé, Supabase affiche "Success".


-- ============================================================
-- ⚠️ SECTION FACULTATIVE — NE PAS EXÉCUTER MAINTENANT
--
-- Conversion des anciens statuts vers la nouvelle colonne "statut".
-- Ton appli utilise encore la colonne "status" (anglaise). Cette
-- partie recopierait ces valeurs dans la nouvelle colonne "statut"
-- selon la correspondance :
--     'ouvert'   →  'planifie'
--     'en_cours' →  'en_cours'
--     'cloture'  →  'cloture'
--
-- Elle est laissée en COMMENTAIRE volontairement : à n'exécuter
-- QU'APRÈS ta validation de cette correspondance. Pour l'activer
-- plus tard, enlève le /* du début et le */ de la fin.
-- ============================================================
/*
update public.work_orders
   set statut = case status
                  when 'ouvert'   then 'planifie'
                  when 'en_cours' then 'en_cours'
                  when 'cloture'  then 'cloture'
                end
 where statut is null;
*/
