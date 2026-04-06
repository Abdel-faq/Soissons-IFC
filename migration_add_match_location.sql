ALTER TABLE events ADD COLUMN IF NOT EXISTS match_location TEXT CHECK (match_location IN ('DOMICILE', 'EXTERIEUR'));
