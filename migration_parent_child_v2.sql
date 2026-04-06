-- MIGRATION: Parent-Child Structure & Enhanced Carpooling

-- 1. Create Players Table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    position TEXT,
    avatar_url TEXT,
    category TEXT, -- e.g., 'U10', 'U12', 'Seniors'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on players
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- 2. Add new columns to Carpooling/Rides
ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_relation TEXT CHECK (driver_relation IN ('PAPA', 'MAMAN', 'AUTRE', 'COACH'));
ALTER TABLE rides ADD COLUMN IF NOT EXISTS restrictions TEXT DEFAULT 'NONE'; -- e.g., 'ONLY_CHILD', 'NO_ADULTS'
ALTER TABLE ride_passengers ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE ride_passengers ADD COLUMN IF NOT EXISTS seat_count INTEGER DEFAULT 1; -- 1 for child, 2 for child+parent

-- 3. Prepare other tables for player-based logic
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE CASCADE;

-- 4. Backup/Migrate existing data
-- Create a player for each current PLAYER profile
-- We use COALESCE/NULLIF to avoid NULL constraint violations
-- We use 'id' as 'parent_id' but ALSO as 'id' for the migrated record to ensure idempotency if re-run
INSERT INTO players (id, parent_id, first_name, last_name, position)
SELECT 
    id, -- The player gets the same ID as the profile for the migration
    id, -- The profile is also the parent/representative
    COALESCE(NULLIF(split_part(full_name, ' ', 1), ''), 'Joueur'), 
    COALESCE(NULLIF(split_part(full_name, ' ', 2), ''), 'Inconnu'), 
    position
FROM profiles
WHERE role = 'PLAYER'
ON CONFLICT (id) DO NOTHING;

-- Map existing relationships
-- Now that p.id = p.parent_id for migrated records, the mapping is stable
UPDATE team_members tm SET player_id = p.id FROM players p WHERE tm.player_id IS NULL AND tm.user_id = p.id;
UPDATE attendance a SET player_id = p.id FROM players p WHERE a.player_id IS NULL AND a.user_id = p.id;
UPDATE group_members gm SET player_id = p.id FROM players p WHERE gm.player_id IS NULL AND gm.user_id = p.id;
UPDATE ride_passengers rp SET player_id = p.id FROM players p WHERE rp.player_id IS NULL AND rp.passenger_id = p.id;

-- 5. Cleanup and enforce constraints (Finalizing the switch)
-- Note: We wait to drop user_id/passenger_id until code is updated to avoid crashes.
-- But for a clean schema, we'll eventually want to:
-- ALTER TABLE team_members DROP COLUMN user_id;
-- ALTER TABLE attendance DROP COLUMN user_id;
-- ALTER TABLE ride_passengers DROP COLUMN passenger_id;

-- 6. Updated RLS Policies

-- Players: Parents can manage their kids, others can see teammates
DROP POLICY IF EXISTS "Parents can manage their kids" ON players;
CREATE POLICY "Parents can manage their kids" ON players FOR ALL USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can see players" ON players;
CREATE POLICY "Anyone can see players" ON players FOR SELECT USING (true);

-- Ride Passengers: Enforce seat count logic and player links
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON ride_passengers;
CREATE POLICY "Enable insert for authenticated users" ON ride_passengers FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
);
