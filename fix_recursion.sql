-- FIX RLS INFINITE RECURSION
-- The previous policy for group_members created a loop.

-- 1. Drop the problematic policy
DROP POLICY IF EXISTS "Members can see group membership" ON group_members;

-- 2. Create a clean, non-recursive policy
-- We allow users to see membership rows if:
-- a) It's their own membership
-- b) They are the coach of the team that owns the group
-- c) They are an admin
CREATE POLICY "Members can see group membership" ON group_members
FOR SELECT USING (
    user_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM teams t 
        JOIN custom_groups cg ON t.id = cg.team_id 
        WHERE cg.id = group_members.group_id AND t.coach_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'
    )
);

-- 3. Also update custom_groups to be more efficient
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM teams 
    WHERE id = custom_groups.team_id AND coach_id = auth.uid()
  )
  OR id IN (
    -- Using a direct IN check can sometimes be better than EXISTS to avoid complex loops
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  )
);
