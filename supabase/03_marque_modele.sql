-- ============================================================
-- GARAGE DE ROGUÉ — Ajout des champs Marque et Modèle
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller TOUT ce fichier → "Run".
--
-- Le script est réexécutable sans danger (il ne détruit rien).
-- ============================================================

alter table public.vehicles
  add column if not exists brand text,   -- marque (ex : Renault)
  add column if not exists model text;   -- modèle (ex : Clio 2)

-- Fin. Si tout s'est bien passé, Supabase affiche "Success".
