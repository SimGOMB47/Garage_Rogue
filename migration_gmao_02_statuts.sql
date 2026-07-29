-- ============================================================
-- GARAGE DE ROGUÉ — Migration GMAO n°02 : conversion des statuts
--
-- Recopie l'ancien statut (colonne "status" : ouvert/en_cours/cloture)
-- vers la nouvelle colonne "statut" (planifie/en_cours/cloture).
--
-- Correspondance validée par Simon le 2026-07-29 :
--     'ouvert'   ->  'planifie'
--     'en_cours' ->  'en_cours'
--     'cloture'  ->  'cloture'
--
-- Rappel de la règle : il n'existe PAS de statut "en retard".
-- "En retard" se calcule à l'affichage uniquement :
--     en_retard = (statut <> 'cloture') ET (date_fin < aujourd'hui)
--
-- Où l'exécuter : tableau de bord Supabase -> menu de gauche
-- "SQL Editor" -> "New query" -> coller TOUT ce fichier -> "Run".
--
-- Réexécutable sans danger : ne remplit que les lignes dont "statut"
-- est encore vide, et ne détruit rien. L'application continue
-- d'utiliser l'ancienne colonne "status" pour l'instant : aucun
-- changement visible à l'écran.
-- ============================================================

update public.work_orders
   set statut = case status
                  when 'ouvert'   then 'planifie'
                  when 'en_cours' then 'en_cours'
                  when 'cloture'  then 'cloture'
                end
 where statut is null;

-- Vérification : nombre d'activités par nouveau statut.
-- Tu dois voir apparaître un petit tableau (planifie / en_cours /
-- cloture avec le nombre pour chacun, et 0 ligne "(vide)").
select coalesce(statut, '(vide)') as statut, count(*) as nombre
from public.work_orders
group by statut
order by statut;

-- Fin. Si tout s'est bien passé, Supabase affiche "Success".
