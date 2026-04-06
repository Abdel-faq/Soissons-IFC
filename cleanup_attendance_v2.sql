-- SQL Cleanup for Attendance and Membership Tables (VERSION AGRESSIVE)

-- 1. Nettoyage des doublons dans team_members (conserver 1 seule ligne par joueur/équipe)
DELETE FROM team_members a
USING team_members b
WHERE a.ctid < b.ctid 
  AND a.team_id = b.team_id 
  AND a.player_id = b.player_id;

-- 2. Migration des lignes attendance user_id -> player_id (si besoin)
UPDATE attendance a 
SET player_id = p.id 
FROM players p 
WHERE a.player_id IS NULL AND a.user_id = p.id;

-- 3. Nettoyage des doublons dans attendance (conserver la réponse la plus récente)
-- On utilise ctid pour identifier les lignes physiques
DELETE FROM attendance
WHERE ctid NOT IN (
    SELECT MIN(ctid)
    FROM attendance
    GROUP BY event_id, player_id
);

-- 4. Suppression des "fantômes" (convocations sans joueur valide ou doublons orphelins)
DELETE FROM attendance 
WHERE player_id IS NULL 
  AND user_id NOT IN (SELECT coach_id FROM teams WHERE coach_id IS NOT NULL);

-- 5. Optionnel : S'assurer que player_id est rempli pour toutes les convocations futures
-- (Si une ligne a is_convoked=true mais pas de player_id, elle est invalide)
DELETE FROM attendance WHERE is_convoked = true AND player_id IS NULL;
