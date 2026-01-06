-- FINAL CHAT FIXES
-- Ensure room creators (coaches) always see their rooms even if empty
-- Ensure robust RLS

-- 1. Add created_by to custom_groups
ALTER TABLE custom_groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Update RLS for custom_groups
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (
  created_by = auth.uid() -- The creator can always see it
  OR EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = custom_groups.id AND user_id = auth.uid()
  ) 
  OR EXISTS (
    SELECT 1 FROM teams 
    WHERE id = custom_groups.team_id AND coach_id = auth.uid()
  )
);

-- 3. Update RLS for messages (matching same logic)
DROP POLICY IF EXISTS "Members can see team messages" ON messages;
CREATE POLICY "Members can see team messages" ON messages 
FOR SELECT USING (
  (group_id IS NULL AND (
      EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
  )) OR (group_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM custom_groups WHERE id = messages.group_id AND created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM group_members WHERE group_id = messages.group_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM teams t JOIN custom_groups cg ON t.id = cg.team_id WHERE cg.id = messages.group_id AND t.coach_id = auth.uid())
  ))
);
