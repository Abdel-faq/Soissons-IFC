-- Add player_id to messages table to identify which child the parent is speaking for
ALTER TABLE messages ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Update RLS if necessary (usually sender_id check is enough, but adding player_id to check is safer)
-- Existing policies might be enough if they rely on sender_id
