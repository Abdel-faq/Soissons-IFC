-- BREAK RLS RECURSION LOOP
-- This is the final fix for the 500 errors and visibility issues.
-- It uses a SECURITY DEFINER function to bypass the RLS chain.

-- 1. Create a security definer function to check group access
CREATE OR REPLACE FUNCTION public.check_group_access(p_group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- 1. Admin? Yes.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'ADMIN') THEN
    RETURN TRUE;
  END IF;

  -- 2. Creator of the room? Yes.
  IF EXISTS (SELECT 1 FROM public.custom_groups WHERE id = p_group_id AND created_by = v_user_id) THEN
    RETURN TRUE;
  END IF;

  -- 3. Coach of the team? Yes.
  IF EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.custom_groups cg ON t.id = cg.team_id
    WHERE cg.id = p_group_id AND t.coach_id = v_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 4. Member of the group? Yes.
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = v_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply to custom_groups
ALTER TABLE custom_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (check_group_access(id));

-- 3. Apply to group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can see group membership" ON group_members;
CREATE POLICY "Members can see group membership" ON group_members
FOR SELECT USING (check_group_access(group_id));

-- 4. Apply to messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can see team messages" ON messages;
CREATE POLICY "Members can see team messages" ON messages 
FOR SELECT USING (
  (group_id IS NULL AND (
      EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
  )) OR (group_id IS NOT NULL AND check_group_access(group_id))
);

-- 5. Restore management rights (Non-recursive)
DROP POLICY IF EXISTS "Coaches can create rooms" ON custom_groups;
CREATE POLICY "Coaches can create rooms" ON custom_groups
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM teams WHERE id = custom_groups.team_id AND coach_id = auth.uid())
);

DROP POLICY IF EXISTS "Coaches can manage members" ON group_members;
CREATE POLICY "Coaches can manage members" ON group_members
FOR ALL USING (check_group_access(group_id))
WITH CHECK (check_group_access(group_id));
