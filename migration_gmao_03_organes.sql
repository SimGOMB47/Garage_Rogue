-- ============================================================
-- GARAGE DE ROGUÉ — Migration GMAO n°03 : les organes standard
--
-- BUT DE CE SCRIPT — deux choses :
--
--   1. Remplir la table `organes`, créée VIDE par la migration n°01.
--      Sans organes, l'étape « Organe » du formulaire de création
--      d'activité ne propose rien.
--
--   2. Boucher un trou : jusqu'ici, un véhicule ajouté depuis l'app
--      n'avait AUCUN sous-ensemble (la migration n°01 n'avait servi
--      que les véhicules déjà présents ce jour-là). Sa fiche technique
--      et son formulaire de création seraient restés vides.
--      Un « déclencheur » (trigger) s'en occupe désormais tout seul.
--
-- COMMENT C'EST ORGANISÉ : la liste standard est rangée dans deux
-- petites tables « catalogue ». Elles servent de modèle, à la fois
-- pour les véhicules existants et pour les futurs. Pour ajouter un
-- organe à ton vocabulaire, tu ajoutes une ligne au catalogue et tu
-- relances ce script : seuls les manquants sont créés.
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller TOUT ce fichier → "Run".
--
-- Réexécutable sans danger : il ne supprime jamais un sous-ensemble
-- ni un organe. Les organes que tu aurais ajoutés toi-même restent.
--
-- NOTE : la dernière instruction est un SELECT de vérification, donc
-- Supabase affichera un TABLEAU de résultats au lieu du bandeau vert
-- « Success ». C'est normal.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1) LES DEUX TABLES CATALOGUE (le « modèle » d'un véhicule)
-- ────────────────────────────────────────────────────────────
create table if not exists public.catalogue_sous_ensembles (
  nom    text primary key,
  ordre  integer not null default 0
);

create table if not exists public.catalogue_organes (
  sous_ensemble  text not null references public.catalogue_sous_ensembles (nom) on delete cascade,
  nom            text not null,
  ordre          integer not null default 0,
  primary key (sous_ensemble, nom)
);


-- ────────────────────────────────────────────────────────────
-- 2) SÉCURITÉ (RLS) — même modèle que les autres tables
-- ────────────────────────────────────────────────────────────
alter table public.catalogue_sous_ensembles enable row level security;
alter table public.catalogue_organes        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['catalogue_sous_ensembles', 'catalogue_organes']
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
-- 3) LES 11 SOUS-ENSEMBLES STANDARD
--    (mêmes noms et même ordre que la migration n°01)
-- ────────────────────────────────────────────────────────────
insert into public.catalogue_sous_ensembles (nom, ordre) values
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
on conflict (nom) do update set ordre = excluded.ordre;


