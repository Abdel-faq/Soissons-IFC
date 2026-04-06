-- Migration: Add Read Receipts and Unread Counts to Chat (Version Corrigée)

-- 1. Table to track individual message reads
CREATE TABLE IF NOT EXISTS message_reads (
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

-- 2. Table to track last read message per user per room
CREATE TABLE IF NOT EXISTS chat_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    group_id UUID REFERENCES custom_groups(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    last_read_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create partial unique indexes to handle NULL group_id correctly for upserts/uniqueness
-- This replaces the problematic composite PRIMARY KEY
DROP INDEX IF EXISTS chat_read_status_unique_null_group;
CREATE UNIQUE INDEX chat_read_status_unique_null_group ON chat_read_status (user_id, team_id) WHERE group_id IS NULL;

DROP INDEX IF EXISTS chat_read_status_unique_with_group;
CREATE UNIQUE INDEX chat_read_status_unique_with_group ON chat_read_status (user_id, team_id, group_id) WHERE group_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;

-- 4. Policies for message_reads
DROP POLICY IF EXISTS "Users can see reads in their team" ON message_reads;
CREATE POLICY "Users can see reads in their team" ON message_reads 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM messages m
        JOIN team_members tm ON m.team_id = tm.team_id
        WHERE m.id = message_reads.message_id AND tm.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM messages m
        JOIN teams t ON m.team_id = t.id
        WHERE m.id = message_reads.message_id AND t.coach_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can mark messages as read" ON message_reads;
CREATE POLICY "Users can mark messages as read" ON message_reads
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Policies for chat_read_status
DROP POLICY IF EXISTS "Users can manage their own read status" ON chat_read_status;
CREATE POLICY "Users can manage their own read status" ON chat_read_status
FOR ALL USING (auth.uid() = user_id);
