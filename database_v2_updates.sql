-- 1. Tables pour les groupes personnalisés
CREATE TABLE IF NOT EXISTS custom_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES custom_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- 2. Améliorations de la table events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('WEEKLY', NULL)),
ADD COLUMN IF NOT EXISTS visibility_type TEXT DEFAULT 'PUBLIC' CHECK (visibility_type IN ('PUBLIC', 'PRIVATE', 'GROUP')),
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES custom_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id), -- Pour identifier quel coach a créé le match
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Améliorations de la table messages (Chat)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 4. Améliorations de la table attendance (Convocations)
-- visibility_type 'PRIVATE' signifie que seuls les convoqués voient l'événement.
-- On s'assure que is_convoked existe déjà (vu dans le code précédent)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='is_convoked') THEN
        ALTER TABLE attendance ADD COLUMN is_convoked BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
