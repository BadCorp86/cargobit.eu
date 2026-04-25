-- ============================================
-- CARGOBIT RECONCILIATION EXPORT - TEST DATA GENERATOR
-- Version: 1.0
-- ============================================

-- Generate test payouts for load testing
-- Run with: psql $DATABASE_URL -f test-data-generator.sql

BEGIN;

-- Clear existing test data (optional - uncomment if needed)
-- DELETE FROM payout_events WHERE payout_id LIKE 'test_%';
-- DELETE FROM payouts WHERE id LIKE 'test_%';

-- Insert test payouts
INSERT INTO payouts (id, carrier_id, amount, currency, status, created_at, updated_at)
SELECT 
  'test_payout_' || gen_random_uuid()::text,
  'carrier_' || (i % 50 + 1),
  (random() * 5000 + 100)::decimal(10, 2),
  CASE (i % 3) 
    WHEN 0 THEN 'EUR'
    WHEN 1 THEN 'USD'
    ELSE 'GBP'
  END,
  CASE (i % 4)
    WHEN 0 THEN 'open'
    WHEN 1 THEN 'reconciled'
    WHEN 2 THEN 'needs_review'
    ELSE 'paid'
  END,
  NOW() - (random() * 30 || ' days')::interval,
  NOW() - (random() * 5 || ' days')::interval
FROM generate_series(1, 10000) AS i;

-- Insert payout events
INSERT INTO payout_events (id, payout_id, type, payload, created_at)
SELECT 
  gen_random_uuid(),
  p.id,
  CASE (i % 5)
    WHEN 0 THEN 'created'
    WHEN 1 THEN 'status_changed'
    WHEN 2 THEN 'manual_mark'
    WHEN 3 THEN 'stripe_webhook'
    ELSE 'reconciled'
  END,
  jsonb_build_object(
    'old_status', CASE WHEN p.status = 'open' THEN NULL ELSE 'pending' END,
    'new_status', p.status,
    'amount', p.amount,
    'actor', 'test_user_' || (i % 10 + 1)
  ),
  p.created_at + (random() * 24 || ' hours')::interval
FROM payouts p
CROSS JOIN generate_series(1, 3) AS i
WHERE p.id LIKE 'test_%';

-- Create export jobs for testing
INSERT INTO export_jobs (id, payload, status, created_at, updated_at)
SELECT 
  'test_export_' || gen_random_uuid()::text,
  jsonb_build_object(
    'format', CASE (i % 2) WHEN 0 THEN 'csv' ELSE 'json' END,
    'filter', jsonb_build_object(
      'dateFrom', (NOW() - (i % 7 || ' days')::interval)::date,
      'dateTo', NOW()::date,
      'status', CASE (i % 4) 
        WHEN 0 THEN 'open' 
        WHEN 1 THEN 'reconciled' 
        WHEN 2 THEN 'needs_review' 
        ELSE NULL 
      END
    )
  ),
  CASE (i % 4)
    WHEN 0 THEN 'queued'
    WHEN 1 THEN 'processing'
    WHEN 2 THEN 'completed'
    ELSE 'failed'
  END,
  NOW() - (random() * 7 || ' days')::interval,
  NOW() - (random() * 1 || ' days')::interval
FROM generate_series(1, 100) AS i;

COMMIT;

-- Verify data
SELECT 'payouts' AS table_name, COUNT(*) AS count FROM payouts WHERE id LIKE 'test_%'
UNION ALL
SELECT 'payout_events', COUNT(*) FROM payout_events WHERE payout_id LIKE 'test_%'
UNION ALL
SELECT 'export_jobs', COUNT(*) FROM export_jobs WHERE id LIKE 'test_%';

-- Summary by status
SELECT status, COUNT(*) as count 
FROM payouts 
WHERE id LIKE 'test_%' 
GROUP BY status 
ORDER BY count DESC;
