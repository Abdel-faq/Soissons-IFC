-- Add relation column to ride_passengers to specify who is traveling
ALTER TABLE ride_passengers ADD COLUMN IF NOT EXISTS relation TEXT DEFAULT 'SELF';
-- Update existing records if any
UPDATE ride_passengers SET relation = 'CHILD_ALONE' WHERE seat_count = 1 AND player_id IS NOT NULL;
UPDATE ride_passengers SET relation = 'CHILD_PARENT' WHERE seat_count = 2 AND player_id IS NOT NULL;
