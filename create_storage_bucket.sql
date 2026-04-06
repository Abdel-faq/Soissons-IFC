-- Création du bucket de stockage pour le chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_attachments', 'chat_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques de sécurité pour le stockage (RLS)
-- Autoriser l'accès public pour voir les fichiers
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat_attachments' );

-- Autoriser l'upload pour les utilisateurs connectés
DROP POLICY IF EXISTS "Authenticated can upload" ON storage.objects;
CREATE POLICY "Authenticated can upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'chat_attachments' AND
    auth.role() = 'authenticated'
);

-- Autoriser la suppression par le propriétaire (ou coach)
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'chat_attachments' AND
    (auth.uid() = owner OR 
     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'COACH'))
);
