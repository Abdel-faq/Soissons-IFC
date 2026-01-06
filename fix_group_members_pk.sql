-- Fix group_members table to support multiple children of the same parent
-- and avoid fixed primary key constraints on (group_id, user_id)

-- 1. Drop existing primary key if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'group_members_pkey' 
        AND conrelid = 'group_members'::regclass
    ) THEN
        ALTER TABLE group_members DROP CONSTRAINT group_members_pkey;
    END IF;
END $$;

-- 2. Add player_id if not exists (should be there from previous migrations but let's be sure)
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE CASCADE;

-- 3. Add a proper surrogate primary key
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- 4. Add a unique constraint to prevent exact duplicates (group, parent, child)
ALTER TABLE group_members ADD CONSTRAINT group_members_unique_entry UNIQUE (group_id, user_id, player_id);

-- 5. Update RLS policies for custom_groups and messages to consider player_id if needed
-- Actually, the current policies for messages based on user_id (auth.uid()) are fine for access.
-- We just need to ensure group_members check is correct.
