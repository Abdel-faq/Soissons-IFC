-- Allow coaches to remove members from their teams
DROP POLICY IF EXISTS "Coaches can remove members" ON team_members;
CREATE POLICY "Coaches can remove members" ON team_members
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = team_members.team_id
    AND teams.coach_id = auth.uid()
  )
);

-- Allow users to leave a team themselves
DROP POLICY IF EXISTS "Users can leave a team" ON team_members;
CREATE POLICY "Users can leave a team" ON team_members
FOR DELETE USING (auth.uid() = user_id);
