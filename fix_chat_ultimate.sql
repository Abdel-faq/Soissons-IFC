-- ULTIMATE FIX FOR CHAT ROOMS RLS
-- Resolves "New row violates RLS" and Infinite Recursion.

-- 1. CLEANUP ALL RELATED POLICIES
DROP POLICY IF EXISTS "Coaches can insert rooms" ON custom_groups;
DROP POLICY IF EXISTS "Coaches can create rooms" ON custom_groups;
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
DROP POLICY IF EXISTS "Coaches can delete rooms" ON custom_groups;
DROP POLICY IF EXISTS "Coaches can update rooms" ON custom_groups;
DROP POLICY IF EXISTS "Standard select for groups" ON custom_groups;
DROP POLICY IF EXISTS "Managers can update/delete rooms" ON custom_groups;

DROP POLICY IF EXISTS "Members can see group membership" ON group_members;
DROP POLICY IF EXISTS "Coaches can manage members" ON group_members;
DROP POLICY IF EXISTS "Allow select members" ON group_members;
DROP POLICY IF EXISTS "Allow manage members" ON group_members;

-- 2. ROBUST ACCESS FUNCTION (SECURITY DEFINER)
-- This function is non-recursive because it queries tables using SECURITY DEFINER context.
CREATE OR REPLACE FUNCTION public.has_chat_access(p_group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_team_id UUID;
    v_created_by UUID;
BEGIN
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;

    -- Get group details via SECURITY DEFINER (bypasses RLS)
    SELECT team_id, created_by INTO v_team_id, v_created_by 
    FROM public.custom_groups 
    WHERE id = p_group_id;

    -- No group found? No access.
    IF v_team_id IS NULL THEN RETURN FALSE; END IF;

    -- 1. Admin? Yes.
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'ADMIN') THEN
        RETURN TRUE;
    END IF;

    -- 2. Creator or Principal Coach? Yes.
    IF v_created_by = v_user_id OR EXISTS (
        SELECT 1 FROM public.teams WHERE id = v_team_id AND coach_id = v_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 3. Secondary Coach (member with COACH role)? Yes.
    IF EXISTS (
        SELECT 1 FROM public.team_members tm
        JOIN public.profiles p ON p.id = tm.user_id
        WHERE tm.team_id = v_team_id AND tm.user_id = v_user_id AND p.role = 'COACH'
    ) THEN
        RETURN TRUE;
    END IF;

    -- 4. Explicit Group Member? Yes.
    IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = v_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY TO custom_groups
ALTER TABLE custom_groups ENABLE ROW LEVEL SECURITY;

-- SIMPLE INSERT: Just check if the user has the COACH or ADMIN role.
-- We avoid team-specific checks in INSERT to ensure Supabase doesn't fail on complex JOINs during row prep.
CREATE POLICY "Coaches can insert rooms" ON custom_groups
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'COACH' OR role = 'ADMIN'))
);

-- ROBUST SELECT: Use the SECURITY DEFINER function
CREATE POLICY "Standard select for groups" ON custom_groups
FOR SELECT USING (has_chat_access(id));

-- MANAGE RIGHTS: Update and Delete
CREATE POLICY "Managers can update/delete rooms" ON custom_groups
FOR ALL USING (has_chat_access(id));


-- 4. APPLY TO group_members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select members" ON group_members
FOR SELECT USING (has_chat_access(group_id));

CREATE POLICY "Allow manage members" ON group_members
FOR ALL USING (has_chat_access(group_id)) WITH CHECK (has_chat_access(group_id));
