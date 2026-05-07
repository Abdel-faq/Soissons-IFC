-- FIX RLS FOR TEAMS AND MEMBERSHIPS
-- Ensure coaches and members can see their teams

-- 1. Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Coaches can view their own teams" ON teams;
DROP POLICY IF EXISTS "Members can view their teams" ON teams;
DROP POLICY IF EXISTS "Users can view teams they belong to" ON teams;
DROP POLICY IF EXISTS "Public teams are viewable by everyone" ON teams;

-- 3. Create Robust SELECT Policy for Teams
-- A user can see a team if:
-- a) They are the coach (coach_id = auth.uid())
-- b) They are a member of the team
CREATE POLICY "Users can view relevant teams" ON teams
FOR SELECT
TO authenticated
USING (
    coach_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = teams.id AND user_id = auth.uid()
    )
);

-- 4. Create Robust SELECT Policy for Team Members
DROP POLICY IF EXISTS "Users can view memberships of their teams" ON team_members;
CREATE POLICY "Users can view memberships of their teams" ON team_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM teams 
        WHERE id = team_members.team_id AND coach_id = auth.uid()
    )
);

-- 5. Special Fix for Service Role (if needed, but usually bypassed)
-- Normally service_role bypasses RLS.

-- 6. Grant permissions
GRANT SELECT ON teams TO authenticated;
GRANT SELECT ON team_members TO authenticated;