-- ────────────────────────────────────────────────────────────
-- 4) LES ORGANES STANDARD
--    C'est ici que tu ajoutes / renommes des organes.
-- ────────────────────────────────────────────────────────────
insert into public.catalogue_organes (sous_ensemble, nom, ordre) values
  -- ── Moteur ────────────────────────────────────────────────
  ('Moteur', 'Circuit de lubrification',       1),
  ('Moteur', 'Circuit de refroidissement',     2),
  ('Moteur', 'Distribution',                   3),
  ('Moteur', 'Culasse',                        4),
  ('Moteur', 'Bloc et attelage mobile',        5),
  ('Moteur', 'Turbocompresseur',               6),
  ('Moteur', 'Supports moteur',                7),

  -- ── Alimentation ──────────────────────────────────────────
  ('Alimentation', 'Réservoir',                1),
  ('Alimentation', 'Pompe à carburant',        2),
  ('Alimentation', 'Filtre à carburant',       3),
  ('Alimentation', 'Injection / carburateur',  4),
  ('Alimentation', 'Filtre à air',             5),
  ('Alimentation', 'Admission',                6),

  -- ── Allumage ──────────────────────────────────────────────
  ('Allumage', 'Bougies',                      1),
  ('Allumage', 'Bobine',                       2),
  ('Allumage', 'Faisceau haute tension',       3),
  ('Allumage', 'Préchauffage (diesel)',        4),

  -- ── Transmission ──────────────────────────────────────────
  ('Transmission', 'Embrayage',                1),
  ('Transmission', 'Boîte de vitesses',        2),
  ('Transmission', 'Pont / différentiel',      3),
  ('Transmission', 'Cardans et transmissions', 4),
  ('Transmission', 'Boîte de transfert',       5),

  -- ── Freinage ──────────────────────────────────────────────
  ('Freinage', 'Plaquettes avant',             1),
  ('Freinage', 'Disques avant',                2),
  ('Freinage', 'Freins arrière',               3),
  ('Freinage', 'Maître-cylindre',              4),
  ('Freinage', 'Flexibles et canalisations',   5),
  ('Freinage', 'Frein de stationnement',       6),
  ('Freinage', 'Liquide de frein',             7),

  -- ── Suspension ────────────────────────────────────────────
  ('Suspension', 'Amortisseurs avant',         1),
  ('Suspension', 'Amortisseurs arrière',       2),
  ('Suspension', 'Ressorts / lames',           3),
  ('Suspension', 'Triangles et rotules',       4),
  ('Suspension', 'Silentblocs',                5),
  ('Suspension', 'Direction',                  6),

  -- ── Roues et pneumatiques ─────────────────────────────────
  ('Roues et pneumatiques', 'Pneus avant',     1),
  ('Roues et pneumatiques', 'Pneus arrière',   2),
  ('Roues et pneumatiques', 'Jantes',          3),
  ('Roues et pneumatiques', 'Roulements',      4),
  ('Roues et pneumatiques', 'Géométrie',       5),
  ('Roues et pneumatiques', 'Roue de secours', 6),

  -- ── Électricité ───────────────────────────────────────────
  ('Électricité', 'Batterie',                  1),
  ('Électricité', 'Alternateur',               2),
  ('Électricité', 'Démarreur',                 3),
  ('Électricité', 'Éclairage',                 4),
  ('Électricité', 'Faisceau et fusibles',      5),
  ('Électricité', 'Calculateur',               6),
  ('Électricité', 'Essuie-glaces',             7),

  -- ── Carrosserie ───────────────────────────────────────────
  ('Carrosserie', 'Châssis',                   1),
  ('Carrosserie', 'Portes et ouvrants',        2),
  ('Carrosserie', 'Vitrage',                   3),
  ('Carrosserie', 'Peinture et protection',    4),
  ('Carrosserie', 'Intérieur / sellerie',      5),
  ('Carrosserie', 'Traitement antirouille',    6),

  -- ── Échappement ───────────────────────────────────────────
  ('Échappement', 'Collecteur',                1),
  ('Échappement', 'Catalyseur / FAP',          2),
  ('Échappement', 'Silencieux',                3),
  ('Échappement', 'Fixations et joints',       4),

  -- ── Administratif ─────────────────────────────────────────
  ('Administratif', 'Contrôle technique',      1),
  ('Administratif', 'Assurance',               2),
  ('Administratif', 'Carte grise',             3),
  ('Administratif', 'Facturation',             4)
on conflict (sous_ensemble, nom) do update set ordre = excluded.ordre;


-- ────────────────────────────────────────────────────────────
-- 5) APPLIQUER LE CATALOGUE AUX VÉHICULES DÉJÀ ENREGISTRÉS
--    a) les sous-ensembles manquants (filet de sécurité si un
--       véhicule a été créé après la migration n°01) ;
--    b) puis les organes manquants.
-- ────────────────────────────────────────────────────────────
insert into public.sous_ensembles (vehicule_id, nom, ordre)
select v.id, c.nom, c.ordre
from public.vehicles v
cross join public.catalogue_sous_ensembles c
where not exists (
  select 1 from public.sous_ensembles se
  where se.vehicule_id = v.id and se.nom = c.nom
);

insert into public.organes (sous_ensemble_id, nom, ordre)
select se.id, c.nom, c.ordre
from public.sous_ensembles se
join public.catalogue_organes c on c.sous_ensemble = se.nom
where not exists (
  select 1 from public.organes o
  where o.sous_ensemble_id = se.id and o.nom = c.nom
);


-- ────────────────────────────────────────────────────────────
-- 6) LE DÉCLENCHEUR POUR LES FUTURS VÉHICULES
--    Dès qu'un véhicule est créé depuis l'app, il reçoit
--    automatiquement ses sous-ensembles et ses organes.
-- ────────────────────────────────────────────────────────────
create or replace function public.seed_structure_vehicule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sous_ensembles (vehicule_id, nom, ordre)
  select new.id, c.nom, c.ordre
  from public.catalogue_sous_ensembles c;

  insert into public.organes (sous_ensemble_id, nom, ordre)
  select se.id, c.nom, c.ordre
  from public.sous_ensembles se
  join public.catalogue_organes c on c.sous_ensemble = se.nom
  where se.vehicule_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_seed_structure_vehicule on public.vehicles;

create trigger trg_seed_structure_vehicule
after insert on public.vehicles
for each row execute function public.seed_structure_vehicule();


-- ────────────────────────────────────────────────────────────
-- 7) VÉRIFICATION
--    Une ligne par véhicule : il doit y avoir 11 sous-ensembles
--    et 62 organes pour chacun.
-- ────────────────────────────────────────────────────────────
select
  v.name                            as vehicule,
  count(distinct se.id)             as nb_sous_ensembles,
  count(org.id)                     as nb_organes
from public.vehicles v
left join public.sous_ensembles se on se.vehicule_id = v.id
left join public.organes org       on org.sous_ensemble_id = se.id
group by v.name
order by v.name;
