-- Ajout du support pour les "Soft Deletes" (Suppression logique)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Ajout du verrouillage des présences (pour que le coach ait le dernier mot)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Index pour optimiser la recherche des événements non supprimés
CREATE INDEX IF NOT EXISTS idx_events_is_deleted ON events(is_deleted) WHERE is_deleted = false;
