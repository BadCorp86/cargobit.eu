-- Rollback migration for Task 5: export_jobs table
-- Run this ONLY if you need to rollback Task 5

BEGIN;

-- Check if table exists before dropping
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'export_jobs') THEN
    DROP TABLE IF EXISTS export_jobs CASCADE;
    RAISE NOTICE 'Table export_jobs dropped successfully';
  ELSE
    RAISE NOTICE 'Table export_jobs does not exist, nothing to drop';
  END IF;
END $$;

-- Remove any related indexes that might have been created
DROP INDEX IF EXISTS idx_export_jobs_status;
DROP INDEX IF EXISTS idx_export_jobs_created_at;

COMMIT;

-- Verify rollback
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'export_jobs') 
    THEN 'Rollback successful: export_jobs table removed'
    ELSE 'Rollback failed: export_jobs table still exists'
  END as status;
