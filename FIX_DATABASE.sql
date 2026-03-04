-- MIGRATION: Combined Fix (Profiles + FIFA Stats)
-- Ce script ajoute toutes les colonnes manquantes pour faire fonctionner l'Effectif et les Cartes FIFA.

-- 1. Ajout de colonnes à la table PROFILES (v7)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migration des noms existants pour les profiles
UPDATE profiles 
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE 
    WHEN position(' ' in full_name) > 0 THEN substring(full_name from position(' ' in full_name)+1)
    ELSE ''
  END
WHERE (first_name IS NULL OR first_name = '') AND full_name IS NOT NULL;

-- 2. Ajout de colonnes à la table PLAYERS (v8)
ALTER TABLE players ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'FR';
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_pac INTEGER DEFAULT 50;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_sho INTEGER DEFAULT 50;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_pas INTEGER DEFAULT 50;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_dri INTEGER DEFAULT 50;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_def INTEGER DEFAULT 50;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_phy INTEGER DEFAULT 50;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_overall INTEGER DEFAULT 50;

-- Comment pour la clarté
COMMENT ON COLUMN players.country IS 'ISO country code (e.g., FR, BE, ES)';
