-- Unified Fix for Custom Groups RLS
-- Allows both Principal Coach and Secondary Coaches to create and manage rooms.

-- 1. Correct INSERT policy for custom_groups
DROP POLICY IF EXISTS "Coaches can create rooms" ON custom_groups;
CREATE POLICY "Coaches can create rooms" ON custom_groups
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = custom_groups.team_id 
    AND (
      t.coach_id = auth.uid() -- Principal Coach
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        JOIN public.profiles p ON p.id = tm.user_id
        WHERE tm.team_id = t.id 
        AND tm.user_id = auth.uid() 
        AND p.role = 'COACH' -- Secondary Coach
      )
    )
  )
);

-- 2. Correct ALL policy for group_members (to allow adding members upon creation)
DROP POLICY IF EXISTS "Coaches can manage members" ON group_members;
CREATE POLICY "Coaches can manage members" ON group_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.custom_groups cg
    JOIN public.teams t ON cg.team_id = t.id
    WHERE cg.id = group_members.group_id 
    AND (
      cg.created_by = auth.uid() 
      OR t.coach_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        JOIN public.profiles p ON p.id = tm.user_id
        WHERE tm.team_id = t.id 
        AND tm.user_id = auth.uid() 
        AND p.role = 'COACH'
      )
    )
  )
);

-- 3. Ensure SELECT policy for custom_groups account for created_by and multi-coach
-- This prevents the RLS violation on the .select() part of the insert if the check fails.
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (
  created_by = auth.uid() -- The creator can always see it
  OR EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = custom_groups.id AND user_id = auth.uid()
  ) 
  OR EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = custom_groups.team_id 
    AND (
      t.coach_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM team_members tm
        JOIN profiles p ON p.id = tm.user_id
        WHERE tm.team_id = t.id 
        AND tm.user_id = auth.uid() 
        AND p.role = 'COACH'
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
