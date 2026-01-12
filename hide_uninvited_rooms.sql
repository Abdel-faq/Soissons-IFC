-- ENFORCE STRICT VISIBILITY FOR SALONS
-- This ensures uninvited players don't even see the room in their list.

-- 1. Explicitly enable RLS on custom_groups
ALTER TABLE custom_groups ENABLE ROW LEVEL SECURITY;

-- 2. Drop any potentially broad policies
DROP POLICY IF EXISTS "Public can view groups" ON custom_groups;
DROP POLICY IF EXISTS "Allow all for authenticated" ON custom_groups;

-- 3. Re-apply the strict selector policy (cleaned up version)
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (
  created_by = auth.uid() -- The coach who created it
  OR 
  EXISTS (
    -- The player or parent is explicitly invited
    SELECT 1 FROM group_members 
    WHERE group_id = custom_groups.id AND user_id = auth.uid()
  ) 
  OR 
  EXISTS (
    -- The coach of the team can always see all rooms of their team
    SELECT 1 FROM teams 
    WHERE id = custom_groups.team_id AND coach_id = auth.uid()
  )
  OR
  EXISTS (
    -- Admins can see everything
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
