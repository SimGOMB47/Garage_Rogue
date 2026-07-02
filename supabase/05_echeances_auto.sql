-- ============================================================
-- GARAGE DE ROGUÉ — Échéances → activités automatiques
--
-- Où l'exécuter : tableau de bord Supabase → menu de gauche
-- "SQL Editor" → "New query" → coller ce fichier → "Run".
--
-- Ajoute une colonne "work_order_id" aux échéances : quand
-- l'application crée automatiquement l'activité (1 mois avant
-- la date), elle note son identifiant ici pour ne pas la créer
-- deux fois. Réexécutable sans danger.
-- ============================================================

alter table public.deadlines
  add column if not exists work_order_id uuid
    references public.work_orders (id) on delete set null;

-- Fin. Si tout s'est bien passé, Supabase affiche "Success".
