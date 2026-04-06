-- ENFORCE CHAT PRIVACY
-- Only group members and the team coach should be able to see a custom_group (salon)

-- 1. Drop existing selector policy
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;

-- 2. Create new restrictive policy
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (
  -- User is a member of the group
  EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = custom_groups.id AND user_id = auth.uid()
  ) 
  OR 
  -- User is the coach of the team
  EXISTS (
    SELECT 1 FROM teams 
    WHERE id = custom_groups.team_id AND coach_id = auth.uid()
  )
  OR
  -- User is Admin
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Ensure group_members also has strict RLS if not already
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can see group membership" ON group_members;
CREATE POLICY "Members can see group membership" ON group_members
FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM teams t JOIN custom_groups cg ON t.id = cg.team_id WHERE cg.id = group_members.group_id AND t.coach_id = auth.uid())
);
