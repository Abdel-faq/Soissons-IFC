-- FIX: Affichage code équipe et permissions Chat
-- 1. Autoriser tous les utilisateurs connectés à voir les noms d'équipes et les codes
DROP POLICY IF EXISTS "Members can see their team" ON teams;
CREATE POLICY "Members can see their team" ON teams 
FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Autoriser un joueur à s'ajouter lui-même (INSERT)
DROP POLICY IF EXISTS "Users can join a team" ON team_members;
CREATE POLICY "Users can join a team" ON team_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Autoriser un joueur à voir son appartenance (SELECT)
DROP POLICY IF EXISTS "Members can see teammates" ON team_members;
CREATE POLICY "Members can see teammates" ON team_members 
FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Permissions Chat (Messages)
DROP POLICY IF EXISTS "Members can see team messages" ON messages;
CREATE POLICY "Members can see team messages" ON messages 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Members can post messages" ON messages;
CREATE POLICY "Members can post messages" ON messages 
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
  AND auth.uid() = sender_id
);
