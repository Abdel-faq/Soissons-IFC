-- AJOUT DES POLITIQUES RLS POUR LA TABLE ATTENDANCE
-- Permet aux entraîneurs de gérer toute l'assiduité de leur équipe
-- Permet aux joueurs/parents de voir leurs propres données

-- 1. Autoriser la lecture pour tous les membres de l'équipe (ou simplement authentifiés pour simplifier)
DROP POLICY IF EXISTS "Anyone authenticated can read attendance" ON attendance;
CREATE POLICY "Anyone authenticated can read attendance" ON attendance FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Autoriser les entraîneurs à gérer (toutes actions) l'assiduité de leur équipe
DROP POLICY IF EXISTS "Coaches can manage attendance" ON attendance;
CREATE POLICY "Coaches can manage attendance" ON attendance FOR ALL USING (
    EXISTS (
        SELECT 1 FROM events
        JOIN teams ON teams.id = events.team_id
        WHERE events.id = attendance.event_id
        AND (teams.coach_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'))
    )
);

-- 3. Autoriser les joueurs/parents à mettre à jour leur propre assiduité
DROP POLICY IF EXISTS "Users can update own attendance" ON attendance;
CREATE POLICY "Users can update own attendance" ON attendance FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM players 
        WHERE players.id = attendance.player_id 
        AND players.parent_id = auth.uid()
    )
);
