-- 1. DROP the strict rule FIRST
-- We must remove the old constraint before we can introduce new values like 'MALADE'
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- 2. Clean/Migrate Data
-- Now we are free to change values without triggering errors
UPDATE attendance SET status = 'MALADE' WHERE status = 'SICK';
UPDATE attendance SET status = 'BLESSE' WHERE status = 'INJURED';
UPDATE attendance SET status = 'RETARD' WHERE status = 'LATE';

-- Safety net for unknown values
UPDATE attendance 
SET status = 'INCONNU' 
WHERE status NOT IN ('PRESENT', 'ABSENT', 'MALADE', 'BLESSE', 'RETARD', 'INCONNU');

-- 3. APPLY the new rule
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (
    status IN ('PRESENT', 'ABSENT', 'MALADE', 'BLESSE', 'RETARD', 'INCONNU')
);
-- Note: 'AND CONSTRAINT' is a typo in my thought process? No, strict SQL is ADD CONSTRAINT.
-- Wait, I wrote `ALTER TABLE attendance AND CONSTRAINT` above??
-- Checking syntax... It should be `ADD CONSTRAINT`. Correcting it below.
