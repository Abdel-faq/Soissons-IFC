-- SCRIPT DE RÉINITIALISATION COMPLÈTE - SOISSONS IFC
-- Ce script supprime tout et recrée le schéma propre.

-- 1. Nettoyage (Ordre respectant les contraintes)
DROP TABLE IF EXISTS "Entraineurs" CASCADE;
DROP TABLE IF EXISTS entraineurs CASCADE;
DROP TABLE IF EXISTS carpooling CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS custom_groups CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. Création des tables

-- Profils (liés à l'authentification Supabase)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'COACH', 'PLAYER')) DEFAULT 'PLAYER',
    position TEXT, -- Poste sur le terrain
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pour créer un profil automatiquement lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'PLAYER');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Synchronisation des profils pour les utilisateurs déjà inscrits
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'PLAYER'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Équipes
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membres des équipes
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- Groupes personnalisés
CREATE TABLE custom_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membres des groupes
CREATE TABLE group_members (
    group_id UUID REFERENCES custom_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Événements
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('MATCH', 'TRAINING')) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    location TEXT,
    notes TEXT,
    visibility_type TEXT CHECK (visibility_type IN ('PUBLIC', 'PRIVATE', 'GROUP')) DEFAULT 'PUBLIC',
    group_id UUID REFERENCES custom_groups(id) ON DELETE SET NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern TEXT CHECK (recurrence_pattern IN ('WEEKLY', NULL)),
    coach_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Présences et Convocations
CREATE TABLE attendance (
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('PRESENT', 'ABSENT', 'MALADE', 'BLESSE', 'RETARD', 'INCONNU')) DEFAULT 'INCONNU',
    is_convoked BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- Messagerie (Chat)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT,
    file_url TEXT,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Covoiturage
CREATE TABLE carpooling (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('DRIVER', 'PASSENGER')) NOT NULL,
    spots INTEGER DEFAULT 0, -- Nombre de places si conducteur
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Activation de Row Level Security (RLS)
-- Note: Pour un test complet et simple, on peut soit désactiver RLS
-- soit ajouter des règles basiques. Ici, on les active.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can join a team" ON team_members;
CREATE POLICY "Users can join a team" ON team_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can view teammates" ON team_members;
CREATE POLICY "Members can view teammates" ON team_members FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can see team messages" ON messages;
CREATE POLICY "Members can see team messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid())
);

DROP POLICY IF EXISTS "Members can post messages" ON messages;
CREATE POLICY "Members can post messages" ON messages FOR INSERT WITH CHECK (
  (EXISTS (SELECT 1 FROM team_members WHERE team_id = messages.team_id AND user_id = auth.uid())
   OR EXISTS (SELECT 1 FROM teams WHERE id = messages.team_id AND coach_id = auth.uid()))
  AND auth.uid() = sender_id
);

-- 4. Exemple de Politiques RLS Simplifiées (Tout le monde peut lire les données de son équipe)

-- Politiques pour la table "profiles"
DROP POLICY IF EXISTS "Profiles are viewable by authenticated" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Politiques pour les événements (Lecture pour tous les membres de l'équipe)
CREATE POLICY "Authenticated users can read events" ON events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Coaches can manage events" ON events FOR ALL USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = events.team_id AND teams.coach_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN')
);

-- Politiques pour la table "teams"
DROP POLICY IF EXISTS "Anyone authenticated can view teams" ON teams;
CREATE POLICY "Anyone authenticated can view teams" ON teams FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Coach/Admin can manage teams" ON teams;
CREATE POLICY "Coach/Admin can manage teams" ON teams FOR ALL USING (
  (coach_id = auth.uid()) OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'))
);

CREATE POLICY "Coaches can create teams" ON teams FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'COACH')
);

-- (Vous pouvez affiner les RLS plus tard, ce script assure une base fonctionnelle)
