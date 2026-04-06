-- FINAL GROUP MANAGEMENT PERMISSIONS
-- This script grants INSERT/DELETE/UPDATE rights to coaches and creators

-- 1. PERMISSIONS FOR custom_groups (Salons)
--------------------------------------------

-- Allow coaches to create rooms for their teams
DROP POLICY IF EXISTS "Coaches can create rooms" ON custom_groups;
CREATE POLICY "Coaches can create rooms" ON custom_groups
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM teams WHERE id = custom_groups.team_id AND coach_id = auth.uid())
);

-- Allow coaches and creators to delete rooms
DROP POLICY IF EXISTS "Coaches can delete rooms" ON custom_groups;
CREATE POLICY "Coaches can delete rooms" ON custom_groups
FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM teams WHERE id = custom_groups.team_id AND coach_id = auth.uid())
);

-- Allow coaches and creators to update rooms (name, etc)
DROP POLICY IF EXISTS "Coaches can update rooms" ON custom_groups;
CREATE POLICY "Coaches can update rooms" ON custom_groups
FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM teams WHERE id = custom_groups.team_id AND coach_id = auth.uid())
);


-- 2. PERMISSIONS FOR group_members (Membres)
--------------------------------------------

-- Allow coaches and creators to add members
DROP POLICY IF EXISTS "Coaches can manage members" ON group_members;
CREATE POLICY "Coaches can manage members" ON group_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM custom_groups cg
    LEFT JOIN teams t ON cg.team_id = t.id
    WHERE cg.id = group_members.group_id 
    AND (cg.created_by = auth.uid() OR t.coach_id = auth.uid())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM custom_groups cg
    LEFT JOIN teams t ON cg.team_id = t.id
    WHERE cg.id = group_members.group_id 
    AND (cg.created_by = auth.uid() OR t.coach_id = auth.uid())
  )
);
