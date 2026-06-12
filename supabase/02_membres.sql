-- ============================================================
-- GARAGE DE ROGUÉ — Autoriser les comptes (à exécuter EN DERNIER)
--
-- Prérequis : toi et ton père avez chacun créé votre compte
-- via l'écran de connexion de l'application.
--
-- 1. Remplace EMAIL_DE_TON_PERE ci-dessous par son adresse exacte.
-- 2. Colle le tout dans SQL Editor → Run.
--
-- Réexécutable sans danger. Pour ajouter quelqu'un plus tard,
-- ajoute simplement son email à la liste et relance le script.
-- ============================================================

insert into public.garage_members (user_id, email)
select id, email
from auth.users
where email in (
  'simon.gombert13@gmail.com',
  'EMAIL_DE_TON_PERE'
)
on conflict (user_id) do nothing;

-- Vérification : doit afficher les comptes ajoutés.
select email, added_at from public.garage_members;
