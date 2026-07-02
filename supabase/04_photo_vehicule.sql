-- ============================================================
-- GARAGE DE ROGUÉ — Photo de profil des véhicules
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller ce fichier → "Run".
--
-- Ajoute une colonne "photo_path" aux véhicules : le chemin de
-- la photo dans le Storage (bucket "photos", déjà en place).
-- Réexécutable sans danger.
-- ============================================================

alter table public.vehicles
  add column if not exists photo_path text;

-- Fin. Si tout s'est bien passé, Supabase affiche "Success".
