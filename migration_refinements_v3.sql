-- MIGRATION: RLS Refinements for Parent-Child Structure

-- 1. Fix team_members RLS: Allow parents to add their children to teams
DROP POLICY IF EXISTS "Users can join a team" ON team_members;
CREATE POLICY "Users can join a team" ON team_members 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id 
        AND parent_id = auth.uid()
    )
);

-- 2. Fix attendance RLS: Allow parents to update/insert attendance for their children
DROP POLICY IF EXISTS "Users can update own attendance" ON attendance;
CREATE POLICY "Parents can update children attendance" ON attendance 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id 
        AND parent_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance;
CREATE POLICY "Parents can insert children attendance" ON attendance 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id 
        AND parent_id = auth.uid()
    )
);

-- 3. Fix ride_passengers RLS: Ensure parents can manage children in rides
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON ride_passengers;
CREATE POLICY "Parents can manage children in rides" ON ride_passengers 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM players 
        WHERE id = player_id 
        AND parent_id = auth.uid()
    )
);

-- 4. Clean up old user_id based policies if they still exist and might conflict
-- Mostly covered by the DROPs above, but ensuring consistency.
