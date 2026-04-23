-- migrations/20260423_create_export_jobs.sql
-- Task 5: Reconciliation Reporting and Export
-- Creates export_jobs table for background export processing

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY,
  payload JSONB,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  result_url TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs (status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs (created_at);

-- Add comment for documentation
COMMENT ON TABLE export_jobs IS 'Background jobs for reconciliation report exports';
COMMENT ON COLUMN export_jobs.id IS 'Unique job identifier (UUID)';
COMMENT ON COLUMN export_jobs.payload IS 'Export parameters (filter, format, etc.)';
COMMENT ON COLUMN export_jobs.status IS 'Job status: queued, running, done, failed';
COMMENT ON COLUMN export_jobs.result_url IS 'URL to download the exported file';
COMMENT ON COLUMN export_jobs.error IS 'Error message if job failed';
