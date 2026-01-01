-- CORRECTIF DES POLITIQUES RLS ET TRIGGER DE PROFIL

-- 1. Trigger pour créer un profil automatiquement lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'PLAYER');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe et le recréer
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 1b. Remplissage des profils pour les utilisateurs déjà inscrits
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'PLAYER'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Politiques pour la table "teams"
DROP POLICY IF EXISTS "Anyone can create a team" ON teams;
CREATE POLICY "Anyone can create a team" ON teams 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Coach can update their team" ON teams;
CREATE POLICY "Coach can update their team" ON teams 
FOR UPDATE USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "Members can see their team" ON teams;
CREATE POLICY "Members can see their team" ON teams 
FOR SELECT USING (
  auth.uid() = coach_id OR 
  EXISTS (SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = auth.uid())
);

-- 3. Politiques pour la table "profiles"
DROP POLICY IF EXISTS "Authenticated users can see profiles" ON profiles;
CREATE POLICY "Authenticated users can see profiles" ON profiles 
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE USING (auth.uid() = id);

-- 4. Politiques pour la table "team_members"
DROP POLICY IF EXISTS "Users can join a team" ON team_members;
CREATE POLICY "Users can join a team" ON team_members 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Members can see teammates" ON team_members;
CREATE POLICY "Members can see teammates" ON team_members 
FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Politiques pour la table "events" (Correction pour autoriser le Coach via backend)
-- Puisque le backend utilise la SERVICE_ROLE, il contourne RLS. 
-- Mais pour la lecture directe via frontend :
DROP POLICY IF EXISTS "Members can see team events" ON events;
CREATE POLICY "Members can see team events" ON events 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = events.team_id AND user_id = auth.uid()) OR
  coach_id = auth.uid() OR
  visibility_type = 'PUBLIC'
);
