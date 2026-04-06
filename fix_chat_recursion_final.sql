-- BREAK RLS RECURSION AND FIX COACH ACCESS
-- This script uses SECURITY DEFINER to bypass RLS loops.

-- 1. Enhanced access check function (Multi-coach aware)
CREATE OR REPLACE FUNCTION public.check_group_access(p_group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team_id UUID;
BEGIN
  -- Get the team_id for the group
  SELECT team_id INTO v_team_id FROM public.custom_groups WHERE id = p_group_id;
  IF v_team_id IS NULL THEN RETURN FALSE; END IF;

  -- 1. Admin?
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'ADMIN') THEN
    RETURN TRUE;
  END IF;

  -- 2. Creator of the room?
  IF EXISTS (SELECT 1 FROM public.custom_groups WHERE id = p_group_id AND created_by = v_user_id) THEN
    RETURN TRUE;
  END IF;

  -- 3. Principal Coach of the team?
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = v_team_id AND coach_id = v_user_id) THEN
    RETURN TRUE;
  END IF;

  -- 4. Secondary Coach (member of team with role COACH)?
  IF EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.user_id
    WHERE tm.team_id = v_team_id 
    AND tm.user_id = v_user_id 
    AND p.role = 'COACH'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 5. Explicit member of the group?
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = v_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply policies to custom_groups
ALTER TABLE custom_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (check_group_access(id));

DROP POLICY IF EXISTS "Coaches can create rooms" ON custom_groups;
CREATE POLICY "Coaches can create rooms" ON custom_groups
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = custom_groups.team_id 
    AND (
      t.coach_id = auth.uid() 
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

-- 3. Apply policies to group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can see group membership" ON group_members;
CREATE POLICY "Members can see group membership" ON group_members
FOR SELECT USING (check_group_access(group_id));

DROP POLICY IF EXISTS "Coaches can manage members" ON group_members;
CREATE POLICY "Coaches can manage members" ON group_members
FOR ALL USING (check_group_access(group_id))
WITH CHECK (check_group_access(group_id));
