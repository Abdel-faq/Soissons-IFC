-- Add expo_push_token to profiles if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'expo_push_token') THEN 
        ALTER TABLE profiles ADD COLUMN expo_push_token TEXT; 
    END IF; 
END $$;
