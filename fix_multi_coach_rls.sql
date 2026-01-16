-- SUPPORT MULTI-COACH & CORRECTION RLS INSERTION
-- Ce script permet à plusieurs coachs de gérer une même équipe.

-- 1. Autoriser l'insertion dans team_members pour les coachs et les parents
DROP POLICY IF EXISTS "Users can join a team" ON team_members;
CREATE POLICY "Users can join a team" ON team_members 
FOR INSERT WITH CHECK (
    -- Cas 1 : Un parent ajoute son enfant (via player_id)
    (
        player_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM players 
            WHERE id = player_id 
            AND parent_id = auth.uid()
        )
    )
    OR 
    -- Cas 2 : Un coach rejoint lui-même l'équipe (sans player_id)
    (
        player_id IS NULL 
        AND user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'COACH'
        )
    )
);

-- 2. Étendre la gestion des événements à tous les coachs membres de l'équipe
DROP POLICY IF EXISTS "Coaches can manage events" ON events;
CREATE POLICY "Coaches can manage events" ON events 
FOR ALL USING (
    -- Est le propriétaire (coach_id dans teams)
    EXISTS (SELECT 1 FROM teams WHERE teams.id = events.team_id AND teams.coach_id = auth.uid()) 
    OR
    -- OU est un membre de l'équipe avec le rôle COACH
    EXISTS (
        SELECT 1 FROM team_members 
        JOIN profiles ON profiles.id = team_members.user_id 
        WHERE team_members.team_id = events.team_id 
        AND team_members.user_id = auth.uid() 
        AND profiles.role = 'COACH'
    )
    OR
    -- OU est Administrateur
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN')
);

-- 3. Étendre la gestion de l'équipe (Update) à tous les coachs membres
DROP POLICY IF EXISTS "Coach can update their team" ON teams;
CREATE POLICY "Coach can update their team" ON teams 
FOR UPDATE USING (
    coach_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM team_members 
        JOIN profiles ON profiles.id = team_members.user_id 
        WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid() 
        AND profiles.role = 'COACH'
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN')
);

-- 4. Étendre la gestion des convocations/présences
DROP POLICY IF EXISTS "Coaches can manage attendance" ON attendance;
CREATE POLICY "Coaches can manage attendance" ON attendance 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM events 
        JOIN teams ON teams.id = events.team_id 
        WHERE events.id = attendance.event_id 
        AND (
            teams.coach_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM team_members 
                JOIN profiles ON profiles.id = team_members.user_id 
                WHERE team_members.team_id = teams.id 
                AND team_members.user_id = auth.uid() 
                AND profiles.role = 'COACH'
            )
        )
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN')
);

-- 5. Étendre les permissions sur les messages (Chat)
DROP POLICY IF EXISTS "Coaches can delete any message" ON messages;
CREATE POLICY "Coaches can delete any message" ON messages 
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE id = messages.team_id 
        AND (
            coach_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM team_members 
                JOIN profiles ON profiles.id = team_members.user_id 
                WHERE team_members.team_id = teams.id 
                AND team_members.user_id = auth.uid() 
                AND profiles.role = 'COACH'
            )
        )
    )
);

-- Mise à jour des permissions d'envoi pour inclure les coachs membres
DROP POLICY IF EXISTS "Members can post messages" ON messages;
CREATE POLICY "Members can post messages" ON messages 
FOR INSERT WITH CHECK (
  (
    -- Est un coach de l'équipe (propriétaire ou membre coach)
    EXISTS (
        SELECT 1 FROM teams 
        WHERE id = messages.team_id 
        AND (
            coach_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM team_members 
                JOIN profiles ON profiles.id = team_members.user_id 
                WHERE team_members.team_id = teams.id 
                AND team_members.user_id = auth.uid() 
                AND profiles.role = 'COACH'
            )
        )
    )
    OR 
    -- OU est un membre régulier et le chat n'est pas verrouillé
    (
      EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
      AND NOT EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND is_chat_locked = TRUE)
    )
  )
  AND auth.uid() = sender_id
);

-- 6. Index d'unicité pour les coachs (individus sans player_id)
-- Permet l'UPSERT correct pour les membres qui n'ont pas de player_id (comme les coachs)
CREATE UNIQUE INDEX IF NOT EXISTS team_members_user_team_unique_idx ON team_members (team_id, user_id) WHERE player_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_user_event_unique_idx ON attendance (event_id, user_id) WHERE player_id IS NULL;
