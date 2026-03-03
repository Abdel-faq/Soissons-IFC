-- MIGRATION: Player Profile Enhancements (v6)
-- Adding detailed fields to both players and profiles tables

-- 1. Update 'players' table
ALTER TABLE players ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS height INTEGER; -- in cm
ALTER TABLE players ADD COLUMN IF NOT EXISTS weight INTEGER; -- in kg
ALTER TABLE players ADD COLUMN IF NOT EXISTS strong_foot TEXT DEFAULT 'DROIT'; -- DROIT, GAUCHE, AMBIDEXTRE
ALTER TABLE players ADD COLUMN IF NOT EXISTS license_number TEXT;

-- 2. Update 'profiles' table (for coaches/admins who might want to share same stats)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strong_foot TEXT DEFAULT 'DROIT';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_number TEXT;
