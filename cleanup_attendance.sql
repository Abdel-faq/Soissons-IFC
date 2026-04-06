-- SQL Cleanup for Attendance Table
-- 1. Migrate any remaining rows with user_id but no player_id if they correspond to a player
UPDATE attendance a 
SET player_id = p.id 
FROM players p 
WHERE a.player_id IS NULL AND a.user_id = p.id;

-- 2. Delete duplicate rows for same (event_id, player_id)
-- Keeps the most recently updated record for each pair
DELETE FROM attendance a
WHERE ctid IN (
    SELECT ctid FROM (
        SELECT ctid, 
               ROW_NUMBER() OVER (PARTITION BY event_id, player_id ORDER BY updated_at DESC) as rn
        FROM attendance
        WHERE player_id IS NOT NULL
    ) t WHERE t.rn > 1
);

-- 3. Remove rows where is_convoked is true but player_id is NULL (legacy ghosts)
-- ONLY if they don't correspond to a coach (coaches use user_id)
DELETE FROM attendance 
WHERE player_id IS NULL 
  AND user_id NOT IN (SELECT coach_id FROM teams WHERE coach_id IS NOT NULL);
