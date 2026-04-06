-- Tables related to the Skills/Compétences module

-- 1. Skill Domains (e.g., Physique, Technique, Tactique, Mental, Perceptivo-cognitif)
CREATE TABLE IF NOT EXISTS public.skill_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Skill Categories (e.g., U6, U7, ..., U10-U11, U12-U13)
CREATE TABLE IF NOT EXISTS public.skill_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Skills (The actual skill grouping, e.g., "Passes" inside "Technique")
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.skill_categories(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES public.skill_domains(id) ON DELETE CASCADE,
    sub_domain VARCHAR(255) NOT NULL, -- e.g., "Techniques avec ballon" or "Techniques sans ballon"
    name VARCHAR(255) NOT NULL,       -- e.g., "Contrôles / Prises de balle", "Passes", "Vitesse de réaction"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- A skill name should be unique within a category/domain combination
    UNIQUE (category_id, domain_id, name)
);

-- 4. Skill Levels (The 5 progression levels per skill)
CREATE TABLE IF NOT EXISTS public.skill_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (skill_id, level)
);

-- 5. Player Skills (Player's evaluation)
CREATE TABLE IF NOT EXISTS public.player_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
    status VARCHAR(20) NOT NULL CHECK (status IN ('red', 'orange', 'green')), -- red: non acquis, orange: en cours, green: validé
    validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- the coach who validated it
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (player_id, skill_id, level)
);

-- RLS (Row Level Security)

-- Enable RLS
ALTER TABLE public.skill_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skills ENABLE ROW LEVEL SECURITY;

-- Policies for reference tables (domains, categories, skills, levels)
-- Everyone can read
CREATE POLICY "Enable read access for all users on skill_domains" ON public.skill_domains FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users on skill_categories" ON public.skill_categories FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users on skills" ON public.skills FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users on skill_levels" ON public.skill_levels FOR SELECT USING (true);

-- Policies for player_skills
-- Players can read their own skills
CREATE POLICY "Players can view their own skills" ON public.player_skills
    FOR SELECT
    USING (
        auth.uid() IN (SELECT user_id FROM team_members WHERE player_id = player_skills.player_id)
        OR
        auth.uid() IN (SELECT parent_id FROM players WHERE id = player_skills.player_id)
    );

-- Coaches can read/insert/update skills for players in their teams
CREATE POLICY "Coaches can manage player skills in their teams" ON public.player_skills
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            WHERE tm.player_id = player_skills.player_id AND t.coach_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM events te
            WHERE te.team_id IN (SELECT id FROM teams WHERE coach_id = auth.uid())
            -- Broadest access for principal coach is assumed if they manage the team
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            WHERE tm.player_id = player_skills.player_id AND t.coach_id = auth.uid()
        )
    );
