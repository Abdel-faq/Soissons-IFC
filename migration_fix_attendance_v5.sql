-- MIGRATION: Fix attendance constraints for Parent-Child

-- 1. Remove old PK
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_pkey;

-- 2. Make user_id nullable if it was strictly required
ALTER TABLE attendance ALTER COLUMN user_id DROP NOT NULL;

-- 3. Cleanup: ensure player_id is not null where it should be
-- (We assume players exist for all relevant attendance)
-- If player_id is still null, we try to recover from user_id (legacy)
UPDATE attendance a 
SET player_id = p.id 
FROM players p 
WHERE a.player_id IS NULL AND a.user_id = p.id;

-- 4. Delete potential duplicates before adding unique constraint
-- This is tricky without a separate ID. We can use ctid for cleanup.
DELETE FROM attendance a
WHERE ctid NOT IN (
    SELECT MIN(ctid)
    FROM attendance
    GROUP BY event_id, player_id
);

-- 5. Add new unique constraint
ALTER TABLE attendance ADD CONSTRAINT attendance_player_event_unique UNIQUE (event_id, player_id);
