-- ============================================================
-- GARAGE DE ROGUÉ — Script d'installation de la base de données
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller TOUT ce fichier → "Run".
--
-- Le script est réexécutable sans danger (il ne détruit rien).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1) MEMBRES DU GARAGE
--    La liste des comptes autorisés à voir et modifier le garage.
--    On y ajoutera ton compte et celui de ton père avec le
--    script 02_membres.sql (après création des comptes).
-- ────────────────────────────────────────────────────────────
create table if not exists public.garage_members (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);

-- Fonction utilisée par toutes les règles de sécurité :
-- renvoie VRAI si l'utilisateur actuellement connecté est membre.
-- "security definer" lui permet de consulter la table des membres
-- même quand elle est appelée par un non-membre.
create or replace function public.is_garage_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.garage_members where user_id = auth.uid()
  );
$$;


-- ────────────────────────────────────────────────────────────
-- 2) TABLES MÉTIER
-- ────────────────────────────────────────────────────────────

-- Véhicules
create table if not exists public.vehicles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text,
  year       integer,
  plate      text,                                  -- immatriculation
  km         integer not null default 0,
  status     text not null default 'en_service',    -- en_service | maintenance | hors_service
  created_at timestamptz not null default now()
);

-- Ordres de travail (interventions)
create table if not exists public.work_orders (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  type        text not null default 'correctif',    -- preventif | correctif | amelioratif
  subsystem   text,                                 -- sous-ensemble (moteur, freinage...)
  date        date not null default current_date,
  km          integer,
  description text,
  status      text not null default 'ouvert',       -- ouvert | en_cours | cloture
  created_at  timestamptz not null default now()
);

-- Pièces utilisées dans un ordre de travail (avec prix)
create table if not exists public.work_order_parts (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  name          text not null,
  qty           numeric not null default 1,
  price         numeric not null default 0,
  created_at    timestamptz not null default now()
);

-- Photos d'un ordre de travail (le fichier est dans le bucket
-- "photos" du Storage ; ici on garde seulement son chemin)
create table if not exists public.work_order_photos (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  path          text not null,
  created_at    timestamptz not null default now()
);

-- Échéances préventives (par km et/ou par date)
create table if not exists public.deadlines (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  title      text not null,
  due_km     integer,        -- échéance kilométrique (optionnelle)
  due_date   date,           -- échéance par date (optionnelle)
  notes      text,
  created_at timestamptz not null default now()
);

-- Stock de pièces par véhicule
create table if not exists public.stock_parts (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  name       text not null,
  ref        text,           -- référence fabricant
  qty        numeric not null default 0,
  price      numeric,
  created_at timestamptz not null default now()
);

-- Fiche technique : liste libre de caractéristiques (libellé / valeur)
create table if not exists public.vehicle_specs (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  label      text not null,
  value      text,
  created_at timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────
-- 3) SÉCURITÉ — Row Level Security (RLS)
--    Principe : une fois RLS activé sur une table, PERSONNE ne
--    peut y accéder, sauf si une "policy" (règle) l'autorise.
--    Nos règles : accès complet pour les membres, rien pour les
--    autres — même s'ils ont créé un compte.
-- ────────────────────────────────────────────────────────────
alter table public.garage_members    enable row level security;
alter table public.vehicles          enable row level security;
alter table public.work_orders       enable row level security;
alter table public.work_order_parts  enable row level security;
alter table public.work_order_photos enable row level security;
alter table public.deadlines         enable row level security;
alter table public.stock_parts       enable row level security;
alter table public.vehicle_specs     enable row level security;

-- Chaque utilisateur connecté peut vérifier SA PROPRE adhésion
-- (nécessaire pour que l'appli affiche "accès refusé" proprement).
drop policy if exists "voir sa propre adhesion" on public.garage_members;
create policy "voir sa propre adhesion" on public.garage_members
  for select to authenticated
  using (user_id = auth.uid());

-- Pour chaque table métier : lecture + écriture réservées aux membres.
do $$
declare t text;
begin
  foreach t in array array[
    'vehicles', 'work_orders', 'work_order_parts', 'work_order_photos',
    'deadlines', 'stock_parts', 'vehicle_specs'
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
-- 4) VUE : coût total par véhicule
--    Additionne prix × quantité de toutes les pièces de tous les
--    ordres de travail du véhicule. "security_invoker" fait que
--    la vue respecte les règles RLS ci-dessus.
-- ────────────────────────────────────────────────────────────
create or replace view public.vehicle_costs
with (security_invoker = on) as
select v.id as vehicle_id,
       coalesce(sum(p.price * p.qty), 0) as total_cost
from public.vehicles v
left join public.work_orders      w on w.vehicle_id = v.id
left join public.work_order_parts p on p.work_order_id = w.id
group by v.id;


-- ────────────────────────────────────────────────────────────
-- 5) SYNCHRONISATION TEMPS RÉEL
--    Permet à l'appli d'être prévenue quand l'autre personne
--    modifie quelque chose, pour rafraîchir l'écran toute seule.
-- ────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'vehicles', 'work_orders', 'work_order_parts', 'work_order_photos',
    'deadlines', 'stock_parts', 'vehicle_specs'
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
-- 6) STOCKAGE DES PHOTOS
--    Bucket privé "photos" + règles : seuls les membres peuvent
--    voir, ajouter et supprimer des fichiers.
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "membres lisent les photos" on storage.objects;
create policy "membres lisent les photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_garage_member());

drop policy if exists "membres ajoutent des photos" on storage.objects;
create policy "membres ajoutent des photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_garage_member());

drop policy if exists "membres suppriment des photos" on storage.objects;
create policy "membres suppriment des photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_garage_member());

-- Fin. Si tout s'est bien passé, Supabase affiche "Success".
