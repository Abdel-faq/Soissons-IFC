-- EMERGENCY FIX FOR CHAT ROOMS RLS - FINAL VERSION (NO RECURSION)
-- This version uses isolated SECURITY DEFINER functions for EVERYTHING to break recursion.

-- 1. CLEANUP ALL RELATED POLICIES
DROP POLICY IF EXISTS "Coaches can insert rooms" ON custom_groups;
DROP POLICY IF EXISTS "Coaches can create rooms" ON custom_groups;
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
DROP POLICY IF EXISTS "Coaches can delete rooms" ON custom_groups;
DROP POLICY IF EXISTS "Coaches can update rooms" ON custom_groups;
DROP POLICY IF EXISTS "Standard select for groups" ON custom_groups;
DROP POLICY IF EXISTS "Managers can update/delete rooms" ON custom_groups;
DROP POLICY IF EXISTS "Allow coach insert" ON custom_groups;
DROP POLICY IF EXISTS "Allow group select" ON custom_groups;
DROP POLICY IF EXISTS "Allow group manage" ON custom_groups;

DROP POLICY IF EXISTS "Members can see group membership" ON group_members;
DROP POLICY IF EXISTS "Coaches can manage members" ON group_members;
DROP POLICY IF EXISTS "Allow select members" ON group_members;
DROP POLICY IF EXISTS "Allow manage members" ON group_members;
DROP POLICY IF EXISTS "Allow member select" ON group_members;
DROP POLICY IF EXISTS "Allow member manage" ON group_members;

-- 2. CREATE ROBUST ISOLATED FUNCTIONS
-- We use SECURITY DEFINER and explicit search_path to ensure these run without RLS.

-- Check if user is coach of team
CREATE OR REPLACE FUNCTION public.check_is_team_coach(p_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = p_team_id AND coach_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid() AND p.role = 'COACH'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if user is member of group
CREATE OR REPLACE FUNCTION public.check_is_group_member(p_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if user created the group
CREATE OR REPLACE FUNCTION public.check_is_group_creator(p_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.custom_groups 
    WHERE id = p_group_id AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get team ID for a group safely
CREATE OR REPLACE FUNCTION public.get_team_id_from_group(p_group_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT team_id FROM public.custom_groups WHERE id = p_group_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. APPLY TO custom_groups
ALTER TABLE custom_groups ENABLE ROW LEVEL SECURITY;

-- INSERT: Allow if coach of team
CREATE POLICY "emergency_insert_groups" ON custom_groups
FOR INSERT WITH CHECK (check_is_team_coach(team_id));

-- SELECT: Allow creator, coach or member
CREATE POLICY "emergency_select_groups" ON custom_groups
FOR SELECT USING (
  created_by = auth.uid() 
  OR check_is_team_coach(team_id) 
  OR check_is_group_member(id)
);

-- ALL (Manage): Allow creator or coach
CREATE POLICY "emergency_manage_groups" ON custom_groups
FOR ALL USING (
  created_by = auth.uid() 
  OR check_is_team_coach(team_id)
);


-- 4. APPLY TO group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- SELECT/ALL for group members
CREATE POLICY "emergency_select_members" ON group_members
FOR SELECT USING (
  user_id = auth.uid() 
  OR check_is_team_coach(get_team_id_from_group(group_id))
  OR check_is_group_member(group_id)
);

CREATE POLICY "emergency_manage_members" ON group_members
FOR ALL USING (
  check_is_team_coach(get_team_id_from_group(group_id))
  OR check_is_group_creator(group_id)
);
