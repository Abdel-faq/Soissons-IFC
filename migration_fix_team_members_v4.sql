-- MIGRATION: Fix team_members constraints for Parent-Child Structure

-- 1. Remove the old primary key that prevents multiple kids per parent
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_pkey;

-- 2. Make user_id nullable if it was strictly required (it's often part of PK)
-- In our schema, it should be the parent/account holder.
ALTER TABLE team_members ALTER COLUMN user_id DROP NOT NULL;

-- 3. Add a more appropriate unique constraint
-- A player can only be in a team once.
-- We use a unique constraint instead of PK to allow for flexible legacy data if needed,
-- but (team_id, player_id) is our new logical PK.
ALTER TABLE team_members ADD CONSTRAINT team_members_player_team_unique UNIQUE (team_id, player_id);

-- 4. Ensure RLS still works
-- The previous policies should be fine as they use player_id or auth.uid().
-- But let's re-verify the "Members can view teammates" policy
DROP POLICY IF EXISTS "Members can view teammates" ON team_members;
CREATE POLICY "Members can view teammates" ON team_members 
FOR SELECT USING (auth.role() = 'authenticated');
