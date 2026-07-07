-- ============================================================
-- GARAGE DE ROGUÉ — Brique 6 : fiches techniques enrichies
--
-- Chaque fiche technique a maintenant : un nom, une marque, un
-- type, une quantité, des informations supplémentaires et une
-- photo (le fichier vit dans le bucket "photos" du Storage).
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller TOUT ce fichier → "Run".
--
-- Le script est réexécutable sans danger (il ne détruit rien).
-- ============================================================

alter table public.vehicle_specs
  add column if not exists brand      text,   -- marque
  add column if not exists type       text,   -- type / référence
  add column if not exists qty        text,   -- quantité (texte libre : "4,5 L", "2"…)
  add column if not exists notes      text,   -- informations supplémentaires
  add column if not exists photo_path text;   -- chemin de la photo dans le Storage

-- Les anciennes fiches n'avaient qu'une "valeur" : on la recopie
-- dans les informations supplémentaires pour ne rien perdre.
update public.vehicle_specs
   set notes = value
 where value is not null
   and notes is null;

-- Fin. Si tout s'est bien passé, Supabase affiche "Success".
