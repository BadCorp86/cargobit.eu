import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import * as csvStringify from 'csv-stringify';

/**
 * Report Export Worker
 * Processes export_jobs and generates CSV/JSON export files
 */

interface ExportJob {
  id: string;
  payload: {
    format?: 'csv' | 'json';
    filter?: {
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      userId?: string;
      minAmount?: number;
      maxAmount?: number;
    };
  };
  status: string;
}

interface ExportRow {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  processed_at?: string;
  reference?: string;
}

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/payments';
const EXPORT_DIR = process.env.EXPORT_DIR || '/tmp/exports';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10000', 10);

// Ensure export directory exists
if (!existsSync(EXPORT_DIR)) {
  mkdirSync(EXPORT_DIR, { recursive: true });
}

/**
 * Fetch next queued export job from database
 */
async function getNextJob(client: Client): Promise<ExportJob | null> {
  const result = await client.query(`
    UPDATE export_jobs
    SET status = 'running', started_at = NOW(), updated_at = NOW()
    WHERE id = (
      SELECT id FROM export_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload, status
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as ExportJob;
}

/**
 * Build query filters from payload
 */
function buildFilters(filter: ExportJob['payload']['filter']): {
  whereClause: string;
  params: any[];
} {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filter?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filter.status);
  }

  if (filter?.dateFrom) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filter.dateFrom);
  }

  if (filter?.dateTo) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filter.dateTo);
  }

  if (filter?.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filter.userId);
  }

  if (filter?.minAmount) {
    conditions.push(`amount_cents >= $${paramIndex++}`);
    params.push(filter.minAmount);
  }

  if (filter?.maxAmount) {
    conditions.push(`amount_cents <= $${paramIndex++}`);
    params.push(filter.maxAmount);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, params };
}

/**
 * Export data as CSV
 */
async function exportCsv(rows: ExportRow[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const stringifier = csvStringify.stringify({
      header: true,
      columns: ['id', 'user_id', 'amount_cents', 'status', 'created_at', 'processed_at', 'reference'],
    });

    stringifier.pipe(output);

    for (const row of rows) {
      stringifier.write(row);
    }

    stringifier.end();

    output.on('finish', resolve);
    output.on('error', reject);
  });
}

/**
 * Export data as JSON
 */
async function exportJson(rows: ExportRow[], outputPath: string): Promise<void> {
  const output = createWriteStream(outputPath);
  output.write(JSON.stringify(rows, null, 2));
  output.end();

  return new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });
}

/**
 * Process a single export job
 */
async function processJob(client: Client, job: ExportJob): Promise<void> {
  const startTime = Date.now();
  const format = job.payload?.format || 'csv';
  const outputPath = join(EXPORT_DIR, `reconciliation_${job.id}.${format}`);

  console.log(`Processing job ${job.id} with format ${format}`);

  try {
    // Build query
    const { whereClause, params } = buildFilters(job.payload?.filter);

    const query = `
      SELECT
        id,
        user_id,
        amount_cents,
        status,
        created_at,
        processed_at,
        reference
      FROM payouts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(BATCH_SIZE);

    const result = await client.query(query, params);
    const rows: ExportRow[] = result.rows;

    console.log(`Fetched ${rows.length} rows for export`);

    // Export based on format
    if (format === 'json') {
      await exportJson(rows, outputPath);
    } else {
      await exportCsv(rows, outputPath);
    }

    const durationMs = Date.now() - startTime;
    const fileSize = `${rows.length} rows`;

    // Update job as completed
    await client.query(
      `
      UPDATE export_jobs
      SET
        status = 'done',
        result_url = $1,
        rows_exported = $2,
        file_size = $3,
        duration_ms = $4,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
      `,
      [outputPath, rows.length, fileSize, durationMs, job.id]
    );

    console.log(`Job ${job.id} completed in ${durationMs}ms. Output: ${outputPath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update job as failed
    await client.query(
      `
      UPDATE export_jobs
      SET status = 'failed', error = $1, completed_at = NOW(), updated_at = NOW()
      WHERE id = $2
      `,
      [errorMessage, job.id]
    );

    console.error(`Job ${job.id} failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Main worker loop
 */
async function run(): Promise<void> {
  console.log('Starting Report Export Worker...');
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Export directory: ${EXPORT_DIR}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('Connected to database. Starting worker loop...');

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\nShutting down gracefully...');
    await client.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Main loop
  while (!shuttingDown) {
    try {
      const job = await getNextJob(client);

      if (job) {
        await processJob(client, job);
      } else {
        // No jobs available, wait before polling again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error('Worker error:', error);
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS * 2));
    }
  }

  await client.end();
}

// Run worker
if (require.main === module) {
  run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { run as runReportWorker, processJob, exportCsv, exportJson };
