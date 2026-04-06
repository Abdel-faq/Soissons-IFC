-- MIGRATION: Profiles Name Polish (v7)
-- Adding specific name fields to profiles table for consistency with players table

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migration of existing data
UPDATE profiles 
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE 
    WHEN position(' ' in full_name) > 0 THEN substring(full_name from position(' ' in full_name)+1)
    ELSE ''
  END
WHERE (first_name IS NULL OR first_name = '') AND full_name IS NOT NULL;
