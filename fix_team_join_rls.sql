-- FIX FINAL: Moderation, Chat Verrouillé et Convocations
-- 1. Nouveau champ pour le chat verrouillé
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_chat_locked BOOLEAN DEFAULT FALSE;

-- 2. Autoriser tous les utilisateurs connectés à voir les équipes (necessaire pour join et check lock)
DROP POLICY IF EXISTS "Members can see their team" ON teams;
CREATE POLICY "Members can see their team" ON teams 
FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Permissions Chat (Messages)
-- Suppression (Coach uniquement)
DROP POLICY IF EXISTS "Coaches can delete any message" ON messages;
CREATE POLICY "Coaches can delete any message" ON messages 
FOR DELETE USING (
  EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
);

-- Lecture (Tout le monde dans l'équipe)
DROP POLICY IF EXISTS "Members can see team messages" ON messages;
CREATE POLICY "Members can see team messages" ON messages 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
);

-- Envoi (Coach ou Membres si pas verrouillé)
DROP POLICY IF EXISTS "Members can post messages" ON messages;
CREATE POLICY "Members can post messages" ON messages 
FOR INSERT WITH CHECK (
  (
    EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
    OR 
    (
      EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
      AND NOT EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND is_chat_locked = TRUE)
    )
  )
  AND auth.uid() = sender_id
);

-- 4. Permissions Attendance (Convocations)
-- Lecture (Tout membre authentifié)
DROP POLICY IF EXISTS "Anyone can see attendance" ON attendance;
CREATE POLICY "Anyone can see attendance" ON attendance 
FOR SELECT USING (auth.role() = 'authenticated');

-- Gestion complète (Coach)
DROP POLICY IF EXISTS "Coaches can manage attendance" ON attendance;
CREATE POLICY "Coaches can manage attendance" ON attendance 
FOR ALL USING (
  EXISTS (SELECT 1 FROM teams JOIN events ON teams.id = events.team_id WHERE events.id = attendance.event_id AND teams.coach_id = auth.uid())
);

-- Mise à jour propre (Joueur pour son statut)
DROP POLICY IF EXISTS "Users can update own attendance" ON attendance;
CREATE POLICY "Users can update own attendance" ON attendance 
FOR UPDATE USING (auth.uid() = user_id);

-- Insertion propre (Joueur pour son statut)
DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance;
CREATE POLICY "Users can insert own attendance" ON attendance 
FOR INSERT WITH CHECK (auth.uid() = user_id);
