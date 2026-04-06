-- MIGRATION: Authorize Coaches to update Player Stats
-- Cette politique permet aux coachs de modifier les notes FIFA des joueurs de leurs équipes.

DROP POLICY IF EXISTS "Coaches can update players in their teams" ON players;

CREATE POLICY "Coaches can update players in their teams" ON players
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE t.coach_id = auth.uid() 
    AND tm.player_id = players.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE t.coach_id = auth.uid() 
    AND tm.player_id = players.id
  )
);

-- Note: On ajoute aussi une politique pour permettre aux parents de TOUJOURS gérer leurs enfants
-- (déjà existante mais on s'assure qu'elle n'est pas écrasée)
-- CREATE POLICY "Parents can manage their kids" ON players FOR ALL USING (parent_id = auth.uid());
