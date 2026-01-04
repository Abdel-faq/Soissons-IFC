-- Support for Custom Chat Rooms (Salons)

-- 1. Add is_broadcast to custom_groups
ALTER TABLE custom_groups 
ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN DEFAULT FALSE;

-- 2. Add group_id to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES custom_groups(id) ON DELETE CASCADE;

-- 3. Update RLS Policies for custom_groups
-- Only members of the team can see the groups, and if it's a private salon, only members of the group.
DROP POLICY IF EXISTS "Members can view their groups" ON custom_groups;
CREATE POLICY "Members can view their groups" ON custom_groups
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = custom_groups.team_id AND user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM teams 
    WHERE id = custom_groups.team_id AND coach_id = auth.uid()
  )
);

-- Actually, let's make custom_groups private by default if they are salons.
-- For now, any team member can see the groups, but the messages will be restricted.

-- 4. Update RLS Policies for messages to handle group_id
DROP POLICY IF EXISTS "Members can see team messages" ON messages;
CREATE POLICY "Members can see team messages" ON messages 
FOR SELECT USING (
  (
    group_id IS NULL AND (
      EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
    )
  ) OR (
    group_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM group_members WHERE group_id = messages.group_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM teams t JOIN custom_groups cg ON t.id = cg.team_id WHERE cg.id = messages.group_id AND t.coach_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Members can post messages" ON messages;
CREATE POLICY "Members can post messages" ON messages 
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND (
    (
      group_id IS NULL AND (
        EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
      )
    ) OR (
      group_id IS NOT NULL AND (
        -- Check if user is in group
        (EXISTS (SELECT 1 FROM group_members WHERE group_id = messages.group_id AND user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM teams t JOIN custom_groups cg ON t.id = cg.team_id WHERE cg.id = messages.group_id AND t.coach_id = auth.uid()))
        -- Check broadcast mode: if broadcast is ON, only coach can post
        AND (
          NOT EXISTS (SELECT 1 FROM custom_groups WHERE id = messages.group_id AND is_broadcast = TRUE)
          OR EXISTS (SELECT 1 FROM teams t JOIN custom_groups cg ON t.id = cg.team_id WHERE cg.id = messages.group_id AND t.coach_id = auth.uid())
        )
      )
    )
  )
);
